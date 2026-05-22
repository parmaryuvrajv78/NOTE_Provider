const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Material = require('../models/material');
const QuizScore = require('../models/quizScore');

function idEquals(a, b) {
    return a && b && a.toString() === b.toString();
}

function ownerScope(field, ownerId, includeUnassigned = true) {
    const owned = { [field]: ownerId };
    if (!includeUnassigned) return owned;
    return {
        $or: [
            owned,
            { [field]: { $exists: false } },
            { [field]: null }
        ]
    };
}

function serializeQuizScore(score) {
    const obj = score.toObject();
    const student = obj.userId && typeof obj.userId === 'object' ? obj.userId : null;
    const material = obj.materialId && typeof obj.materialId === 'object' ? obj.materialId : null;

    return {
        id: obj._id.toString(),
        userId: student && student._id ? student._id.toString() : String(obj.userId || ''),
        studentName: student ? student.name : '',
        studentRollNo: student ? student.rollNo : '',
        materialId: material && material._id ? material._id.toString() : String(obj.materialId || ''),
        quizTitle: obj.quizTitle || (material && material.title) || '',
        subject: obj.subject || (material && material.subject) || '',
        score: obj.score || 0,
        total: obj.total || 0,
        percentage: obj.percentage || 0,
        bestScore: obj.bestScore || 0,
        bestPercentage: obj.bestPercentage || 0,
        attempts: obj.attempts || 0,
        submittedAt: obj.submittedAt
    };
}

async function getAdmin(req, res) {
    const adminId = req.query.adminId || req.body.adminId;
    if (!adminId) {
        res.status(401).json({ success: false, message: 'Admin identification required' });
        return null;
    }

    const admin = await User.findOne({ _id: adminId, role: 'admin', approved: true });
    if (!admin) {
        res.status(403).json({ success: false, message: 'Invalid admin account' });
        return null;
    }

    return admin;
}

// 3. Admin: Get Stats & Lists
router.get('/data', async (req, res) => {
    try {
        const admin = await getAdmin(req, res);
        if (!admin) return;

        const pending = await User.find({
            approved: false,
            role: { $ne: 'admin' },
            ...ownerScope('adminId', admin._id)
        });
        const students = await User.find({
            approved: true,
            role: { $ne: 'admin' },
            ...ownerScope('adminId', admin._id)
        });
        const materials = await Material.find(ownerScope('createdBy', admin._id)).sort({ createdAt: -1 });
        const quizScores = await QuizScore.find({ adminId: admin._id })
            .populate('userId', 'name rollNo enrollNo')
            .populate('materialId', 'title subject')
            .sort({ submittedAt: -1 });

        // format IDs for UI
        const formatUsers = arr => arr.map(u => ({ ...u.toObject(), id: u._id.toString() }));
        const formatMats = arr => arr.map(m => ({ ...m.toObject(), id: m._id.toString() }));

        res.json({
            pending: formatUsers(pending),
            students: formatUsers(students),
            materials: formatMats(materials),
            quizScores: quizScores.map(serializeQuizScore)
        });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// 4. Admin: Approve/Reject/Delete User
router.post('/approve', async (req, res) => {
    try {
        const admin = await getAdmin(req, res);
        if (!admin) return;

        const { id } = req.body;
        const target = await User.findById(id);
        if (!target || target.role === 'admin') return res.status(404).json({ success: false });
        if (target.adminId && !idEquals(target.adminId, admin._id)) {
            return res.status(403).json({ success: false, message: 'This request belongs to another admin' });
        }

        const user = await User.findByIdAndUpdate(id, { approved: true, adminId: admin._id }, { new: true });
        if (!user) return res.status(404).json({ success: false });
        res.json({ success: true, user: { ...user.toObject(), id: user._id.toString() } });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

router.post('/reject', async (req, res) => {
    try {
        const admin = await getAdmin(req, res);
        if (!admin) return;

        const { id } = req.body;
        const target = await User.findById(id);
        if (!target || target.role === 'admin') return res.status(404).json({ success: false });
        if (target.adminId && !idEquals(target.adminId, admin._id)) {
            return res.status(403).json({ success: false, message: 'This request belongs to another admin' });
        }

        await User.findByIdAndDelete(id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

router.delete('/user/:id', async (req, res) => {
    try {
        const admin = await getAdmin(req, res);
        if (!admin) return;

        const target = await User.findById(req.params.id);
        if (!target || target.role === 'admin') return res.status(404).json({ success: false });
        if (target.adminId && !idEquals(target.adminId, admin._id)) {
            return res.status(403).json({ success: false, message: 'This student belongs to another admin' });
        }

        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// 5. Admin: Upgrade user to pro plan (simple admin action)
router.post('/upgrade', async (req, res) => {
    try {
        const admin = await getAdmin(req, res);
        if (!admin) return;

        const { id } = req.body;
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        if (user.role === 'admin') return res.status(400).json({ success: false, message: 'Admins do not need upgrade' });
        if (user.adminId && !idEquals(user.adminId, admin._id)) {
            return res.status(403).json({ success: false, message: 'This student belongs to another admin' });
        }

        user.plan = 'pro';
        if (!user.adminId) user.adminId = admin._id;
        user.aiQuestionsUsed = 0;
        user.aiLastReset = new Date();
        await user.save();

        res.json({ success: true, user: { ...user.toObject(), id: user._id.toString() } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

module.exports = router;
