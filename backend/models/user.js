const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: String,
    rollNo: { type: String, uppercase: true, unique: true },
    enrollNo: { type: String, uppercase: true, unique: true },
    branch: String,
    semester: String,
    role: { type: String, enum: ['student', 'admin'], default: 'student' },
    approved: { type: Boolean, default: false },
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Material' }],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema, 'student');
