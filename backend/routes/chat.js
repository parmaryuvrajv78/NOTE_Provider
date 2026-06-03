const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');
const User = require('../models/user');
const Material = require('../models/material');

const DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 4000;
const MAX_CONTEXT_MATERIALS = 8;
const MAX_CONTEXT_SNIPPET_CHARS = 900;
const MAX_CONTEXT_TOTAL_CHARS = 6000;

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.includes('your_actual_key')) {
    console.warn('WARNING: GROQ_API_KEY is missing or using a placeholder in .env');
} else {
    console.log(`Groq SDK initialized with API key ending in ...${process.env.GROQ_API_KEY.slice(-5)}`);
}

function isGroqConfigured() {
    return Boolean(process.env.GROQ_API_KEY && !process.env.GROQ_API_KEY.includes('your_actual_key'));
}

function cleanText(value, limit = MAX_MESSAGE_CHARS) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
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

function getMaterialOwnerForUser(user) {
    if (!user) return null;
    if (user.role === 'superadmin') return 'all';
    if (user.role === 'admin') return user._id;
    return user.adminId || null;
}

function materialAccessQuery(user) {
    const ownerId = getMaterialOwnerForUser(user);
    if (ownerId === 'all') return {};
    return ownerId ? ownerScope(ownerId) : { $or: [{ createdBy: { $exists: false } }, { createdBy: null }] };
}

function tokenize(value) {
    return cleanText(value, 2000)
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .filter(word => word.length > 2);
}

function scoreText(text, words) {
    const haystack = cleanText(text, 12000).toLowerCase();
    return words.reduce((sum, word) => sum + (haystack.includes(word) ? 1 : 0), 0);
}

function bestSnippet(text, words, limit = MAX_CONTEXT_SNIPPET_CHARS) {
    const cleaned = cleanText(text, 50000);
    if (!cleaned) return '';

    const lower = cleaned.toLowerCase();
    const hit = words.map(word => lower.indexOf(word)).filter(index => index >= 0).sort((a, b) => a - b)[0];
    const start = hit >= 0 ? Math.max(0, hit - Math.floor(limit / 3)) : 0;
    return cleaned.slice(start, start + limit).trim();
}

