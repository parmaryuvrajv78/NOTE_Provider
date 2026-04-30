const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_KEY || 'placeholder'
);

const upload = multer({ storage: multer.memoryStorage() });

module.exports = { upload, supabase };
