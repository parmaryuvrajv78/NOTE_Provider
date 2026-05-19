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

// Copy video URL to clipboard
function copyVideoUrl() {
    if (currentVideoUrl) {
        navigator.clipboard.writeText(currentVideoUrl).then(() => {
            showToast('Link copied! Opening YouTube...', 'success');
            setTimeout(() => {
                window.open(currentVideoUrl, '_blank');
            }, 500);
        }).catch(() => {
            window.open(currentVideoUrl, '_blank');
        });
    }
}

// Video Modal Logic
function openVideoModal(m) {
    const modal = document.getElementById('videoModal');
    const iframe = document.getElementById('videoIframe');
    const title = document.getElementById('videoModalTitle');
    const errorDiv = document.getElementById('videoError');
    const errorMsg = document.getElementById('videoErrorMsg');
    
    if (!iframe || !title || !modal) return;
    
    // Store current video info
    currentVideoUrl = m.fileUrl;
    currentVideoTitle = m.title;
    
    title.textContent = m.title;
    
    // Hide error initially
    if (errorDiv) errorDiv.style.display = 'none';
    
    const videoId = extractYouTubeID(m.fileUrl);
    
    console.log('Opening video:', {
        title: m.title,
        url: m.fileUrl,
        extractedId: videoId
    });
    
    if (videoId) {
        // Use basic YouTube embed URL
        const embedUrl = `https://www.youtube.com/embed/${videoId}?modestbranding=1`;
        iframe.src = embedUrl;
        
        // Show error if video fails to load after 5 seconds
        setTimeout(() => {
            if (iframe.src && !iframe.contentDocument) {
                // Try simple version without parameters
                iframe.src = `https://www.youtube.com/embed/${videoId}`;
            }
        }, 5000);
    } else {
        // No valid YouTube ID found
        console.warn('Could not extract YouTube ID from:', m.fileUrl);
        if (errorDiv && errorMsg) {
            errorMsg.textContent = 'Invalid video link format';
            errorDiv.style.display = 'flex';
        }
    }
    
    modal.style.display = 'flex';
    
    // Try to lock screen orientation on mobile
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(err => {
            console.log('Orientation lock not supported');
        });
    }
}

function closeVideoModal() { 
    const modal = document.getElementById('videoModal');
    const iframe = document.getElementById('videoIframe');
    
    if (modal) modal.style.display = 'none';
    
    // Clear iframe to stop video
    if (iframe) {
        iframe.src = '';
    }
    
    // Unlock screen orientation
    if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
    }
}

// Modal Logic for Notes/PDFs
function openMatModal(id) {
    const m = subjectMaterials.find(x => (x.id || x._id) === id);
    if (!m) return;

    // If it's a video, open video modal instead
    if (m.category === 'Video' && m.fileUrl) {
        openVideoModal(m);
        return;
    }

    document.getElementById('modalTitle').textContent = m.title;
    document.getElementById('modalSubject').textContent = m.subject;
    document.getElementById('modalTags').innerHTML = `<span class="mat-tag">Size: ${esc(m.size)}</span>`;
    document.getElementById('modalView').onclick = () => window.location.href = `${API_BASE}/materials/view/${m.id || m._id}`;
    document.getElementById('modalDownload').onclick = () => {
        window.location.href = `${API_BASE}/materials/download/${m.id || m._id}`;
        showToast('Download started!', 'success');
    };
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

loadSubjectData();
