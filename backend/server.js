require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs-extra');
const connectDB = require('./config/db');

// Import Routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const materialRoutes = require('./routes/materials');
const userRoutes = require('./routes/users');
const systemRoutes = require('./routes/system');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to Database
connectDB();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// --- DEBUG ROUTES ---
app.get('/api', (req, res) => {
    res.json({ message: "API is working! Use specific endpoints like /api/login, /api/materials, etc." });
});

// --- MAIN ROUTES ---
app.use('/api', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/users', userRoutes);
app.use('/api/system', systemRoutes);

// Root route
app.get("/", (req, res) => {
    res.send("Backend is running 🚀");
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


