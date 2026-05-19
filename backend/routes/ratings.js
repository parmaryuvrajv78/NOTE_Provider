const express = require('express');
const router = express.Router();
const Rating = require('../models/rating');

// Save/Update a rating
router.post('/submit', async (req, res) => {
    try {
        const { userId, rating, review } = req.body;

        if (!userId || !rating) {
            return res.status(400).json({ error: 'User ID and rating are required' });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }

        // Check if user already rated
        let existingRating = await Rating.findOne({ userId });

        if (existingRating) {
            // Update existing rating
            existingRating.rating = rating;
            existingRating.review = review || existingRating.review;
            existingRating.createdAt = new Date();
            await existingRating.save();
            return res.json({ message: 'Rating updated successfully', rating: existingRating });
        }

        // Create new rating
        const newRating = new Rating({ userId, rating, review });
        await newRating.save();
        res.status(201).json({ message: 'Rating saved successfully', rating: newRating });
    } catch (err) {
        console.error('Error saving rating:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all ratings (for admin)
router.get('/all', async (req, res) => {
    try {
        const ratings = await Rating.find().populate('userId', 'name rollNo branch');
        res.json(ratings);
    } catch (err) {
        console.error('Error fetching ratings:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get user's rating
router.get('/user/:userId', async (req, res) => {
    try {
        const rating = await Rating.findOne({ userId: req.params.userId });
        res.json(rating || null);
    } catch (err) {
        console.error('Error fetching user rating:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get average rating
router.get('/stats', async (req, res) => {
    try {
        const ratings = await Rating.find();
        if (ratings.length === 0) {
            return res.json({ averageRating: 0, totalRatings: 0 });
        }
        const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
        const averageRating = (sum / ratings.length).toFixed(1);
        res.json({ averageRating, totalRatings: ratings.length });
    } catch (err) {
        console.error('Error fetching rating stats:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
