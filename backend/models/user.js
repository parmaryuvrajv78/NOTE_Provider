const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: String,
    phone: { type: String, index: true },
    instituteName: { type: String, index: true },
    profileImageUrl: String,
    profileImageName: String,
    adminCode: { type: String, uppercase: true, index: true },
    rollNo: { type: String, uppercase: true, index: true },
    enrollNo: { type: String, uppercase: true, index: true },
    branch: String,
    semester: String,
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
    role: { type: String, enum: ['student', 'admin', 'superadmin'], default: 'student' },
    approved: { type: Boolean, default: false },
    // Billing / plan: 'free' users have limited AI queries and cannot download materials
    plan: { type: String, enum: ['free', 'pro'], default: 'free' },
    // AI usage tracking: resets daily (server enforces reset based on aiLastReset)
    aiQuestionsUsed: { type: Number, default: 0 },
    aiLastReset: { type: Date, default: new Date(0) },
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Material' }],
    createdAt: { type: Date, default: Date.now }
});

userSchema.index(
    { adminId: 1, rollNo: 1 },
    { unique: true, partialFilterExpression: { role: 'student', adminId: { $type: 'objectId' } } }
);
userSchema.index(
    { adminId: 1, enrollNo: 1 },
    { unique: true, partialFilterExpression: { role: 'student', adminId: { $type: 'objectId' } } }
);

module.exports = mongoose.model('User', userSchema, 'student');
