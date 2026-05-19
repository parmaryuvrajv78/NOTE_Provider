const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');

const DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 4000;

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

function buildContextBlock(context = {}) {
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
        materialLines ? `Available Shniro Notes materials:\n${materialLines}` : 'Available Shniro Notes materials: not loaded or none found.'
    ].join('\n\n');
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
- Use the provided Shniro Notes material list only as app context. Do not claim to have read a file unless its text was given.
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
    const userMessage = cleanText(message);

    console.log('AI Chat Request received');

    if (!userMessage) {
        return res.status(400).json({ success: false, error: 'Message is required' });
    }

    if (!isGroqConfigured()) {
        return res.status(503).json({
            success: false,
            error: 'AI Assistant is not configured. Add GROQ_API_KEY in backend/.env and restart the server.'
        });
    }

    try {
        const safeHistory = normalizeHistory(history);
        const contextBlock = buildContextBlock(context);

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

        res.json({ success: true, response: answer, model: DEFAULT_MODEL });
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
