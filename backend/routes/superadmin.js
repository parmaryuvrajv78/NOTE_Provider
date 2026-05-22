const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Material = require('../models/material');

async function getSuperAdmin(req, res) {
    const superAdminId = req.query.superAdminId || req.body.superAdminId;
    if (!superAdminId) {
        res.status(401).json({ success: false, message: 'Super admin identification required' });
        return null;
    }

    const superAdmin = await User.findOne({ _id: superAdminId, role: 'superadmin', approved: true });
    if (!superAdmin) {
        res.status(403).json({ success: false, message: 'Invalid super admin account' });
        return null;
    }

    return superAdmin;
}

function serializeUser(user) {
    return { ...user.toObject(), id: user._id.toString() };
}

function serializeMaterial(material) {
    return { ...material.toObject(), id: material._id.toString() };
}

router.get('/data', async (req, res) => {
    try {
        const superAdmin = await getSuperAdmin(req, res);
        if (!superAdmin) return;

        const [pendingAdmins, admins, pendingStudents, students, materials] = await Promise.all([
            User.find({ role: 'admin', approved: false }).sort({ createdAt: -1 }),
            User.find({ role: 'admin', approved: true }).sort({ name: 1 }),
            User.find({ role: 'student', approved: false }).populate('adminId', 'name rollNo').sort({ createdAt: -1 }),
            User.find({ role: 'student', approved: true }).populate('adminId', 'name rollNo').sort({ createdAt: -1 }),
            Material.find({}).populate('createdBy', 'name rollNo role').sort({ createdAt: -1 })
        ]);

        res.json({
            pendingAdmins: pendingAdmins.map(serializeUser),
            admins: admins.map(serializeUser),
            pendingStudents: pendingStudents.map(serializeUser),
            students: students.map(serializeUser),
            materials: materials.map(serializeMaterial)
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Could not load super admin data' });
    }
});

router.post('/approve-admin', async (req, res) => {
    try {
        const superAdmin = await getSuperAdmin(req, res);
        if (!superAdmin) return;

        const admin = await User.findOneAndUpdate(
            { _id: req.body.id, role: 'admin' },
            { approved: true },
            { new: true }
        );
        if (!admin) return res.status(404).json({ success: false, message: 'Admin request not found' });
        res.json({ success: true, admin: serializeUser(admin) });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

router.post('/reject-admin', async (req, res) => {
    try {
        const superAdmin = await getSuperAdmin(req, res);
        if (!superAdmin) return;

        const deleted = await User.findOneAndDelete({ _id: req.body.id, role: 'admin', approved: false });
        if (!deleted) return res.status(404).json({ success: false, message: 'Admin request not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

router.delete('/admin/:id', async (req, res) => {
    try {
        const superAdmin = await getSuperAdmin(req, res);
        if (!superAdmin) return;

        const admin = await User.findOneAndDelete({ _id: req.params.id, role: 'admin' });
        if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

        await User.updateMany({ adminId: admin._id }, { $set: { approved: false }, $unset: { adminId: '' } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

router.post('/approve-student', async (req, res) => {
    try {
        const superAdmin = await getSuperAdmin(req, res);
        if (!superAdmin) return;

        const student = await User.findOneAndUpdate(
            { _id: req.body.id, role: 'student' },
            { approved: true },
            { new: true }
        );
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
        res.json({ success: true, student: serializeUser(student) });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

router.post('/reject-student', async (req, res) => {
    try {
        const superAdmin = await getSuperAdmin(req, res);
        if (!superAdmin) return;

        const deleted = await User.findOneAndDelete({ _id: req.body.id, role: 'student', approved: false });
        if (!deleted) return res.status(404).json({ success: false, message: 'Student request not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

router.delete('/student/:id', async (req, res) => {
    try {
        const superAdmin = await getSuperAdmin(req, res);
        if (!superAdmin) return;

        const deleted = await User.findOneAndDelete({ _id: req.params.id, role: 'student' });
        if (!deleted) return res.status(404).json({ success: false, message: 'Student not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

router.post('/upgrade-student', async (req, res) => {
    try {
        const superAdmin = await getSuperAdmin(req, res);
        if (!superAdmin) return;

        const student = await User.findOne({ _id: req.body.id, role: 'student' });
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        student.plan = 'pro';
        student.aiQuestionsUsed = 0;
        student.aiLastReset = new Date();
        await student.save();

        res.json({ success: true, student: serializeUser(student) });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

router.delete('/material/:id', async (req, res) => {
    try {
        const superAdmin = await getSuperAdmin(req, res);
        if (!superAdmin) return;

        const deleted = await Material.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, message: 'Material not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

module.exports = router;
