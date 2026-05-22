require('dotenv').config();
console.log("CLIENT ID:", process.env.GOOGLE_CLIENT_ID);
console.log("CLIENT SECRET:", process.env.GOOGLE_CLIENT_SECRET);
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs-extra');
const connectDB = require('./config/db');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Import Routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const materialRoutes = require('./routes/materials');
const userRoutes = require('./routes/users');
const systemRoutes = require('./routes/system');
const chatRoutes = require('./routes/chat');
const ratingRoutes = require('./routes/ratings');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to Database
connectDB();

// Middleware
app.use(cors({
    origin: '*', // Allow all origins including file://
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());

// Session + Passport (for Google OAuth)
app.use(session({
    secret: process.env.SESSION_SECRET || 'keyboard cat',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));
app.use(passport.initialize());
app.use(passport.session());

// Passport user serialization
passport.serializeUser((user, done) => {
    done(null, user._id);
});
passport.deserializeUser(async (id, done) => {
    try {
        const User = require('./models/user');
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});

// Google OAuth strategy — only initialize if credentials are available
const googleClientID = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
function isValidObjectId(id) {
    return /^[0-9a-fA-F]{24}$/.test(String(id || ''));
}

if (googleClientID && googleClientSecret) {
    passport.use(new GoogleStrategy({
        clientID: googleClientID,
        clientSecret: googleClientSecret,
        callbackURL: `${process.env.BASE_URL || 'http://localhost:3000'}/api/auth/google/callback`,
        passReqToCallback: true
    }, async (req, accessToken, refreshToken, profile, done) => {
        try {
            const User = require('./models/user');
            const adminId = String(req.query.state || '').trim();
            const email = (profile.emails && profile.emails[0] && profile.emails[0].value || '').toLowerCase();
            const name = profile.displayName || (email ? email.split('@')[0] : 'Google User');
            let user = await User.findOne({ googleId: profile.id });
            if (!user && email) {
                user = await User.findOne({ email });
            }

            if (user) {
                let changed = false;
                if (!user.googleId) {
                    user.googleId = profile.id;
                    changed = true;
                }
                if (!user.email && email) {
                    user.email = email;
                    changed = true;
                }
                if (user.role !== 'admin' && !user.adminId && isValidObjectId(adminId)) {
                    const admin = await User.findOne({ _id: adminId, role: 'admin', approved: true });
                    if (admin) {
                        user.adminId = admin._id;
                        changed = true;
                    }
                }
                if (changed) await user.save();
                return done(null, user);
            }

            if (!isValidObjectId(adminId)) {
                return done(null, false, { message: 'Please select your admin before using Google sign-in.' });
            }

            const admin = await User.findOne({ _id: adminId, role: 'admin', approved: true });
            if (!admin) {
                return done(null, false, { message: 'Selected admin was not found.' });
            }

            user = new User({
                name,
                googleId: profile.id,
                email,
                rollNo: `GOOGLE_${profile.id}`.toUpperCase(),
                enrollNo: `GOOGLE_${profile.id}`.toUpperCase(),
                adminId: admin._id,
                role: 'student',
                approved: false
            });
            await user.save();
            done(null, user, { message: 'Google registration request sent to admin for approval.' });
        } catch (err) {
            done(err);
        }
    }));
} else {
    console.warn('Google OAuth not configured — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env to enable it.');
}

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
app.use('/api/materials', materialRoutes);
app.use('/api/users', userRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/ratings', ratingRoutes);
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
    res.send("Backend is running 🚀");
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
