const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// Verify API Key exists
if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.includes('your_actual_key')) {
    console.warn("⚠️ WARNING: GROQ_API_KEY is missing or using placeholder in .env");
} else {
    console.log("✅ Groq SDK initialized with API Key (ending in ... " + process.env.GROQ_API_KEY.slice(-5) + ")");
}

router.post('/', async (req, res) => {
    console.log("AI Chat Request received:", req.body);
    const { message } = req.body;
    if (!message) {
        console.log("Error: No message provided");
        return res.status(400).json({ error: "Message is required" });
    }

    try {
        console.log("Calling Groq API with model llama3-8b-8192...");
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are Shniro AI, a helpful academic assistant for students using the Shniro Notes portal. Help them with their studies, explain concepts, and provide guidance. Keep responses concise and professional."
                },
                {
                    role: "user",
                    content: message
                }
            ],
            model: "llama3-8b-8192",
        });

        console.log("Groq API Response received successfully");
        res.json({ success: true, response: chatCompletion.choices[0].message.content });
    } catch (err) {
        console.error("FULL ERROR OBJECT:", JSON.stringify(err, null, 2));
        console.error("Groq AI Error Detail:", err.message);
        if (err.response) {
            console.error("Groq Response Error Data:", err.response.data);
        }
        res.status(500).json({ success: false, error: "AI Assistant is currently unavailable.", detail: err.message });
    }
});

module.exports = router;
