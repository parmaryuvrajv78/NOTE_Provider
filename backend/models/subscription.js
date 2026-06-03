const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    subscriptionId: { type: String, unique: true, index: true, required: true },
    cfSubscriptionId: String,
    subscriptionSessionId: String,
    status: { type: String, default: 'created', index: true },
    authorizationStatus: String,
    paymentStatus: String,
    planName: String,
    amount: Number,
    currency: { type: String, default: 'INR' },
    provider: { type: String, default: 'cashfree' },
    environment: { type: String, enum: ['sandbox', 'production'], default: 'sandbox' },
    rawCreateResponse: Object,
    rawVerifyResponse: Object,
    rawWebhookEvents: [{
        type: String,
        eventTime: String,
        payload: Object,
        receivedAt: { type: Date, default: Date.now }
    }],
    activatedAt: Date,
    expiresAt: Date,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

subscriptionSchema.pre('save', function setUpdatedAt(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
