const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    question: String,
    options: [String],
    correctAnswer: Number,  // Index of correct option
    explanation: String
});

const materialSchema = new mongoose.Schema({
    title: String,
    subject: String,
    category: String,
    type: String,
    size: String,
    fileUrl: String,
    fileName: String,
    // Quiz-specific fields
    questions: [questionSchema],  // Array of questions for quizzes
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Material', materialSchema);
