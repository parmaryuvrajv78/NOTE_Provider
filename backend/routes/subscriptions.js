const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Subscription = require('../models/subscription');
const {
    addCycles,
    buildSubscriptionPayload,
    cashfreeRequest,
    getEnvironment,
    verifyWebhookSignature
} = require('../utils/cashfree');

function isValidObjectId(id) {
    return /^[0-9a-fA-F]{24}$/.test(String(id || ''));
}

function isActiveSubscriptionStatus(status, authorizationStatus) {
    const subStatus = String(status || '').toUpperCase();
    const authStatus = String(authorizationStatus || '').toUpperCase();
    return ['ACTIVE', 'BANK_APPROVAL_PENDING'].includes(subStatus) ||
        ['SUCCESS', 'ACTIVE', 'APPROVED'].includes(authStatus);
}

function serializePlan(user, subscription = null) {
    return {
        plan: user.plan || 'free',
        planStatus: user.planStatus || (user.plan === 'pro' ? 'active' : 'inactive'),
        planExpiresAt: user.planExpiresAt || null,
        cashfreeSubscriptionId: user.cashfreeSubscriptionId || null,
        subscription: subscription ? {
            subscriptionId: subscription.subscriptionId,
            status: subscription.status,
            authorizationStatus: subscription.authorizationStatus,
            amount: subscription.amount,
            currency: subscription.currency,
            expiresAt: subscription.expiresAt
        } : null
    };
}

async function getStudent(userId) {
    if (!isValidObjectId(userId)) return null;
    return await User.findOne({ _id: userId, role: 'student', approved: true });
}

async function activatePlan(user, subscription, cashfreeData = {}) {
    const planDetails = cashfreeData.plan_details || subscription.rawCreateResponse?.plan_details || {};
    const intervalType = planDetails.plan_interval_type || process.env.SUBSCRIPTION_INTERVAL_TYPE || 'MONTH';
    const intervals = planDetails.plan_intervals || process.env.SUBSCRIPTION_INTERVALS || 1;
    const cycles = Number(process.env.SUBSCRIPTION_LOCAL_ACCESS_CYCLES || 1);
    const expiresAt = addCycles(new Date(), intervalType, intervals, cycles);

    user.plan = 'pro';
    user.planStatus = 'active';
    user.planExpiresAt = expiresAt;
    user.cashfreeSubscriptionId = subscription.subscriptionId;
    await user.save();

    subscription.status = cashfreeData.subscription_status || subscription.status || 'ACTIVE';
    subscription.authorizationStatus = cashfreeData.authorization_details?.authorization_status || subscription.authorizationStatus;
    subscription.rawVerifyResponse = cashfreeData;
    subscription.activatedAt = subscription.activatedAt || new Date();
    subscription.expiresAt = expiresAt;
    await subscription.save();
}

async function verifyAndSync(subscription) {
    const data = await cashfreeRequest(`/subscriptions/${encodeURIComponent(subscription.subscriptionId)}`, {
        method: 'GET',
        headers: { accept: 'application/json' }
    });

    const user = await User.findById(subscription.userId);
    if (!user) return { data, user: null, activated: false };

    const authorizationStatus = data.authorization_details?.authorization_status;
    subscription.status = data.subscription_status || subscription.status;
    subscription.authorizationStatus = authorizationStatus || subscription.authorizationStatus;
    subscription.cfSubscriptionId = data.cf_subscription_id || subscription.cfSubscriptionId;
    subscription.rawVerifyResponse = data;

    const activated = isActiveSubscriptionStatus(data.subscription_status, authorizationStatus);
    if (activated) {
        await activatePlan(user, subscription, data);
    } else {
        user.planStatus = 'pending';
        user.cashfreeSubscriptionId = subscription.subscriptionId;
        await user.save();
        await subscription.save();
    }

    return { data, user, activated };
}

router.get('/config', (req, res) => {
    res.json({
        success: true,
        mode: getEnvironment(),
        amount: Number(process.env.SUBSCRIPTION_AMOUNT || process.env.PRO_PLAN_AMOUNT || 99),
        currency: 'INR',
        planName: process.env.SUBSCRIPTION_PLAN_NAME || 'YuVision Pro'
    });
});

router.get('/status', async (req, res) => {
    try {
        const user = await getStudent(req.query.userId);
        if (!user) return res.status(403).json({ success: false, message: 'Valid student account required.' });

        const subscription = await Subscription.findOne({ userId: user._id }).sort({ createdAt: -1 });
        if (user.plan === 'pro' && user.planExpiresAt && user.planExpiresAt < new Date()) {
            user.plan = 'free';
            user.planStatus = 'expired';
            await user.save();
        }

        res.json({ success: true, ...serializePlan(user, subscription) });
    } catch (err) {
        res.status(err.status || 500).json({ success: false, message: err.message || 'Could not load subscription status.' });
    }
});