function quizSnippet(material, words) {
    if (!Array.isArray(material.questions) || material.questions.length === 0) return '';

    const ranked = material.questions
        .map((question, index) => {
            const optionText = Array.isArray(question.options) ? question.options.join(' ') : '';
            const text = `${question.question || ''} ${optionText} ${question.explanation || ''}`;
            return { question, index, score: scoreText(text, words) };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

    return ranked.map(({ question, index }) => {
        const options = Array.isArray(question.options)
            ? question.options.map((option, optionIndex) => `${optionIndex + 1}. ${cleanText(option, 140)}`).join(' ')
            : '';
        const correct = Array.isArray(question.options) ? question.options[question.correctAnswer] : question.correctAnswer;
        return `Q${index + 1}: ${cleanText(question.question, 260)} Options: ${options} Correct: ${cleanText(correct, 140)} Explanation: ${cleanText(question.explanation, 260)}`;
    }).join('\n');
}

function normalizeHistory(history) {
    if (!Array.isArray(history)) return [];

    return history
        .filter(item => item && ['user', 'assistant'].includes(item.role) && item.content)
        .slice(-MAX_HISTORY_MESSAGES)
        .map(item => ({
            role: item.role,
            content: cleanText(item.content)
        }))
        .filter(item => item.content);
}

async function getRelevantStudyContext(user, userMessage, context = {}) {
    const words = tokenize(userMessage);
    const clientMaterials = Array.isArray(context.materials) ? context.materials.slice(0, 20) : [];
    const clientIds = clientMaterials
        .map(item => cleanText(item.id || item._id, 80))
        .filter(id => /^[a-f0-9]{24}$/i.test(id));

    const baseQuery = materialAccessQuery(user);
    const idQuery = clientIds.length ? { _id: { $in: clientIds } } : {};
    const query = Object.keys(idQuery).length ? { $and: [baseQuery, idQuery] } : baseQuery;

    const materials = await Material.find(query)
        .select('title subject category type questions contentText createdBy createdAt')
        .sort({ createdAt: -1 })
        .limit(clientIds.length ? 20 : 80);

    return materials
        .map(material => {
            const title = cleanText(material.title, 120);
            const subject = cleanText(material.subject, 80);
            const category = cleanText(material.category || material.type || 'Material', 40);
            const metaScore = scoreText(`${title} ${subject} ${category}`, words);
            const bodyScore = scoreText(`${material.contentText || ''} ${quizSnippet(material, words)}`, words);
            const score = metaScore * 2 + bodyScore;
            const snippet = material.category === 'Quiz'
                ? quizSnippet(material, words)
                : bestSnippet(material.contentText, words);

            return { title, subject, category, score, snippet };
        })
        .filter(item => item.title && item.subject)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_CONTEXT_MATERIALS);
}

function buildContextBlock(context = {}, studyContext = []) {
    const userName = cleanText(context.userName, 80) || 'Student';
    const materials = Array.isArray(context.materials) ? context.materials.slice(0, 30) : [];

    const materialLines = materials
        .map((m, index) => {
            const title = cleanText(m.title, 120);
            const subject = cleanText(m.subject, 80);
            const category = cleanText(m.category || m.type || 'Material', 40);
            if (!title || !subject) return null;
            return `${index + 1}. ${title} (${subject}, ${category})`;
        })
        .filter(Boolean)
        .join('\n');

    return [
        `Student name: ${userName}`,
        materialLines ? `Available Shniro Notes materials:\n${materialLines}` : 'Available Shniro Notes materials: not loaded or none found.',
        buildStudyContentBlock(studyContext)
    ].join('\n\n');
}

function buildStudyContentBlock(studyContext = []) {
    if (!studyContext.length) {
        return 'Relevant note or quiz content: none found. Answer generally and ask the student to open or upload a related note if needed.';
    }

    let used = 0;
    const lines = [];
    studyContext.forEach((item, index) => {
        const snippet = cleanText(item.snippet, MAX_CONTEXT_SNIPPET_CHARS);
        const block = `${index + 1}. ${item.title} (${item.subject}, ${item.category})\n${snippet ? `Snippet:\n${snippet}` : 'Snippet: no extractable text stored for this material.'}`;
        if (used + block.length > MAX_CONTEXT_TOTAL_CHARS) return;
        used += block.length;
        lines.push(block);
    });

    return lines.length
        ? `Relevant note or quiz content:\n${lines.join('\n\n')}`
        : 'Relevant note or quiz content: none found. Answer generally and ask the student to open or upload a related note if needed.';
}

const SYSTEM_PROMPT = `
You are Shniro Study Assistant, a patient academic tutor inside the Shniro Notes app.

Behavior:
- Answer like a strong study partner: clear, accurate, structured, and friendly.
- Use the student's wording and language style. If they ask in Hindi or Hinglish, answer in that style.
- For concepts, explain from intuition to definition to example.
- For numerical or programming problems, show steps and check the result.
- For exam preparation, give concise notes, important points, mnemonics, and likely question patterns.
- If a question is vague, give a useful short answer first, then ask one clarifying question.
- Use the provided Shniro Notes snippets and quiz questions as the primary source when available.
- Do not claim to have read a whole file. Say "based on the available snippet/question" when using limited extracted text.
- If you are unsure, say so and explain what information is needed.
- Format answers in clean Markdown so the app can render them like a polished chat assistant:
  - Start medium or long answers with a short bold heading, for example **Core Idea**, **Steps**, **Example**, or **Quick Revision**.
  - Use bullet points or numbered steps instead of long paragraphs.
  - Keep each point on its own line.
  - Bold important formulas, terms, and final answers.
  - Use fenced code blocks for code.
  - Use blank lines between sections.
- Keep answers focused. For simple questions, use 1-2 short sections.
`.trim();

router.post('/', async (req, res) => {
    const { message, history, context } = req.body || {};
    const { userId } = req.body || {};
    const userMessage = cleanText(message);

    console.log('AI Chat Request received');

    if (!userMessage) {
        return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // Require logged-in user for AI usage tracking and limits
    if (!userId) {
        return res.status(401).json({ success: false, error: 'User authentication required for AI assistant.' });
    }

    // Load user and enforce daily limits
    let user;
    try {
        user = await User.findById(userId);
    } catch (e) {
        user = null;
    }

    if (!user || !user.approved) {
        return res.status(403).json({ success: false, error: 'User not authorized or not found.' });
    }

    // Reset daily counts if last reset wasn't today (UTC)
    const now = new Date();
    const last = user.aiLastReset || new Date(0);
    const sameUTCDate = last.getUTCFullYear() === now.getUTCFullYear() && last.getUTCMonth() === now.getUTCMonth() && last.getUTCDate() === now.getUTCDate();
    if (!sameUTCDate) {
        user.aiQuestionsUsed = 0;
        user.aiLastReset = now;
    }

    const FREE_LIMIT = Number(process.env.FREE_AI_LIMIT || 5);
    const PRO_LIMIT = Number(process.env.PRO_AI_LIMIT || 50);
    const userLimit = (user.plan === 'pro') ? PRO_LIMIT : FREE_LIMIT;

    if ((user.aiQuestionsUsed || 0) >= userLimit) {
        return res.status(429).json({
            success: false,
            error: `Daily AI question limit reached (${userLimit}). Upgrade to pro to increase quota.`
        });
    }

    if (!isGroqConfigured()) {
        return res.status(503).json({
            success: false,
            error: 'AI Assistant is not configured. Add GROQ_API_KEY in backend/.env and restart the server.'
        });
    }

    try {
        const safeHistory = normalizeHistory(history);
        const studyContext = await getRelevantStudyContext(user, userMessage, context);
        const contextBlock = buildContextBlock(context, studyContext);

        console.log(`Calling Groq API with model ${DEFAULT_MODEL}...`);
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `${SYSTEM_PROMPT}\n\nCurrent app context:\n${contextBlock}`
                },
                ...safeHistory,
                {
                    role: 'user',
                    content: userMessage
                }
            ],
            model: DEFAULT_MODEL,
            temperature: 0.45,
            top_p: 0.9,
            max_tokens: 1200
        });

        const answer = chatCompletion.choices?.[0]?.message?.content?.trim();
        if (!answer) {
            return res.status(502).json({ success: false, error: 'AI returned an empty answer. Please try again.' });
        }

        try {
            user.aiQuestionsUsed = (user.aiQuestionsUsed || 0) + 1;
            user.aiLastReset = now;
            await user.save();
        } catch (e) {
            console.warn('Could not update AI usage for user', userId, e.message || e);
        }

        const aiUsed = user.aiQuestionsUsed || 0;
        const aiRemaining = Math.max(0, userLimit - aiUsed);
        res.json({ success: true, response: answer, model: DEFAULT_MODEL, aiQuestionsUsed: aiUsed, aiRemaining });
    } catch (err) {
        console.error('Groq AI Error Detail:', err.message);
        const status = err.status || err.response?.status || 500;
        const error = status === 401 || status === 403
            ? 'AI Assistant API key is invalid or unauthorized. Check GROQ_API_KEY in backend/.env.'
            : 'AI Assistant is currently unavailable. Please try again.';

        res.status(status >= 400 && status < 600 ? status : 500).json({ success: false, error });
    }
});

module.exports = router;
