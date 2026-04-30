const express = require('express');
const router = express.Router();
const User = require('../models/user');

// Toggle Favorite
router.post('/toggle-favorite/:materialId', async (req, res) => {
    try {
        const { userId } = req.body;
        const { materialId } = req.params;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const index = user.favorites.indexOf(materialId);
        if (index === -1) {
            user.favorites.push(materialId);
            await user.save();
            return res.json({ status: 'added', favorites: user.favorites });
        } else {
            user.favorites.splice(index, 1);
            await user.save();
            return res.json({ status: 'removed', favorites: user.favorites });
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get Favorites
router.get('/favorites/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).populate('favorites');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user.favorites);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
