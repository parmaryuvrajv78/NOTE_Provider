const express = require('express');
const router = express.Router();
const path = require('path');
const Material = require('../models/material');
const User = require('../models/user');
const QuizScore = require('../models/quizScore');
const { upload, supabase, isSupabaseConfigured } = require('../middlewares/upload');

function idEquals(a, b) {
    return a && b && a.toString() === b.toString();
}

function ownerScope(ownerId, includeUnassigned = true) {
    const owned = { createdBy: ownerId };
    if (!includeUnassigned) return owned;
    return {
        $or: [
            owned,
            { createdBy: { $exists: false } },
            { createdBy: null }
        ]
    };
}

async function getUser(userId) {
    if (!userId) return null;
    try {
        return await User.findById(userId);
    } catch (err) {
        return null;
    }
}

async function getAdmin(adminId) {
    const admin = await getUser(adminId);
    return admin && ['admin', 'superadmin'].includes(admin.role) && admin.approved ? admin : null;
}

function getMaterialOwnerForUser(user) {
    if (!user) return null;
    if (user.role === 'superadmin') return 'all';
    if (user.role === 'admin') return user._id;
    return user.adminId || null;
}

async function canAccessMaterial(mat, userId) {
    if (!mat.createdBy) return true;

    const user = await getUser(userId);
    if (!user || !user.approved) return false;

    const ownerId = getMaterialOwnerForUser(user);
    if (ownerId === 'all') return true;
    return Boolean(ownerId && idEquals(ownerId, mat.createdBy));
}

function serializeMaterial(mat) {
    const obj = mat.toObject();
    if ((obj.type || '').toUpperCase() !== 'LINK') {
        delete obj.fileUrl;
        delete obj.fileName;
    }
    return { ...obj, id: mat._id.toString() };
}

function serializeQuizScore(score) {
    const obj = score.toObject ? score.toObject() : score;
    const material = obj.materialId && typeof obj.materialId === 'object' ? obj.materialId : null;
    const student = obj.userId && typeof obj.userId === 'object' ? obj.userId : null;
    return {
        id: obj._id ? obj._id.toString() : obj.id,
        userId: student && student._id ? student._id.toString() : String(obj.userId || ''),
        studentName: student ? student.name : obj.studentName,
        studentRollNo: student ? student.rollNo : obj.studentRollNo,
        materialId: material && material._id ? material._id.toString() : String(obj.materialId || ''),
        quizTitle: obj.quizTitle || (material && material.title) || '',
        subject: obj.subject || (material && material.subject) || '',
        score: obj.score || 0,
        total: obj.total || 0,
        percentage: obj.percentage || 0,
        bestScore: obj.bestScore || 0,
        bestPercentage: obj.bestPercentage || 0,
        attempts: obj.attempts || 0,
        submittedAt: obj.submittedAt
    };
}

function ensureStorageConfigured(res) {
    if (!isSupabaseConfigured || !process.env.SUPABASE_BUCKET) {
        res.status(500).json({
            success: false,
            message: 'Supabase storage is not configured. Set SUPABASE_URL, SUPABASE_KEY, and SUPABASE_BUCKET.'
        });
        return false;
    }
    return true;
}

