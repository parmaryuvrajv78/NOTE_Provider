const express = require('express');
const router = express.Router();
const path = require('path');
const Material = require('../models/material');
const { upload, supabase } = require('../middlewares/upload');

// 5. Materials: Get All
router.get('/', async (req, res) => {
    try {
        const materials = await Material.find().sort({ createdAt: -1 });
        const mapped = materials.map(m => ({ ...m.toObject(), id: m._id.toString() }));
        res.json(mapped);
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// 6. Materials: Upload
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const { title, subject, category, link, questions } = req.body;
        const file = req.file;

        // Handle Video Links
        if (category === 'Video' && link) {
            const newMat = new Material({
                title,
                subject,
                category: 'Video',
                type: 'LINK',
                size: 'Link',
                fileUrl: link,
                fileName: 'video_link'
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
                    fileName: 'quiz'
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

        // Get public URL with forced download and original filename
        const { data: publicUrlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(fileName, { download: file.originalname });

        const fileUrl = publicUrlData.publicUrl;

        const newMat = new Material({
            title,
            subject,
            category: category || 'Notes',
            type: path.extname(file.originalname).substring(1).toUpperCase(),
            size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
            fileUrl: fileUrl,
            fileName: fileName
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
        const mat = await Material.findById(req.params.id);
        if (!mat) return res.status(404).json({ success: false });

        // Delete from Supabase
        const bucketName = process.env.SUPABASE_BUCKET;
        const { error } = await supabase.storage
            .from(bucketName)
            .remove([mat.fileName]);

        if (error) {
            console.error("Error deleting from Supabase:", error);
            // Decide if we should still delete from DB or not
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

        if (mat.type === 'LINK') {
            return res.redirect(mat.fileUrl);
        }

        const bucketName = process.env.SUPABASE_BUCKET;

        // Get public URL with download param
        const { data } = supabase.storage
            .from(bucketName)
            .getPublicUrl(mat.fileName, {
                download: `${mat.title}.${mat.type?.toLowerCase() || 'pdf'}`
            });

        // Redirect to download
        return res.redirect(data.publicUrl);

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

        if (mat.type === 'LINK') {
            return res.redirect(mat.fileUrl);
        }

        const bucketName = process.env.SUPABASE_BUCKET;

        // Get public URL WITHOUT download param to allow inline viewing
        const { data } = supabase.storage
            .from(bucketName)
            .getPublicUrl(mat.fileName);

        // Redirect to view
        return res.redirect(data.publicUrl);

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

module.exports = router;
