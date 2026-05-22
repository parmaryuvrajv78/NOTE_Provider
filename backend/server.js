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
const superAdminRoutes = require('./routes/superadmin');
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

function normalizeUpper(value) {
    return String(value || '').trim().toUpperCase();
}

function parseGoogleState(rawState) {
    try {
        if (!rawState) return {};
        const decoded = Buffer.from(String(rawState), 'base64url').toString('utf8');
        return JSON.parse(decoded);
    } catch (err) {
        return { adminId: String(rawState || '').trim() };
    }
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
            const state = parseGoogleState(req.query.state);
            const mode = state.mode === 'register' ? 'register' : 'login';
            const adminId = String(state.adminId || '').trim();
            const phone = String(state.phone || '').trim();
            const instituteName = String(state.instituteName || '').trim();
            const requestedRole = state.role === 'admin' || (mode === 'register' && phone && instituteName) ? 'admin' : 'student';
            const rollNo = requestedRole === 'admin' ? '' : normalizeUpper(state.rollNo);
            const enrollNo = requestedRole === 'admin' ? '' : normalizeUpper(state.enrollNo);
            const email = (profile.emails && profile.emails[0] && profile.emails[0].value || '').toLowerCase();
            const name = String(state.name || profile.displayName || (email ? email.split('@')[0] : 'Google User')).trim();
            const adminIdentifier = normalizeUpper(phone || state.rollNo);

            let user = await User.findOne({ googleId: profile.id });
            if (!user && email) {
                user = await User.findOne({ email });
            }
            if (!user && mode === 'login') {
                user = await User.findOne({
                    role: { $in: ['admin', 'superadmin'] },
                    $or: [
                        { adminCode: rollNo },
                        { rollNo },
                        { phone: phone || rollNo }
                    ]
                });

                if (!user && rollNo && enrollNo) {
                    const studentQuery = { rollNo, enrollNo, role: 'student' };
                    if (adminId) {
                        studentQuery.$or = [
                            { adminId },
                            { adminId: { $exists: false } },
                            { adminId: null }
                        ];
                    }
                    user = await User.findOne(studentQuery);
                }
            }

            if (user) {
                if (user.googleId && user.googleId !== profile.id) {
                    return done(null, false, { message: 'These details are already linked to another Google account.' });
                }
                if (mode === 'register' && requestedRole === 'admin' && user.role === 'student') {
                    return done(null, false, { message: 'This Google account is already registered as a student. Use a different Google account for teacher access.' });
                }
                if (mode === 'register' && requestedRole === 'student' && ['admin', 'superadmin'].includes(user.role)) {
                    return done(null, false, { message: 'This Google account is already registered as a teacher/admin.' });
                }
                if (requestedRole === 'student' && user.role === 'student' && (rollNo || enrollNo)) {
                    if (!rollNo || !enrollNo || normalizeUpper(user.rollNo) !== rollNo || normalizeUpper(user.enrollNo) !== enrollNo) {
                        return done(null, false, { message: 'Google account does not match the entered roll/enrollment details.' });
                    }
                }
                if (['admin', 'superadmin'].includes(user.role) && adminIdentifier && ![normalizeUpper(user.adminCode), normalizeUpper(user.rollNo), String(user.phone || '').toUpperCase()].includes(adminIdentifier)) {
                    return done(null, false, { message: 'Google account does not match the entered admin ID.' });
                }

                let changed = false;
                if (!user.googleId) {
                    user.googleId = profile.id;
                    changed = true;
                }
                if (!user.email && email) {
                    user.email = email;
                    changed = true;
                }
                if (user.role === 'student' && !user.adminId && isValidObjectId(adminId)) {
                    const admin = await User.findOne({ _id: adminId, role: 'admin', approved: true });
                    if (admin) {
                        user.adminId = admin._id;
                        changed = true;
                    }
                }
                if (changed) await user.save();
                return done(null, user);
            }

            if (mode !== 'register') {
                return done(null, false, { message: 'Google account not found. Please register with all required details first.' });
            }

            if (requestedRole === 'admin') {
                if (!name || !phone || !instituteName) {
                    return done(null, false, { message: 'Teacher name, teacher ID, and institute name are required before Google registration.' });
                }
                const adminCode = phone.toUpperCase();
                const duplicateChecks = [{ phone }, { adminCode }];
                if (instituteName) {
                    duplicateChecks.push({ instituteName: new RegExp(`^${instituteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
                }
                const exists = await User.findOne({
                    role: { $in: ['admin', 'superadmin'] },
                    $or: duplicateChecks
                });
                if (exists) {
                    return done(null, false, { message: 'Teacher ID already exists.' });
                }

                user = new User({
                    name,
                    googleId: profile.id,
                    email,
                    phone,
                    instituteName,
                    adminCode,
                    rollNo: adminCode,
                    enrollNo: adminCode,
                    branch: 'Teacher',
                    role: 'admin',
                    approved: false
                });
                await user.save();
                return done(null, user, { message: 'Google admin request sent to super admin for approval.' });
            }

            if (!name || !rollNo || !enrollNo) {
                return done(null, false, { message: 'Student name, roll number, and enrollment number are required before Google registration.' });
            }

            if (!isValidObjectId(adminId)) {
                return done(null, false, { message: 'Please select your admin before Google registration.' });
            }

            const admin = await User.findOne({ _id: adminId, role: 'admin', approved: true });
            if (!admin) {
                return done(null, false, { message: 'Selected admin was not found.' });
            }

            const exists = await User.findOne({
                adminId: admin._id,
                role: 'student',
                $or: [{ rollNo }, { enrollNo }]
            });
            if (exists) {
                return done(null, false, { message: 'Roll or Enrollment Number already exists.' });
            }

            user = new User({
                name,
                googleId: profile.id,
                email,
                instituteName: admin.instituteName,
                rollNo,
                enrollNo,
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
app.use('/api/superadmin', superAdminRoutes);
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
