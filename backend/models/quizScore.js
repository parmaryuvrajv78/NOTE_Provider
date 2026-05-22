const mongoose = require('mongoose');

const quizScoreSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', index: true, required: true },
    subject: String,
    quizTitle: String,
    score: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    bestScore: { type: Number, default: 0 },
    bestPercentage: { type: Number, default: 0 },
    attempts: { type: Number, default: 1 },
    answers: { type: Object, default: {} },
    submittedAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
});

quizScoreSchema.index({ userId: 1, materialId: 1 }, { unique: true });

module.exports = mongoose.model('QuizScore', quizScoreSchema, 'quiz_scores');
