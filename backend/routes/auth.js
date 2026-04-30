const express = require('express');
const router = express.Router();
const User = require('../models/user');

// 1. Auth: Login
router.post('/login', async (req, res) => {
    try {
        const { rollNo, enrollNo } = req.body;
        const user = await User.findOne({ 
            rollNo: rollNo.toUpperCase(), 
            enrollNo: enrollNo.toUpperCase() 
        });

        if (user) {
            if (!user.approved) {
                return res.json({ success: false, message: 'Your request is pending approval.' });
            }
            // Return user format matching previous UI
            return res.json({ 
                success: true, 
                user: {
                    id: user._id.toString(),
                    name: user.name,
                    rollNo: user.rollNo,
                    enrollNo: user.enrollNo,
                    role: user.role,
                    branch: user.branch,
                    approved: user.approved
                } 
            });
        }
        res.json({ success: false, message: 'User not found. Please register.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Login Error' });
    }
});

// 2. Auth: Register
router.post('/register', async (req, res) => {
    try {
        const userData = req.body;

        const exists = await User.findOne({
            $or: [
                { rollNo: userData.rollNo.toUpperCase() },
                { enrollNo: userData.enrollNo.toUpperCase() }
            ]
        });

        if (exists) {
            return res.json({ success: false, message: 'Roll or Enrollment Number already exists.' });
        }

        const newUser = new User({
            name: userData.name,
            rollNo: userData.rollNo,
            enrollNo: userData.enrollNo,
            branch: userData.branch,
            semester: userData.semester,
            role: 'student',
            approved: false
        });

        await newUser.save();
        res.json({ success: true, message: 'Registration request sent to admin.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error registering user' });
    }
});

module.exports = router;
