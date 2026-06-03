function cleanText(value, maxLength = 500) {
    return String(value || '')
        .replace(/<[^>]*>/g, '')
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
}

function cleanIdentifier(value, maxLength = 80) {
    return cleanText(value, maxLength).replace(/[<>"'`]/g, '');
}

function cleanUrl(value, { allowDataImage = false } = {}) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    if (allowDataImage && /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(raw)) {
        return raw.replace(/\s+/g, '');
    }

    try {
        const url = new URL(raw);
        if (!['http:', 'https:'].includes(url.protocol)) return '';
        return url.toString();
    } catch (err) {
        return '';
    }
}

function cleanQuizQuestions(input) {
    const questions = Array.isArray(input) ? input : [];
    return questions
        .slice(0, 100)
        .map(item => {
            const options = Array.isArray(item.options)
                ? item.options.slice(0, 6).map(option => cleanText(option, 300)).filter(Boolean)
                : [];
            const correctAnswer = Number(item.correctAnswer);
            return {
                question: cleanText(item.question, 1000),
                options,
                correctAnswer: Number.isInteger(correctAnswer) ? correctAnswer : -1,
                explanation: cleanText(item.explanation, 1000)
            };
        })
        .filter(item => item.question && item.options.length >= 2 && item.correctAnswer >= 0 && item.correctAnswer < item.options.length);
}

module.exports = {
    cleanIdentifier,
    cleanQuizQuestions,
    cleanText,
    cleanUrl
};
