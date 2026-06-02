const express = require('express');
const router = express.Router();
const User = require('../models/user');
const { upload, supabase, isSupabaseConfigured } = require('../middlewares/upload');

function serializeUser(user) {
    const teacher = user.adminId && typeof user.adminId === 'object' ? user.adminId : null;
    return {
        id: user._id.toString(),
        name: user.name,
        phone: user.phone,
        instituteName: user.instituteName || (teacher ? teacher.instituteName : undefined),
        teacherName: teacher ? teacher.name : undefined,
        profileImageUrl: user.profileImageUrl,
        adminCode: user.adminCode,
        rollNo: user.rollNo,
        enrollNo: user.enrollNo,
        role: user.role,
        branch: user.branch,
        semester: user.semester,
        adminId: user.adminId ? (teacher ? teacher._id.toString() : user.adminId.toString()) : null,
        approved: user.approved,
        plan: user.plan || 'free',
        aiQuestionsUsed: user.aiQuestionsUsed || 0
    };
}

async function saveProfileImage(user, file) {
    if (!file) return;

    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
        const err = new Error('Please upload a valid image file.');
        err.status = 400;
        throw err;
    }

    if (file.size > 5 * 1024 * 1024) {
        const err = new Error('Profile image must be 5 MB or smaller.');
        err.status = 400;
        throw err;
    }

    const bucketName = process.env.SUPABASE_BUCKET;
    const canUseStorage = isSupabaseConfigured && bucketName;

    if (canUseStorage) {
        const extension = (file.originalname.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase();
        const fileName = `profiles/${user._id}-${Date.now()}.${extension}`;

        const { error } = await supabase.storage
            .from(bucketName)
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

        if (!error) {
            if (user.profileImageName) {
                supabase.storage.from(bucketName).remove([user.profileImageName]).catch(() => {});
            }

            const { data: publicUrlData } = supabase.storage
                .from(bucketName)
                .getPublicUrl(fileName);

            user.profileImageUrl = publicUrlData.publicUrl;
            user.profileImageName = fileName;
            return;
        }

        console.error('Profile image storage upload failed, using database fallback:', error);
    }

    user.profileImageUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    user.profileImageName = '';
}

router.put('/profile', upload.single('profileImage'), async (req, res) => {
    try {
        const userId = req.body.userId;
        const file = req.file;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'User is required.' });
        }

        const user = await User.findById(userId);
        if (!user || !user.approved) {
            return res.status(403).json({ success: false, message: 'User not allowed to update profile.' });
        }

        const name = String(req.body.name || '').trim();
        const branch = String(req.body.branch || '').trim();
        const semester = String(req.body.semester || '').trim();
        const instituteName = String(req.body.instituteName || '').trim();

        if (!name) {
            return res.status(400).json({ success: false, message: 'Name is required.' });
        }

        user.name = name;
        user.branch = branch;
        user.semester = semester;

        if (['admin', 'superadmin'].includes(user.role) && instituteName) {
            user.instituteName = instituteName;
        }

        if (file) {
            await saveProfileImage(user, file);
        }

        await user.save();
        await user.populate('adminId', 'name instituteName');
        res.json({ success: true, user: serializeUser(user) });
    } catch (err) {
        console.error('Profile update error:', err);
        res.status(err.status || 500).json({ success: false, message: err.message || 'Could not update profile.' });
    }
});

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
