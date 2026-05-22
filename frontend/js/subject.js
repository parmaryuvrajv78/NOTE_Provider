/* ============================================
   Shniro Notes — Subject Specific Logic
   ============================================ */

(function () {
    if (!DataStore.isLoggedIn()) { window.location.href = 'index.html'; return; }
    if (localStorage.getItem('sn_theme') === 'dark') document.body.classList.add('dark');
})();

const user = DataStore.getCurrentUser();
if (user) {
    document.getElementById('userAvatar').textContent = user.name[0].toUpperCase();
}

function esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function showToast(msg, type = 'info') {
    const box = document.getElementById('toastBox');
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = msg;
    box.appendChild(toast);
    setTimeout(() => { toast.classList.add('hide'); setTimeout(() => toast.remove(), 300); }, 3500);
}

// Upgrade modal for subject page (redirects to home if account sidebar not available)
function showUpgradeModal(title, message) {
    let overlay = document.getElementById('upgradeModalOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'upgradeModalOverlay';
        overlay.className = 'popup-overlay';
        overlay.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:11000; align-items:center; justify-content:center;';

        const card = document.createElement('div');
        card.className = 'upgrade-modal-card';
        card.style.cssText = 'background:var(--bg); color:var(--text); padding:20px; width:clamp(320px, 90%, 520px); border-radius:12px; box-shadow:0 8px 28px rgba(0,0,0,0.3);';

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h3 style="margin:0; font-size:18px;">${title || 'Upgrade Required'}</h3>
                <button id="upgradeModalCloseBtn" style="background:none;border:none;font-size:18px;cursor:pointer;">✕</button>
            </div>
            <p style="margin:0 0 16px 0; line-height:1.4">${message || ''}</p>
            <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:6px;">
                <button id="upgradeModalClose" class="btn btn-ghost">Close</button>
                <button id="upgradeModalAction" class="btn btn-primary">Request Upgrade</button>
            </div>
        `;

        overlay.appendChild(card);
        document.body.appendChild(overlay);

        overlay.querySelector('#upgradeModalCloseBtn').addEventListener('click', () => overlay.style.display = 'none');
        overlay.querySelector('#upgradeModalClose').addEventListener('click', () => overlay.style.display = 'none');
        overlay.querySelector('#upgradeModalAction').addEventListener('click', () => {
            // No account sidebar on subject page — redirect to home where user can request upgrade
            window.location.href = 'home.html';
            overlay.style.display = 'none';
        });
    }

    const card = overlay.querySelector('.upgrade-modal-card');
    if (card) {
        const h = card.querySelector('h3'); if (h) h.textContent = title || 'Upgrade Required';
        const p = card.querySelector('p'); if (p) p.textContent = message || '';
    }

    overlay.style.display = 'flex';
}

const urlParams = new URLSearchParams(window.location.search);
const subjectName = urlParams.get('name') || 'Unknown Subject';
document.getElementById('subjectTitle').textContent = subjectName;

let subjectMaterials = [];

async function loadSubjectData() {
    try {
        const allMaterials = await DataStore.getMaterials();
        subjectMaterials = allMaterials.filter(m => m.subject.trim().toLowerCase() === subjectName.trim().toLowerCase());
        renderMaterials();
    } catch (err) {
        showToast('Failed to load materials', 'error');
    }
}

function toggleFav(e, id) {
    e.stopPropagation();
    const active = DataStore.toggleFavorite(id);
    showToast(active ? 'Added to Saved' : 'Removed from Saved', active ? 'success' : 'info');
    renderMaterials();
}

function createCard(m) {
    const isFav = DataStore.isFavorite(m.id || m._id);
    const card = document.createElement('div');
    card.className = 'mat-card';
    card.innerHTML = `
        <div class="mat-card-head">
            <div class="mat-icon-box">
                ${m.category === 'Video' ? '🎥' : m.category === 'Quiz' ? '📝' : '📄'}
            </div>
            <div style="flex:1">
                <div class="mat-title">${esc(m.title)}</div>
                <span class="mat-subject">${esc(m.subject)}</span>
            </div>
            <button class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFav(event, '${m.id || m._id}')">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.84-8.84 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </button>
        </div>
        <div onclick="openMatModal('${m.id || m._id}')" style="margin-top: 14px; cursor:pointer;">
            <div class="mat-footer" style="padding-top: 10px; border-top: 1px solid var(--input-border);">
                <span style="font-weight: 500; color: var(--blue);">View Material</span>
                <span style="font-weight: 600;">${esc(m.size)}</span>
            </div>
        </div>
    `;
    return card;
}

function renderMaterials() {
    const categories = {
        Notes: document.getElementById('notesContainer'),
        Video: document.getElementById('videoContainer'),
        Quiz: document.getElementById('quizContainer')
    };
    const empties = {
        Notes: document.getElementById('notesEmpty'),
        Video: document.getElementById('videoEmpty'),
        Quiz: document.getElementById('quizEmpty')
    };

    // Reset
    for (const key in categories) {
        categories[key].innerHTML = '';
        categories[key].style.display = 'grid'; // .material-grid is a grid
        empties[key].style.display = 'none';
    }

    const counts = { Notes: 0, Video: 0, Quiz: 0 };

    subjectMaterials.forEach(m => {
        let cat = m.category;
        if (!cat) {
            const t = (m.type || '').toUpperCase();
            if (['MP4', 'MKV', 'AVI', 'WEBM'].includes(t)) cat = 'Video';
            else if (['PDF', 'DOC', 'DOCX', 'PPT', 'TXT'].includes(t)) cat = 'Notes';
            else cat = 'Notes';
        }
        
        if (categories[cat]) {
            categories[cat].appendChild(createCard(m));
            counts[cat]++;
        }
    });

    for (const key in counts) {
        if (counts[key] === 0) {
            categories[key].style.display = 'none';
            empties[key].style.display = 'block';
        }
    }
}

// Store current video URL for fallback
let currentVideoUrl = '';
let currentVideoTitle = '';

// Extract YouTube Video ID - More Robust
function extractYouTubeID(url) {
    if (!url) return null;
    
    // If it's already just a video ID
    if (url.length === 11 && !/[^a-zA-Z0-9_-]/.test(url)) {
        return url;
    }
    
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /^([a-zA-Z0-9_-]{11})$/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }
    return null;
}

function isHttpPage() {
    return window.location.protocol === 'http:' || window.location.protocol === 'https:';
}

function isDirectVideoFile(material) {
    const type = (material.type || '').toUpperCase();
    const url = material.fileUrl || '';
    return ['MP4', 'WEBM', 'OGG', 'MOV', 'M4V', 'MKV'].includes(type) ||
        /\.(mp4|webm|ogg|mov|m4v|mkv)(\?|#|$)/i.test(url);
}

function buildYouTubeEmbedUrl(videoId) {
    const params = new URLSearchParams({
        playsinline: '1',
        rel: '0',
        modestbranding: '1'
    });

    if (isHttpPage() && window.location.origin && window.location.origin !== 'null') {
        params.set('origin', window.location.origin);
    }

    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

// Copy video URL to clipboard
function copyVideoUrl() {
    if (currentVideoUrl) {
        const openVideo = () => window.open(currentVideoUrl, '_blank');

        if (!navigator.clipboard || !navigator.clipboard.writeText) {
            openVideo();
            return;
        }

        navigator.clipboard.writeText(currentVideoUrl).then(() => {
            showToast('Link copied! Opening video...', 'success');
            setTimeout(openVideo, 500);
        }).catch(() => {
            openVideo();
        });
    }
}

// Video Modal Logic
function openVideoModal(m) {
    const modal = document.getElementById('videoModal');
    const iframe = document.getElementById('videoIframe');
    const player = document.getElementById('videoPlayer');
    const title = document.getElementById('videoModalTitle');
    const errorDiv = document.getElementById('videoError');
    const errorMsg = document.getElementById('videoErrorMsg');
    
    if (!iframe || !player || !title || !modal) return;
    
    // Store current video info
    currentVideoUrl = m.fileUrl;
    currentVideoTitle = m.title;
    
    title.textContent = m.title;
    
    iframe.style.display = 'none';
    iframe.src = '';
    player.style.display = 'none';
    player.pause();
    player.removeAttribute('src');
    player.load();

    // Hide error initially
    if (errorDiv) errorDiv.style.display = 'none';
    
    const videoId = extractYouTubeID(m.fileUrl);
    
    console.log('Opening video:', {
        title: m.title,
        url: m.fileUrl,
        extractedId: videoId
    });
    
    if (videoId) {
        if (isHttpPage()) {
            iframe.src = buildYouTubeEmbedUrl(videoId);
            iframe.style.display = 'block';
        } else if (errorDiv && errorMsg) {
            errorMsg.textContent = 'YouTube videos must be opened from the browser when this page is loaded offline.';
            errorDiv.style.display = 'flex';
        }
    } else if (isDirectVideoFile(m)) {
        player.src = m.fileUrl;
        player.style.display = 'block';
        player.load();
    } else {
        // No valid YouTube ID found
        console.warn('Could not extract YouTube ID from:', m.fileUrl);
        if (errorDiv && errorMsg) {
            errorMsg.textContent = 'This video link cannot be embedded. Open it directly instead.';
            errorDiv.style.display = 'flex';
        }
    }
    
    modal.style.display = 'flex';
    document.body.classList.add('video-open');
}

function closeVideoModal() { 
    const modal = document.getElementById('videoModal');
    const iframe = document.getElementById('videoIframe');
    const player = document.getElementById('videoPlayer');
    const errorDiv = document.getElementById('videoError');
    
    if (modal) modal.style.display = 'none';
    
    // Clear iframe to stop video
    if (iframe) {
        iframe.src = '';
        iframe.style.display = 'none';
    }

    if (player) {
        player.pause();
        player.removeAttribute('src');
        player.load();
        player.style.display = 'none';
    }

    if (errorDiv) errorDiv.style.display = 'none';
    document.body.classList.remove('video-open');
}

// Modal Logic for Notes/PDFs
function openMatModal(id) {
    const m = subjectMaterials.find(x => (x.id || x._id) === id);
    if (!m) return;

    // If it's a video, open video modal instead
    if (m.category === 'Video') {
        // If video is a LINK (YouTube) use the normal viewer; if it's stored file, open via server view route
        if (m.type === 'LINK' && m.fileUrl) {
            openVideoModal(m);
            return;
        }
        // For stored files, point player to server view endpoint which proxies the file
        m.fileUrl = `${API_BASE}/materials/view/${m.id || m._id}?userId=${user && user.id}`;
        openVideoModal(m);
        return;
    }

    // If it's a quiz, open quiz modal instead
    if (m.category === 'Quiz' && m.questions && m.questions.length > 0) {
        openQuizModal(m);
        return;
    }

    document.getElementById('modalTitle').textContent = m.title;
    document.getElementById('modalSubject').textContent = m.subject;
    document.getElementById('modalTags').innerHTML = `<span class="mat-tag">Size: ${esc(m.size)}</span>`;
    document.getElementById('modalView').onclick = () => window.location.href = `${API_BASE}/materials/view/${m.id || m._id}?userId=${user && user.id}`;
    const downloadBtn = document.getElementById('modalDownload');
    const currentUser = DataStore.getCurrentUser();
    const canDownload = currentUser && (currentUser.role === 'admin' || currentUser.plan === 'pro');
    if (canDownload) {
        downloadBtn.disabled = false;
        downloadBtn.onclick = () => {
            window.location.href = `${API_BASE}/materials/download/${m.id || m._id}?userId=${currentUser.id}`;
            showToast('Download started!', 'success');
        };
    } else {
        // Allow clicking to show upgrade prompt (prevent actual download)
        downloadBtn.disabled = false;
        downloadBtn.style.opacity = '0.95';
        downloadBtn.onclick = () => showUpgradeModal('Upgrade Required', 'Downloads are available only for upgraded users. Visit Home to request an upgrade.');
    }
    document.getElementById('matModal').style.display = 'flex';
}

function closeMatModal() { document.getElementById('matModal').style.display = 'none'; }

// Close video modal when clicking overlay
document.addEventListener('DOMContentLoaded', function() {
    const videoModal = document.getElementById('videoModal');
    if (videoModal) {
        videoModal.addEventListener('click', (e) => { 
            if (e.target.classList.contains('popup-overlay') || e.target.classList.contains('video-overlay')) {
                closeVideoModal();
            }
        });
    }
    
    const matModal = document.getElementById('matModal');
    if (matModal) {
        matModal.addEventListener('click', (e) => { 
            if (e.target.classList.contains('popup-overlay')) {
                closeMatModal();
            }
        });
    }
});
document.getElementById('matModal')?.addEventListener('click', (e) => { if (e.target.classList.contains('popup-overlay')) closeMatModal(); });

// Tab Logic
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab + 'Tab').classList.add('active');
    });
});

// ===== QUIZ LOGIC =====
let currentQuiz = null;
let currentQuestionIndex = 0;
let quizAnswers = {};

function openQuizModal(quizMaterial) {
    if (!quizMaterial.questions || quizMaterial.questions.length === 0) {
        showToast('No questions in this quiz', 'error');
        return;
    }

    currentQuiz = quizMaterial;
    currentQuestionIndex = 0;
    quizAnswers = {};

    document.getElementById('quizTitle').textContent = quizMaterial.title;
    document.getElementById('quizModal').style.display = 'flex';

    displayQuestion();
}

function closeQuizModal() {
    document.getElementById('quizModal').style.display = 'none';
    currentQuiz = null;
    currentQuestionIndex = 0;
    quizAnswers = {};
}

function displayQuestion() {
    if (!currentQuiz || !currentQuiz.questions) return;

    const question = currentQuiz.questions[currentQuestionIndex];
    const totalQuestions = currentQuiz.questions.length;

    // Update progress
    const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;
    document.getElementById('quizProgress').textContent = `${currentQuestionIndex + 1} of ${totalQuestions}`;
    document.getElementById('progressFill').style.width = progress + '%';

    // Display question
    document.getElementById('questionDisplay').textContent = question.question;

    // Display options
    const optionsContainer = document.getElementById('optionsDisplay');
    optionsContainer.innerHTML = '';

    question.options.forEach((option, index) => {
        const optionBtn = document.createElement('button');
        optionBtn.className = 'quiz-option';
        optionBtn.textContent = option;
        
        if (quizAnswers[currentQuestionIndex] === index) {
            optionBtn.classList.add('selected');
        }

        optionBtn.onclick = () => selectOption(index);
        optionsContainer.appendChild(optionBtn);
    });

    // Update button visibility
    document.getElementById('prevBtn').style.display = currentQuestionIndex > 0 ? 'block' : 'none';
    document.getElementById('nextBtn').style.display = currentQuestionIndex < totalQuestions - 1 ? 'block' : 'none';
    document.getElementById('submitBtn').style.display = currentQuestionIndex === totalQuestions - 1 ? 'block' : 'none';
}

function selectOption(index) {
    quizAnswers[currentQuestionIndex] = index;
    displayQuestion();
}

function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        displayQuestion();
    }
}

function nextQuestion() {
    if (currentQuestionIndex < currentQuiz.questions.length - 1) {
        currentQuestionIndex++;
        displayQuestion();
    }
}

function submitQuiz() {
    if (!currentQuiz || !currentQuiz.questions) return;

    let score = 0;
    currentQuiz.questions.forEach((question, index) => {
        if (quizAnswers[index] === question.correctAnswer) {
            score++;
        }
    });

    const percentage = Math.round((score / currentQuiz.questions.length) * 100);
    showToast(`Quiz Submitted! Score: ${score}/${currentQuiz.questions.length} (${percentage}%)`, 'success');
    closeQuizModal();
}

// Close quiz modal when clicking overlay
document.addEventListener('DOMContentLoaded', function() {
    const quizModal = document.getElementById('quizModal');
    if (quizModal) {
        quizModal.addEventListener('click', (e) => {
            if (e.target.classList.contains('popup-overlay') || e.target.classList.contains('quiz-overlay')) {
                closeQuizModal();
            }
        });
    }
});

loadSubjectData();
