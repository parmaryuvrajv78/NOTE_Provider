const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const MONGO_URI = process.env.MONGO_URI;
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB Atlas.');

        const User = require('../models/user');

        // Ensure PU50 is always the super admin.
        await User.findOneAndUpdate(
            { rollNo: 'PU50', enrollNo: '2503051050905' },
            {
                $set: {
                    name: 'Yuvraj',
                    adminCode: 'PU50',
                    instituteName: 'Floak',
                    role: 'superadmin',
                    approved: true
                }
            },
            { upsert: true, new: true }
        );
        console.log('Default Super Admin ensured (PU50).');
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
        console.log('Please check your MONGO_URI in the .env file.');
    }
};

module.exports = connectDB;
