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
const superAdminRoutes = require('./routes/superadmin');
const materialRoutes = require('./routes/materials');
const userRoutes = require('./routes/users');
const systemRoutes = require('./routes/system');
const ratingRoutes = require('./routes/ratings');
const subscriptionRoutes = require('./routes/subscriptions');

const app = express();
const PORT = process.env.PORT || 3000;
const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
const nativeAppOrigins = [
    'https://localhost',
    'capacitor://localhost',
    'ionic://localhost'
];
const corsAllowedOrigins = [...new Set([...allowedOrigins, ...nativeAppOrigins])];
const cspConnectSources = [
    "'self'",
    process.env.BASE_URL || 'http://localhost:3000',
    ...corsAllowedOrigins,
    'https://note-provider-nd4p.onrender.com',
    'https://*.supabase.co',
    'https://*.supabase.in',
    'https://api.cashfree.com',
    'https://sandbox.cashfree.com',
    'https://payments.cashfree.com',
    'https://payments-test.cashfree.com'
].filter(Boolean);

// Connect to Database
connectDB();

// Middleware
app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    res.setHeader(
        'Content-Security-Policy',
        [
            "default-src 'self'",
            "base-uri 'self'",
            "frame-ancestors 'none'",
            "object-src 'none'",
            "script-src 'self' 'unsafe-inline' https://sdk.cashfree.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self' data:",
            `connect-src ${cspConnectSources.join(' ')}`,
            "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://sdk.cashfree.com https://api.cashfree.com https://sandbox.cashfree.com https://payments.cashfree.com https://payments-test.cashfree.com",
            "media-src 'self' data: blob: https:"
        ].join('; ')
    );
    next();
});
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.length === 0 || corsAllowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json({
    verify: (req, res, buf) => {
        req.rawBody = buf.toString('utf8');
    }
}));

// Request Logger
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// --- DEBUG ROUTES ---
app.get('/api', (req, res) => {
    res.json({ message: "API is working! Use specific endpoints like /api/login, /api/materials, etc." });
});

// --- MAIN ROUTES ---
app.use('/api', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/users', userRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Serve the frontend locally when this repo is running as a single app.
const frontendPath = path.join(__dirname, '..', 'frontend');
if (fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
}

// Root route
app.get("/", (req, res) => {
    res.send("Backend is running");
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
