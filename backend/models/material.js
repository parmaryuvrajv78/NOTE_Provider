const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema({
    title: String,
    subject: String,
    type: String,
    size: String,
    fileUrl: String,
    fileName: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Material', materialSchema);