router.post('/create', async (req, res) => {
    try {
        const user = await getStudent(req.body.userId);
        if (!user) return res.status(403).json({ success: false, message: 'Valid student account required.' });
        if (user.plan === 'pro' && (!user.planExpiresAt || user.planExpiresAt > new Date())) {
            return res.json({ success: true, alreadyActive: true, ...serializePlan(user) });
        }

        const subscriptionId = `YUVISION_${user._id.toString()}_${Date.now()}`;
        const payload = buildSubscriptionPayload({ subscriptionId, user });
        const cashfreeData = await cashfreeRequest('/subscriptions', {
            method: 'POST',
            headers: {
                'x-idempotency-key': subscriptionId
            },
            body: JSON.stringify(payload)
        });

        const subscription = await Subscription.create({
            userId: user._id,
            subscriptionId,
            cfSubscriptionId: cashfreeData.cf_subscription_id,
            subscriptionSessionId: cashfreeData.subscription_session_id,
            status: cashfreeData.subscription_status || 'INITIALIZED',
            authorizationStatus: cashfreeData.authorization_details?.authorization_status,
            planName: payload.plan_details.plan_name,
            amount: payload.plan_details.plan_amount,
            currency: payload.plan_details.plan_currency,
            environment: getEnvironment(),
            rawCreateResponse: cashfreeData
        });

        user.planStatus = 'pending';
        user.cashfreeSubscriptionId = subscriptionId;
        await user.save();

        res.json({
            success: true,
            mode: getEnvironment(),
            subscriptionId,
            subscriptionSessionId: cashfreeData.subscription_session_id,
            subscription: serializePlan(user, subscription).subscription
        });
    } catch (err) {
        console.error('Cashfree subscription create error:', err.data || err);
        res.status(err.status || 500).json({ success: false, message: err.message || 'Could not start Cashfree subscription.' });
    }
});

router.post('/verify', async (req, res) => {
    try {
        const user = await getStudent(req.body.userId);
        if (!user) return res.status(403).json({ success: false, message: 'Valid student account required.' });

        const query = {
            userId: user._id,
            subscriptionId: req.body.subscriptionId || user.cashfreeSubscriptionId
        };
        const subscription = await Subscription.findOne(query);
        if (!subscription) return res.status(404).json({ success: false, message: 'Subscription not found.' });

        const result = await verifyAndSync(subscription);
        res.json({
            success: true,
            activated: result.activated,
            user: {
                id: user._id.toString(),
                plan: result.user.plan,
                planStatus: result.user.planStatus,
                planExpiresAt: result.user.planExpiresAt,
                cashfreeSubscriptionId: result.user.cashfreeSubscriptionId
            },
            subscription: serializePlan(result.user, subscription).subscription
        });
    } catch (err) {
        console.error('Cashfree subscription verify error:', err.data || err);
        res.status(err.status || 500).json({ success: false, message: err.message || 'Could not verify subscription.' });
    }
});

router.post('/webhook', async (req, res) => {
    try {
        const rawBody = req.rawBody || JSON.stringify(req.body || {});
        if (!verifyWebhookSignature(req.headers, rawBody)) {
            return res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
        }

        const payload = req.body || JSON.parse(rawBody);
        const data = payload.data || payload;
        const subscriptionId = data.subscription_id || data.subscription?.subscription_id;
        if (!subscriptionId) return res.json({ success: true });

        const subscription = await Subscription.findOne({ subscriptionId });
        if (!subscription) return res.json({ success: true });

        subscription.rawWebhookEvents.push({
            type: payload.type,
            eventTime: payload.event_time,
            payload
        });
        subscription.status = data.subscription_status || data.subscription?.subscription_status || subscription.status;
        subscription.authorizationStatus = data.authorization_details?.authorization_status || subscription.authorizationStatus;
        subscription.paymentStatus = data.payment_status || data.payment?.payment_status || subscription.paymentStatus;

        if (isActiveSubscriptionStatus(subscription.status, subscription.authorizationStatus)) {
            const user = await User.findById(subscription.userId);
            if (user) await activatePlan(user, subscription, data);
        } else {
            await subscription.save();
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Cashfree subscription webhook error:', err);
        res.status(500).json({ success: false, message: 'Webhook handling failed.' });
    }
});

router.get('/webhook', (req, res) => {
    res.json({
        success: true,
        message: 'Cashfree subscription webhook endpoint is active. Configure Cashfree to send POST events to this URL.'
    });
});

module.exports = router;
