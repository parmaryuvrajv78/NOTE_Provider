const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { supabase } = require('../middlewares/upload');

router.get('/status', async (req, res) => {
    const status = {
        mongodb: 'offline',
        supabase: 'offline',
        render: 'online',
        vercel: 'online' // Assumed since user is browsing
    };

    try {
        // Check MongoDB
        if (mongoose.connection.readyState === 1) {
            status.mongodb = 'online';
        }

        // Check Supabase
        const { data, error } = await supabase.storage.listBuckets();
        if (!error) {
            status.supabase = 'online';
        }

        res.json({ success: true, status });
    } catch (err) {
        res.status(500).json({ success: false, status, message: err.message });
    }
});

module.exports = router;