// 5. Materials: Get All
router.get('/', async (req, res) => {
    try {
        const user = await getUser(req.query.userId);
        let query = {};

        if (req.query.userId) {
            if (!user || !user.approved) {
                return res.status(403).json({ success: false, message: 'User not allowed to view materials' });
            }

            const ownerId = getMaterialOwnerForUser(user);
            query = ownerId === 'all'
                ? {}
                : ownerId
                ? ownerScope(ownerId)
                : { $or: [{ createdBy: { $exists: false } }, { createdBy: null }] };
        }

        const materials = await Material.find(query).sort({ createdAt: -1 });
        res.json(materials.map(serializeMaterial));
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// Quiz Scores: Student's saved quiz-wise scores
router.get('/quiz-scores', async (req, res) => {
    try {
        const user = await getUser(req.query.userId);
        if (!user || !user.approved) {
            return res.status(403).json({ success: false, message: 'User not allowed to view quiz scores' });
        }

        const materialId = req.query.materialId;
        const query = { userId: user._id };
        if (materialId) query.materialId = materialId;

        const scores = await QuizScore.find(query)
            .populate('materialId', 'title subject category createdBy')
            .sort({ submittedAt: -1 });

        res.json({ success: true, scores: scores.map(serializeQuizScore) });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Could not load quiz scores' });
    }
});

// Quiz Scores: Submit/update one student score for one quiz
router.post('/quiz-scores', async (req, res) => {
    try {
        const { userId, materialId, answers } = req.body;
        const user = await getUser(userId);
        if (!user || !user.approved) {
            return res.status(403).json({ success: false, message: 'User not allowed to submit quiz scores' });
        }

        const mat = await Material.findById(materialId);
        if (!mat || mat.category !== 'Quiz' || !Array.isArray(mat.questions) || mat.questions.length === 0) {
            return res.status(404).json({ success: false, message: 'Quiz not found' });
        }

        const allowedForUser = await canAccessMaterial(mat, userId);
        if (!allowedForUser) {
            return res.status(403).json({ success: false, message: 'This quiz is not available for your admin account.' });
        }

        const selectedAnswers = answers && typeof answers === 'object' ? answers : {};
        let score = 0;
        mat.questions.forEach((question, index) => {
            if (Number(selectedAnswers[index]) === Number(question.correctAnswer)) score++;
        });

        const total = mat.questions.length;
        const percentage = total ? Math.round((score / total) * 100) : 0;
        const existing = await QuizScore.findOne({ userId: user._id, materialId: mat._id });
        const bestScore = Math.max(existing ? existing.bestScore || 0 : 0, score);
        const bestPercentage = Math.max(existing ? existing.bestPercentage || 0 : 0, percentage);

        const saved = await QuizScore.findOneAndUpdate(
            { userId: user._id, materialId: mat._id },
            {
                $set: {
                    adminId: user.adminId || null,
                    subject: mat.subject,
                    quizTitle: mat.title,
                    score,
                    total,
                    percentage,
                    bestScore,
                    bestPercentage,
                    answers: selectedAnswers,
                    submittedAt: new Date()
                },
                $setOnInsert: { createdAt: new Date() },
                $inc: { attempts: 1 }
            },
            { upsert: true, new: true }
        );

        res.json({ success: true, score: serializeQuizScore(saved) });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Could not save quiz score' });
    }
});

// 6. Materials: Upload
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const { title, subject, category, link, questions, adminId } = req.body;
        const file = req.file;
        const admin = await getAdmin(adminId);

        if (!admin) {
            return res.status(403).json({ success: false, message: 'Only a valid admin can upload materials.' });
        }

        // Handle Video Links
        if (category === 'Video' && link) {
            const newMat = new Material({
                title,
                subject,
                category: 'Video',
                type: 'LINK',
                size: 'Link',
                fileUrl: link,
                fileName: 'video_link',
                createdBy: admin._id
            });
            await newMat.save();
            return res.json({ success: true, material: { ...newMat.toObject(), id: newMat._id.toString() } });
        }

        // Handle Quiz Questions
        if (category === 'Quiz' && questions) {
            try {
                const parsedQuestions = typeof questions === 'string' ? JSON.parse(questions) : questions;
                
                const newMat = new Material({
                    title,
                    subject,
                    category: 'Quiz',
                    type: 'QUIZ',
                    size: `${parsedQuestions.length} Questions`,
                    questions: parsedQuestions,
                    fileName: 'quiz',
                    createdBy: admin._id
                });
                await newMat.save();
                return res.json({ success: true, material: { ...newMat.toObject(), id: newMat._id.toString() } });
            } catch (err) {
                return res.status(400).json({ success: false, message: 'Invalid quiz format' });
            }
        }

        // Handle File Uploads
        if (!file) {
            return res.status(400).json({ success: false, message: 'No file uploaded.' });
        }

        if (category === 'Video' && file.mimetype && !file.mimetype.startsWith('video/')) {
            return res.status(400).json({ success: false, message: 'Please upload a valid video file.' });
        }

        if (!ensureStorageConfigured(res)) return;

        const bucketName = process.env.SUPABASE_BUCKET;
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileName = uniqueSuffix + path.extname(file.originalname);

        // Upload to Supabase
        const { data, error } = await supabase.storage
            .from(bucketName)
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

        if (error) {
            console.error("Supabase Upload Error:", error);
            return res.status(500).json({ success: false, message: 'Storage Error' });
        }

        // Store an inline URL. The download route adds the download flag when needed.
        const { data: publicUrlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(fileName);

        const fileUrl = publicUrlData.publicUrl;

        const newMat = new Material({
            title,
            subject,
            category: category || 'Notes',
            type: path.extname(file.originalname).substring(1).toUpperCase(),
            size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
            fileUrl: fileUrl,
            fileName: fileName,
            createdBy: admin._id
        });

        await newMat.save();
        res.json({ success: true, material: { ...newMat.toObject(), id: newMat._id.toString() } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// 7. Materials: Delete
router.delete('/:id', async (req, res) => {
    try {
        const admin = await getAdmin(req.query.adminId);
        if (!admin) {
            return res.status(403).json({ success: false, message: 'Only a valid admin can delete materials.' });
        }

        const mat = await Material.findById(req.params.id);
        if (!mat) return res.status(404).json({ success: false });
        if (admin.role !== 'superadmin' && mat.createdBy && !idEquals(mat.createdBy, admin._id)) {
            return res.status(403).json({ success: false, message: 'This material belongs to another admin.' });
        }

        // Delete from Supabase
        if (mat.fileName && !['LINK', 'QUIZ'].includes((mat.type || '').toUpperCase())) {
            if (!ensureStorageConfigured(res)) return;

            const bucketName = process.env.SUPABASE_BUCKET;
            const { error } = await supabase.storage
                .from(bucketName)
                .remove([mat.fileName]);

            if (error) {
                console.error("Error deleting from Supabase:", error);
                // Decide if we should still delete from DB or not
            }
        }

        await Material.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});


// 8. Materials: Download (FIXED)
router.get('/download/:id', async (req, res) => {
    try {
        const mat = await Material.findById(req.params.id);
        if (!mat) {
            return res.status(404).json({ success: false, message: 'Material not found' });
        }

        const userId = req.query.userId;
        const allowedForUser = await canAccessMaterial(mat, userId);
        if (!allowedForUser) {
            return res.status(403).json({ success: false, message: 'This material is not available for your admin account.' });
        }

        // If it's a link type, allow redirect without gating
        if (mat.type === 'LINK') {
            return res.redirect(mat.fileUrl);
        }

        // Require user identification to allow downloads for pro users
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User identification required for download' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(403).json({ success: false, message: 'User not found' });

        // Allow admins or pro plan users to download
        if (!['admin', 'superadmin'].includes(user.role) && user.plan !== 'pro') {
            return res.status(403).json({ success: false, message: 'Download is available only for upgraded users. Please upgrade your plan.' });
        }

        if (!ensureStorageConfigured(res)) return;

        const bucketName = process.env.SUPABASE_BUCKET;

        // Stream file from Supabase through the server so the storage URL is never exposed to client
        const { data, error } = await supabase.storage.from(bucketName).download(mat.fileName);
        if (error || !data) {
            console.error('Supabase download error', error);
            return res.status(500).json({ success: false, message: 'Storage error' });
        }

        // Determine MIME type fallback
        const ext = (mat.type || 'pdf').toString().toLowerCase();
        let mimeType = 'application/octet-stream';
        if (ext === 'pdf') mimeType = 'application/pdf';
        else if (['mp4', 'webm', 'ogg', 'mov', 'mkv'].includes(ext)) mimeType = `video/${ext}`;
        else if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) mimeType = `image/${ext}`;
        else if (ext === 'txt') mimeType = 'text/plain';

        const filename = `${mat.title.replace(/[^a-z0-9_.-]/gi, '_')}.${ext}`;

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // data can be a Node readable stream or have arrayBuffer() - handle common cases
        try {
            if (data instanceof Buffer) {
                return res.send(data);
            }

            if (typeof data.arrayBuffer === 'function') {
                const ab = await data.arrayBuffer();
                return res.send(Buffer.from(ab));
            }

            if (data && typeof data.pipe === 'function') {
                return data.pipe(res);
            }

            if (data && data.body && typeof data.body.pipe === 'function') {
                return data.body.pipe(res);
            }

            // Last resort: create a short signed URL and proxy via fetch
            const { data: signedData, error: signedErr } = await supabase.storage.from(bucketName).createSignedUrl(mat.fileName, 60);
            if (signedErr || !signedData) {
                console.error('Supabase signed url error', signedErr);
                return res.status(500).json({ success: false, message: 'Storage error' });
            }
            const signedUrl = signedData.signedUrl || signedData.signedURL;
            const nodeFetch = globalThis.fetch || (await import('node-fetch')).default;
            const fetchRes = await nodeFetch(signedUrl);
            res.setHeader('Content-Type', fetchRes.headers.get('content-type') || mimeType);
            fetchRes.body.pipe(res);
        } catch (streamErr) {
            console.error('Error streaming file', streamErr);
            return res.status(500).json({ success: false, message: 'Error streaming file' });
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// 9. Materials: View (Inline)
router.get('/view/:id', async (req, res) => {
    try {
        const mat = await Material.findById(req.params.id);
        if (!mat) {
            return res.status(404).json({ success: false, message: 'Material not found' });
        }

        const userId = req.query.userId;
        const allowedForUser = await canAccessMaterial(mat, userId);
        if (!allowedForUser) {
            return res.status(403).json({ success: false, message: 'This material is not available for your admin account.' });
        }

        if (mat.type === 'LINK') {
            return res.redirect(mat.fileUrl);
        }

        if (!ensureStorageConfigured(res)) return;

        const bucketName = process.env.SUPABASE_BUCKET;
        const { data, error } = await supabase.storage.from(bucketName).download(mat.fileName);
        if (error || !data) {
            console.error('Supabase download error (view)', error);
            return res.status(500).json({ success: false, message: 'Storage error' });
        }

        const ext = (mat.type || 'pdf').toString().toLowerCase();
        let mimeType = 'application/octet-stream';
        if (ext === 'pdf') mimeType = 'application/pdf';
        else if (['mp4', 'webm', 'ogg', 'mov', 'mkv'].includes(ext)) mimeType = `video/${ext}`;
        else if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) mimeType = `image/${ext}`;
        else if (ext === 'txt') mimeType = 'text/plain';

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${mat.title.replace(/[^a-z0-9_.-]/gi, '_')}.${ext}"`);

        try {
            if (data instanceof Buffer) {
                return res.send(data);
            }
            if (typeof data.arrayBuffer === 'function') {
                const ab = await data.arrayBuffer();
                return res.send(Buffer.from(ab));
            }
            if (data && typeof data.pipe === 'function') {
                return data.pipe(res);
            }
            if (data && data.body && typeof data.body.pipe === 'function') {
                return data.body.pipe(res);
            }

            // Fallback: fetch via signed URL and pipe
            const { data: signedData, error: signedErr } = await supabase.storage.from(bucketName).createSignedUrl(mat.fileName, 60);
            if (signedErr || !signedData) {
                console.error('Supabase signed url error (view)', signedErr);
                return res.status(500).json({ success: false, message: 'Storage error' });
            }
            const signedUrl = signedData.signedUrl || signedData.signedURL;
            const nodeFetch = globalThis.fetch || (await import('node-fetch')).default;
            const fetchRes = await nodeFetch(signedUrl);
            res.setHeader('Content-Type', fetchRes.headers.get('content-type') || mimeType);
            fetchRes.body.pipe(res);
        } catch (streamErr) {
            console.error('Error streaming view file', streamErr);
            return res.status(500).json({ success: false, message: 'Error streaming file' });
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

module.exports = router;
