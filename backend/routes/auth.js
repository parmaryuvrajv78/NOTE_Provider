const express = require('express');
const router = express.Router();
const User = require('../models/user');
const passport = require('passport');

function safeUserPayload(user) {
    return {
        id: user._id.toString(),
        name: user.name,
        rollNo: user.rollNo,
        enrollNo: user.enrollNo,
        role: user.role,
        branch: user.branch,
        semester: user.semester,
        adminId: user.adminId ? user.adminId.toString() : null,
        approved: user.approved,
        plan: user.plan || 'free',
        aiQuestionsUsed: user.aiQuestionsUsed || 0
    };
}

function sendGoogleResult(res, payload) {
    const safePayload = JSON.stringify(payload).replace(/</g, '\\u003c');
    res.send(`<!doctype html><html><head><meta charset="utf-8"></head><body><script>
        (function(){
            try { window.opener.postMessage(${safePayload}, '*'); } catch(e) {}
            window.close();
        })();
    </script></body></html>`);
}

// Admins available for student registration
router.get('/admins', async (req, res) => {
    try {
        const admins = await User.find({ role: 'admin', approved: true })
            .select('name rollNo')
            .sort({ name: 1 });

        res.json({
            success: true,
            admins: admins.map(admin => ({
                id: admin._id.toString(),
                name: admin.name || admin.rollNo || 'Admin'
            }))
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Could not load admins' });
    }
});

// 1. Auth: Login
router.post('/login', async (req, res) => {
    try {
        const { rollNo, enrollNo, adminId } = req.body;
        const normalizedRollNo = String(rollNo || '').trim().toUpperCase();
        const normalizedEnrollNo = String(enrollNo || '').trim().toUpperCase();

        if (!normalizedRollNo || !normalizedEnrollNo) {
            return res.status(400).json({ success: false, message: 'Roll and enrollment numbers are required.' });
        }

        let user = await User.findOne({
            rollNo: normalizedRollNo,
            enrollNo: normalizedEnrollNo,
            role: { $in: ['admin', 'superadmin'] }
        });

        if (!user) {
            const studentQuery = {
                rollNo: normalizedRollNo,
                enrollNo: normalizedEnrollNo,
                role: 'student'
            };

            if (adminId) {
                studentQuery.$or = [
                    { adminId },
                    { adminId: { $exists: false } },
                    { adminId: null }
                ];
            }

            user = await User.findOne(studentQuery);
        }

        if (user) {
            if (!user.approved) {
                return res.json({ success: false, message: 'Your request is pending approval.' });
            }
            // Return user format matching previous UI
            return res.json({
                success: true,
                user: safeUserPayload(user)
            });
        }
        res.json({ success: false, message: 'User not found. Please register.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Login Error' });
    }
});

// DEBUG GET ROUTE (For Browser Test)
router.get('/login', (req, res) => {
    res.json({
        message: "Auth Login endpoint is active. Use POST to login.",
        usage: "POST /api/login with { rollNo, enrollNo }"
    });
});

// --- Google OAuth (optional)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    router.get('/auth/google', (req, res, next) => {
        const statePayload = {
            mode: req.query.mode || 'login',
            role: req.query.role || 'student',
            adminId: req.query.adminId || '',
            name: req.query.name || '',
            rollNo: req.query.rollNo || '',
            enrollNo: req.query.enrollNo || '',
            branch: req.query.branch || '',
            semester: req.query.semester || ''
        };
        const options = { scope: ['profile', 'email'] };
        options.state = Buffer.from(JSON.stringify(statePayload)).toString('base64url');
        passport.authenticate('google', options)(req, res, next);
    });

    router.get('/auth/google/callback', (req, res, next) => {
        passport.authenticate('google', (err, user, info) => {
            if (err) {
                console.error('Google OAuth callback error:', err.message || err);
                return sendGoogleResult(res, { success: false, message: 'Google sign-in failed. Please try again.' });
            }

            if (!user) {
                return sendGoogleResult(res, {
                    success: false,
                    message: (info && info.message) || 'Google sign-in failed.'
                });
            }

            if (!user.approved) {
                return sendGoogleResult(res, {
                    success: false,
                    pending: true,
                    message: (info && info.message) || 'Your Google request is pending admin approval.'
                });
            }

            req.logIn(user, loginErr => {
                if (loginErr) {
                    console.error('Google login session error:', loginErr.message || loginErr);
                    return sendGoogleResult(res, { success: false, message: 'Google sign-in failed. Please try again.' });
                }

                return sendGoogleResult(res, {
                    success: true,
                    user: safeUserPayload(user)
                });
            });
        })(req, res, next);
    });
} else {
    router.get('/auth/google', (req, res) => {
        sendGoogleResult(res, { success: false, message: 'Google OAuth is not configured on the server.' });
    });
    router.get('/auth/google/callback', (req, res) => {
        sendGoogleResult(res, { success: false, message: 'Google OAuth is not configured on the server.' });
    });
}

// 2. Auth: Register
router.post('/register', async (req, res) => {
    try {
        const userData = req.body;
        const adminId = userData.adminId;
        const requestedRole = userData.role === 'admin' ? 'admin' : 'student';
        const normalizedRollNo = String(userData.rollNo || '').trim().toUpperCase();
        const normalizedEnrollNo = String(userData.enrollNo || '').trim().toUpperCase();

        if (!normalizedRollNo || !normalizedEnrollNo || !userData.name) {
            return res.json({ success: false, message: 'Name, roll number, and enrollment number are required.' });
        }

        if (requestedRole === 'admin') {
            const exists = await User.findOne({
                role: { $in: ['admin', 'superadmin'] },
                $or: [
                    { rollNo: normalizedRollNo },
                    { enrollNo: normalizedEnrollNo }
                ]
            });

            if (exists) {
                return res.json({ success: false, message: 'Roll or Enrollment Number already exists.' });
            }

            const newAdmin = new User({
                name: userData.name,
                rollNo: normalizedRollNo,
                enrollNo: normalizedEnrollNo,
                branch: userData.branch,
                semester: userData.semester,
                role: 'admin',
                approved: false
            });

            await newAdmin.save();
            return res.json({ success: true, message: 'Admin registration request sent to super admin.' });
        }

        if (!adminId) {
            return res.json({ success: false, message: 'Please select the admin/institute for your request.' });
        }

        const admin = await User.findOne({ _id: adminId, role: 'admin', approved: true });
        if (!admin) {
            return res.json({ success: false, message: 'Selected admin was not found.' });
        }

        const exists = await User.findOne({
            adminId: admin._id,
            role: { $ne: 'admin' },
            $or: [
                { rollNo: normalizedRollNo },
                { enrollNo: normalizedEnrollNo }
            ]
        });

        if (exists) {
            return res.json({ success: false, message: 'Roll or Enrollment Number already exists.' });
        }

        const newUser = new User({
            name: userData.name,
            rollNo: normalizedRollNo,
            enrollNo: normalizedEnrollNo,
            branch: userData.branch,
            semester: userData.semester,
            adminId: admin._id,
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
