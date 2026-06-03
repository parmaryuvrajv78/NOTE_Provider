const crypto = require('crypto');

const API_VERSION = process.env.CASHFREE_API_VERSION || '2025-01-01';

function getEnvironment() {
    return process.env.CASHFREE_ENV === 'production' ? 'production' : 'sandbox';
}

function getBaseUrl() {
    return getEnvironment() === 'production'
        ? 'https://api.cashfree.com/pg'
        : 'https://sandbox.cashfree.com/pg';
}

function getPublicBaseUrl() {
    return (process.env.PUBLIC_APP_URL || process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

function stripPaymentReturnParams(returnUrl) {
    try {
        const url = new URL(returnUrl);
        ['payment_return', 'subscription_id', 'cf_subscription_id', 'payment_status'].forEach(key => url.searchParams.delete(key));
        return url.toString();
    } catch (err) {
        return returnUrl;
    }
}

function getSubscriptionReturnUrl() {
    const returnUrl = process.env.CASHFREE_RETURN_URL ||
        `${getPublicBaseUrl()}/home.html`;
    return stripPaymentReturnParams(returnUrl);
}

function requireCredentials() {
    const clientId = process.env.CASHFREE_APP_ID || process.env.CASHFREE_CLIENT_ID;
    const clientSecret = process.env.CASHFREE_SECRET_KEY || process.env.CASHFREE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        const err = new Error('Cashfree is not configured. Set CASHFREE_APP_ID and CASHFREE_SECRET_KEY.');
        err.status = 500;
        throw err;
    }

    return { clientId, clientSecret };
}

function buildHeaders(extra = {}) {
    const { clientId, clientSecret } = requireCredentials();
    return {
        'Content-Type': 'application/json',
        'x-api-version': API_VERSION,
        'x-client-id': clientId,
        'x-client-secret': clientSecret,
        ...extra
    };
}

async function cashfreeRequest(path, options = {}) {
    const response = await fetch(`${getBaseUrl()}${path}`, {
        ...options,
        headers: buildHeaders(options.headers || {})
    });
    const text = await response.text();
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    } catch (err) {
        data = { raw: text };
    }

    if (!response.ok) {
        const error = new Error(data.message || data.error_description || data.error || 'Cashfree request failed');
        error.status = response.status;
        error.data = data;
        throw error;
    }

    return data;
}

function plusYears(date, years) {
    const next = new Date(date);
    next.setFullYear(next.getFullYear() + years);
    return next;
}

function plusDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function addCycles(date, intervalType, intervals, cycles) {
    const next = new Date(date);
    const total = Math.max(1, Number(intervals || 1)) * Math.max(1, Number(cycles || 1));
    const type = String(intervalType || 'MONTH').toUpperCase();

    if (type === 'DAY') next.setDate(next.getDate() + total);
    else if (type === 'WEEK') next.setDate(next.getDate() + (total * 7));
    else if (type === 'YEAR') next.setFullYear(next.getFullYear() + total);
    else next.setMonth(next.getMonth() + total);

    return next;
}

function buildSubscriptionPayload({ subscriptionId, user }) {
    const amount = Number(process.env.SUBSCRIPTION_AMOUNT || process.env.PRO_PLAN_AMOUNT || 99);
    const maxAmount = Number(process.env.SUBSCRIPTION_MAX_AMOUNT || amount);
    const intervalType = process.env.SUBSCRIPTION_INTERVAL_TYPE || 'MONTH';
    const intervals = Number(process.env.SUBSCRIPTION_INTERVALS || 1);
    const maxCycles = Number(process.env.SUBSCRIPTION_MAX_CYCLES || 12);
    const authAmount = Number(process.env.SUBSCRIPTION_AUTH_AMOUNT || 1);
    const planName = process.env.SUBSCRIPTION_PLAN_NAME || 'Xyron Notes Pro';
    const firstChargeDelayDays = Number(process.env.SUBSCRIPTION_FIRST_CHARGE_DELAY_DAYS || 1);
    const firstCharge = plusDays(new Date(), Math.max(1, firstChargeDelayDays));
    const returnUrl = getSubscriptionReturnUrl();

    return {
        subscription_id: subscriptionId,
        customer_details: {
            customer_name: user.name || 'Xyron Notes Student',
            customer_email: process.env.CASHFREE_DEFAULT_CUSTOMER_EMAIL || `${subscriptionId.toLowerCase()}@xyron-notes.local`,
            customer_phone: String(user.phone || process.env.CASHFREE_DEFAULT_CUSTOMER_PHONE || '9999999999').replace(/\D/g, '').slice(-10) || '9999999999'
        },
        plan_details: {
            plan_name: planName,
            plan_type: 'PERIODIC',
            plan_amount: amount,
            plan_max_amount: maxAmount,
            plan_max_cycles: maxCycles,
            plan_intervals: intervals,
            plan_currency: 'INR',
            plan_interval_type: intervalType,
            plan_note: `${planName} recurring access`
        },
        authorization_details: {
            authorization_amount: authAmount,
            authorization_amount_refund: true,
            payment_methods: ['upi', 'card']
        },
        subscription_meta: {
            return_url: returnUrl,
            notification_channel: ['EMAIL', 'SMS'],
            session_id_expiry: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        },
        subscription_expiry_time: plusYears(new Date(), 3).toISOString(),
        subscription_first_charge_time: firstCharge.toISOString(),
        subscription_tags: {
            user_id: user._id.toString(),
            plan: 'pro'
        }
    };
}

function verifyWebhookSignature(headers, rawBody) {
    const signature = headers['x-webhook-signature'];
    const timestamp = headers['x-webhook-timestamp'];
    if (!signature || !timestamp) return false;

    const { clientSecret } = requireCredentials();
    const computed = crypto
        .createHmac('sha256', clientSecret)
        .update(String(timestamp) + rawBody)
        .digest('base64');

    const computedBuffer = Buffer.from(computed);
    const signatureBuffer = Buffer.from(String(signature));
    return computedBuffer.length === signatureBuffer.length &&
        crypto.timingSafeEqual(computedBuffer, signatureBuffer);
}

module.exports = {
    API_VERSION,
    addCycles,
    buildSubscriptionPayload,
    cashfreeRequest,
    getEnvironment,
    verifyWebhookSignature
};
