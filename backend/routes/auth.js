const express = require('express');
const router = express.Router();
const User = require('../models/user');
const passport = require('passport');

function safeUserPayload(user) {
    return {
        id: user._id.toString(),
        name: user.name,
        phone: user.phone,
        instituteName: user.instituteName,
        adminCode: user.adminCode,
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
            .select('name rollNo phone instituteName adminCode')
            .sort({ instituteName: 1, name: 1 });

        res.json({
            success: true,
            admins: admins.map(admin => ({
                id: admin._id.toString(),
                name: admin.instituteName || admin.name || admin.adminCode || admin.rollNo || 'Admin'
            }))
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Could not load admins' });
    }
});

// 1. Auth: Login
router.post('/login', async (req, res) => {
    try {
        const { rollNo, enrollNo, adminId, identifier } = req.body;
        const normalizedRollNo = String(rollNo || identifier || '').trim().toUpperCase();
        const normalizedEnrollNo = String(enrollNo || '').trim().toUpperCase();
        const normalizedPhone = String(rollNo || identifier || '').replace(/\D/g, '');

        if (!normalizedRollNo) {
            return res.status(400).json({ success: false, message: 'Student ID or Admin ID is required.' });
        }

        if (normalizedRollNo === 'PU50' && normalizedEnrollNo === '2503051050905') {
            const superAdmin = await User.findOneAndUpdate(
                { rollNo: 'PU50', enrollNo: '2503051050905' },
                {
                    $set: {
                        name: 'Yuvraj',
                        adminCode: 'PU50',
                        instituteName: 'Shniro Notes',
                        role: 'superadmin',
                        approved: true
                    }
                },
                { upsert: true, new: true }
            );

            return res.json({
                success: true,
                user: safeUserPayload(superAdmin)
            });
        }

        let user = await User.findOne({
            role: { $in: ['admin', 'superadmin'] },
            $or: [
                { adminCode: normalizedRollNo },
                { rollNo: normalizedRollNo },
                { phone: normalizedPhone || normalizedRollNo }
            ]
        });

        if (!user && normalizedEnrollNo) {
            return res.json({
                success: false,
                message: 'Students must sign in with Google.'
            });
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
        res.json({ success: false, message: 'Admin not found. Students must use Google.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Login Error' });
    }
});

// DEBUG GET ROUTE (For Browser Test)
router.get('/login', (req, res) => {
    res.json({
        message: "Auth Login endpoint is active. Use POST to login.",
        usage: "POST /api/login with { rollNo, enrollNo? }"
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
            phone: req.query.phone || '',
            instituteName: req.query.instituteName || '',
            rollNo: req.query.rollNo || '',
            enrollNo: req.query.enrollNo || '',
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
        const role = req.body.role === 'admin' ? 'admin' : 'student';

        if (role !== 'admin') {
            return res.json({ success: false, message: 'Students must request access with Google.' });
        }

        const name = String(req.body.name || '').trim();
        const teacherId = String(req.body.phone || req.body.adminCode || '').trim().toUpperCase();
        const instituteName = String(req.body.instituteName || '').trim();

        if (!name || !teacherId || !instituteName) {
            return res.json({ success: false, message: 'Teacher name, teacher ID, and institute name are required.' });
        }

        const institutePattern = new RegExp(`^${instituteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
        const exists = await User.findOne({
            role: { $in: ['admin', 'superadmin'] },
            $or: [
                { phone: teacherId },
                { adminCode: teacherId },
                { instituteName: institutePattern }
            ]
        });

        if (exists) {
            return res.json({ success: false, message: 'Teacher ID or institute already exists.' });
        }

        const admin = new User({
            name,
            phone: teacherId,
            instituteName,
            adminCode: teacherId,
            rollNo: teacherId,
            enrollNo: teacherId,
            branch: 'Teacher',
            role: 'admin',
            approved: false
        });

        await admin.save();
        res.json({ success: true, message: 'Teacher request sent to super admin for approval.' });
    } catch (err) {
        console.error('Teacher registration error:', err);
        res.status(500).json({ success: false, message: 'Error registering teacher' });
    }
});

module.exports = router;
