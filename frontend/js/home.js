/* ============================================
   Shniro Notes — Student Home Logic (Async)
   ============================================ */

// Auth Guard
(function () {
    if (!DataStore.isLoggedIn()) { window.location.href = 'index.html'; return; }
    if (localStorage.getItem('sn_theme') === 'dark') document.body.classList.add('dark');
})();

const user = DataStore.getCurrentUser();
if (user) {
    document.getElementById('userAvatar').textContent = user.name[0].toUpperCase();
    document.getElementById('userName').textContent = user.name;
    document.getElementById('welcomeMsg').textContent = 'Hey ' + user.name.split(' ')[0] + '! 👋';

    if (user.role === 'admin') {
        const navRight = document.querySelector('.nav-right');
        if (navRight) {
            const adminBtn = document.createElement('button');
            adminBtn.className = 'btn-logout';
            adminBtn.style.color = 'var(--blue)';
            adminBtn.style.marginRight = '8px';
            adminBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg> Dashboard';
            adminBtn.onclick = () => window.location.href = 'admin.html';
            navRight.insertBefore(adminBtn, document.getElementById('logoutBtn'));
        }
    }
}

function showToast(msg, type = 'info') {
    const box = document.getElementById('toastBox');
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = msg;
    box.appendChild(toast);
    setTimeout(() => { toast.classList.add('hide'); setTimeout(() => toast.remove(), 300); }, 3500);
}

function esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

let allMaterials = [];
let currentView = 'all';

async function refreshMaterials() {
    try {
        showSkeletons();
        allMaterials = await DataStore.getMaterials();
        renderMaterials();
    } catch (err) {
        showToast('Server connection failed', 'error');
    }
}

function showSkeletons() {
    const container = document.getElementById('materialsContainer');
    container.innerHTML = `
        <div class="subject-section">
            <div class="skeleton-title skeleton"></div>
            <div class="material-grid">
                ${Array(3).fill('<div class="skeleton-card"><div class="skeleton-title skeleton"></div><div class="skeleton-text skeleton"></div><div class="skeleton-meta skeleton"></div></div>').join('')}
            </div>
        </div>
    `;
    container.style.display = 'block';
}

