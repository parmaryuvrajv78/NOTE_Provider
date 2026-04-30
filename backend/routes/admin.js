const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Material = require('../models/material');

// 3. Admin: Get Stats & Lists
router.get('/data', async (req, res) => {
    try {
        const pending = await User.find({ approved: false });
        const students = await User.find({ approved: true, role: { $ne: 'admin' } });
        const materials = await Material.find();

        // format IDs for UI
        const formatUsers = arr => arr.map(u => ({ ...u.toObject(), id: u._id.toString() }));
        const formatMats = arr => arr.map(m => ({ ...m.toObject(), id: m._id.toString() }));

        res.json({
            pending: formatUsers(pending),
            students: formatUsers(students),
            materials: formatMats(materials)
        });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// 4. Admin: Approve/Reject/Delete User
router.post('/approve', async (req, res) => {
    try {
        const { id } = req.body;
        const user = await User.findByIdAndUpdate(id, { approved: true }, { new: true });
        if (!user) return res.status(404).json({ success: false });
        res.json({ success: true, user: { ...user.toObject(), id: user._id.toString() } });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

router.post('/reject', async (req, res) => {
    try {
        const { id } = req.body;
        await User.findByIdAndDelete(id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

router.delete('/user/:id', async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

module.exports = router;