function renderMaterials() {
    const search = document.getElementById('searchInput').value.toLowerCase().trim();
    const container = document.getElementById('materialsContainer');
    const noRes = document.getElementById('noResults');
    container.innerHTML = '';

    let list = [...allMaterials];

    // Filter by Saved if in Saved view
    if (currentView === 'saved') {
        const favs = DataStore.getFavorites();
        list = list.filter(m => favs.includes(m.id || m._id));
    }

    if (search) {
        list = list.filter(m => 
            m.title.toLowerCase().includes(search) || 
            m.subject.toLowerCase().includes(search)
        );
    }

    if (list.length === 0) {
        container.style.display = 'none';
        noRes.style.display = 'block';
        noRes.querySelector('h3').textContent = currentView === 'saved' ? 'No saved materials' : 'Nothing found';
        return;
    }

    container.style.display = 'block';
    noRes.style.display = 'none';

    // Group materials by subject (Case-insensitive & trimmed)
    const grouped = {};
    list.forEach(m => {
        const subKey = m.subject.trim().toLowerCase();
        if (!grouped[subKey]) {
            grouped[subKey] = {
                title: m.subject.trim(), // Use the first item's case as the display title
                count: 0
            };
        }
        grouped[subKey].count++;
    });

    if (currentView === 'saved') {
        // Render saved materials directly
        const section = document.createElement('div');
        section.className = 'subject-section';
        const grid = document.createElement('div');
        grid.className = 'material-grid';

        list.forEach(m => {
            const isFav = true;
            const card = document.createElement('div');
            card.className = 'mat-card';
            card.innerHTML = `
                <div class="mat-card-head">
                    <div class="mat-icon-box">📄</div>
                    <div style="flex:1">
                        <div class="mat-title">${esc(m.title)}</div>
                        <span class="mat-subject">${esc(m.subject)}</span>
                    </div>
                    <button class="fav-btn active" onclick="toggleFav(event, '${m.id || m._id}')">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.84-8.84 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    </button>
                </div>
                <div onclick="openMatModal('${m.id || m._id}')" style="margin-top: 14px; cursor:pointer;">
                    <div class="mat-footer" style="padding-top: 10px; border-top: 1px solid var(--input-border);">
                        <span style="font-weight: 500; color: var(--blue);">View Material</span>
                        <span style="font-weight: 600;">${esc(m.size)}</span>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
        section.appendChild(grid);
        container.appendChild(section);
    } else {
        // Render Subject Cards
        const grid = document.createElement('div');
        grid.className = 'material-grid';
        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(160px, 1fr))';
        
        for (const [subKey, group] of Object.entries(grouped)) {
            const card = document.createElement('div');
            card.className = 'mat-card';
            card.style.cursor = 'pointer';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.alignItems = 'center';
            card.style.justifyContent = 'center';
            card.style.padding = '30px 20px';
            card.onclick = () => window.location.href = `subject.html?name=${encodeURIComponent(group.title)}`;
            
            card.innerHTML = `
                <div class="mat-icon-box" style="width: 56px; height: 56px; margin-bottom: 16px;">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                </div>
                <h3 style="font-size: 18px; font-weight: 600; text-align: center; margin-bottom: 6px;">${esc(group.title)}</h3>
                <span style="font-size: 13px; color: var(--text-gray);">${group.count} Materials</span>
            `;
            grid.appendChild(card);
        }
        
        container.appendChild(grid);
    }
}

function toggleFav(e, id) {
    e.stopPropagation();
    const active = DataStore.toggleFavorite(id);
    showToast(active ? 'Added to Saved' : 'Removed from Saved', active ? 'success' : 'info');
    renderMaterials();
}

function switchView(view, el) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    el.classList.add('active');
    
    if (view === 'search') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => document.getElementById('searchInput').focus(), 300);
        currentView = 'all';
    } else {
        currentView = view;
    }
    renderMaterials();
}

function openMatModal(id) {
    const m = allMaterials.find(x => (x.id || x._id) === id);
    if (!m) return;
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

document.getElementById('searchInput').addEventListener('input', renderMaterials);
document.getElementById('logoutBtn').addEventListener('click', () => { DataStore.logout(); window.location.href = 'index.html'; });

const mobLogout = document.getElementById('mobileLogout');
if (mobLogout) mobLogout.addEventListener('click', () => { DataStore.logout(); window.location.href = 'index.html'; });

const mobTheme = document.getElementById('mobileThemeToggle');
if (mobTheme) {
    mobTheme.addEventListener('click', () => {
        document.body.classList.toggle('dark');
        const isDark = document.body.classList.contains('dark');
        localStorage.setItem('sn_theme', isDark ? 'dark' : 'light');
    });
}

document.getElementById('matModal').addEventListener('click', (e) => { if (e.target.classList.contains('popup-overlay')) closeMatModal(); });

// AI Assistant Logic
(function() {
    const aiBtn = document.getElementById('aiAssistantBtn');
    const chatContainer = document.getElementById('chatContainer');
    const closeChat = document.getElementById('closeChat');
    const chatInput = document.getElementById('chatInput');
    const sendMessage = document.getElementById('sendMessage');
    const chatMessages = document.getElementById('chatMessages');
    const typingIndicator = document.getElementById('typingIndicator');

    if (!aiBtn) return;

    aiBtn.addEventListener('click', () => {
        chatContainer.classList.toggle('active');
    });

    closeChat.addEventListener('click', () => {
        chatContainer.classList.remove('active');
    });

    async function handleSend() {
        const text = chatInput.value.trim();
        if (!text) return;

        // Add user message
        addMessage(text, 'user');
        chatInput.value = '';

        // Show typing indicator
        typingIndicator.style.display = 'block';
        chatMessages.scrollTop = chatMessages.scrollHeight;

        try {
            const response = await fetch(`${window.API_BASE}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });

            const data = await response.json();
            
            // Hide typing indicator
            typingIndicator.style.display = 'none';

            if (data.response) {
                addMessage(data.response, 'ai');
            } else {
                addMessage("Sorry, I'm having trouble connecting. Please try again later.", 'ai');
            }
        } catch (error) {
            typingIndicator.style.display = 'none';
            addMessage("An error occurred. Please check your connection.", 'ai');
        }
    }

    function addMessage(text, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}`;
        msgDiv.textContent = text;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    sendMessage.addEventListener('click', handleSend);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSend();
    });
})();

refreshMaterials();
