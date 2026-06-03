/* ============================================
   Shniro Notes — Student Home Logic (Async)
   ============================================ */

// Auth Guard
(function () {
    if (!DataStore.isLoggedIn()) { window.location.href = 'index.html'; return; }
    if (localStorage.getItem('sn_theme') === 'dark') document.body.classList.add('dark');
})();

const user = DataStore.getCurrentUser();
function renderAvatar(el, currentUser, fallback = 'S') {
    if (!el) return;
    const initial = currentUser && currentUser.name ? currentUser.name[0].toUpperCase() : fallback;
    el.textContent = '';
    if (currentUser && currentUser.profileImageUrl) {
        const img = document.createElement('img');
        img.src = safeAssetUrl(currentUser.profileImageUrl);
        img.alt = currentUser.name || 'Profile';
        el.appendChild(img);
        el.classList.add('has-image');
    } else {
        el.textContent = initial;
        el.classList.remove('has-image');
    }
}

if (user) {
    renderAvatar(document.getElementById('userAvatar'), user);
    document.getElementById('userName').textContent = user.name;
    const welcomeMeta = document.getElementById('welcomeMeta');
    if (welcomeMeta) {
        const meta = [user.instituteName, user.teacherName ? `Teacher: ${user.teacherName}` : ''].filter(Boolean);
        welcomeMeta.textContent = meta.length ? meta.join(' | ') : 'Browse and download study materials for your semester';
    }
    document.getElementById('welcomeMsg').textContent = 'Hey ' + user.name.split(' ')[0] + '! 👋';

    if (['admin', 'superadmin'].includes(user.role)) {
        const navRight = document.querySelector('.nav-right');
        if (navRight) {
            const adminBtn = document.createElement('button');
            adminBtn.className = 'btn-logout';
            adminBtn.style.color = 'var(--blue)';
            adminBtn.style.marginRight = '8px';
            adminBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg> Dashboard';
            adminBtn.onclick = () => window.location.href = user.role === 'superadmin' ? 'superadmin.html' : 'admin.html';
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

// Show upgrade modal (used when download or AI quota is blocked)
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
            const accBtn = document.getElementById('accountSidebarBtn');
            if (accBtn) {
                accBtn.click();
                setTimeout(() => { const up = document.getElementById('upgradePlanBtn'); if (up) up.click(); }, 350);
            } else {
                window.location.href = 'home.html';
            }
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

function esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function attr(str) {
    return esc(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function jsArg(value) {
    return attr(JSON.stringify(String(value || '')));
}

function safeAssetUrl(value) {
    const raw = String(value || '').trim();
    if (/^https?:\/\//i.test(raw) || /^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(raw)) return raw;
    return '';
}

function apiMaterialUrl(action, materialId, userId) {
    return `${API_BASE}/materials/${action}/${encodeURIComponent(materialId)}?userId=${encodeURIComponent(userId || '')}`;
}

let allMaterials = [];
let currentView = 'all';

async function refreshMaterials() {
    try {
        showSkeletons();
        allMaterials = await DataStore.getMaterials();
        renderMaterials();
        updateAccountSidebar();
    } catch (err) {
        showToast('Server connection failed', 'error');
    }
}

function updateAccountSidebar() {
    const user = DataStore.getCurrentUser();
    if (!user) return;

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value || '-';
    };

    const savedCount = DataStore.getFavorites().length;
    const role = user.role === 'superadmin' ? 'Super Admin' : user.role === 'admin' ? 'Admin' : 'Student';

    renderAvatar(document.getElementById('sidebarAvatar'), user);
    setText('sidebarName', user.name);
    setText('sidebarRole', role);
    setText('sidebarRollNo', user.rollNo);
    setText('sidebarEnrollNo', user.enrollNo);
    setText('sidebarInstitute', user.instituteName);
    setText('sidebarTeacher', user.teacherName);
    setText('sidebarBranch', user.branch);
    setText('sidebarSemester', user.semester ? `Semester ${user.semester}` : '-');
    setText('sidebarStatus', user.approved === false ? 'Pending' : 'Approved');
    setText('sidebarMaterialCount', String(allMaterials.length || 0));
    setText('sidebarSavedCount', String(savedCount || 0));
    // Update average rating display
    DataStore.getRatingStats().then(s => {
        const avgEl = document.getElementById('sidebarAvgRating');
        if (avgEl) {
            avgEl.textContent = (s && s.averageRating) ? `${s.averageRating} ★ (${s.totalRatings})` : '-';
        }
    }).catch(() => {});
}

function refreshCurrentUserProfileUi() {
    const updated = DataStore.getCurrentUser();
    if (!updated) return;
    renderAvatar(document.getElementById('userAvatar'), updated);
    renderAvatar(document.getElementById('sidebarAvatar'), updated);
    const userName = document.getElementById('userName');
    if (userName) userName.textContent = updated.name || 'Student';
    const welcomeMsg = document.getElementById('welcomeMsg');
    if (welcomeMsg && updated.name) welcomeMsg.textContent = 'Hey ' + updated.name.split(' ')[0] + '! 👋';
    const welcomeMeta = document.getElementById('welcomeMeta');
    if (welcomeMeta) {
        const meta = [updated.instituteName, updated.teacherName ? `Teacher: ${updated.teacherName}` : ''].filter(Boolean);
        welcomeMeta.textContent = meta.length ? meta.join(' | ') : 'Browse and download study materials for your semester';
    }
    updateAccountSidebar();
}

function openEditProfileModal() {
    const current = DataStore.getCurrentUser();
    if (!current) return;
    document.getElementById('profileName').value = current.name || '';
    document.getElementById('profileBranch').value = current.branch || '';
    document.getElementById('profileSemester').value = current.semester || '';
    document.getElementById('profileImageFile').value = '';
    const instituteField = document.getElementById('profileInstituteField');
    const instituteInput = document.getElementById('profileInstituteName');
    if (instituteField && instituteInput) {
        const canEditInstitute = ['admin', 'superadmin'].includes(current.role);
        instituteField.style.display = canEditInstitute ? 'block' : 'none';
        instituteInput.value = current.instituteName || '';
    }
    document.getElementById('editProfileModal').style.display = 'flex';
}

function closeEditProfileModal() {
    document.getElementById('editProfileModal').style.display = 'none';
}

async function saveCurrentUserProfile(e) {
    e.preventDefault();
    const file = document.getElementById('profileImageFile').files[0];

    try {
        const current = DataStore.getCurrentUser();
        const details = {
            name: document.getElementById('profileName').value.trim(),
            branch: document.getElementById('profileBranch').value.trim(),
            semester: document.getElementById('profileSemester').value.trim()
        };
        if (['admin', 'superadmin'].includes(current?.role)) {
            details.instituteName = document.getElementById('profileInstituteName').value.trim();
        }

        if (!details.name) {
            showToast('Name is required', 'error');
            return;
        }

        if (file && (!file.type || !file.type.startsWith('image/'))) {
            showToast('Please select an image file', 'error');
            return;
        }

        const btn = document.getElementById('saveProfileBtn');
        btn.disabled = true;
        btn.textContent = 'Saving...';
        const res = await DataStore.updateProfile(details, file);
        if (res.success) {
            refreshCurrentUserProfileUi();
            closeEditProfileModal();
            showToast('Profile updated', 'success');
        } else {
            showToast(res.message || 'Profile update failed', 'error');
        }
    } catch (err) {
        showToast('Profile update failed', 'error');
    } finally {
        const btn = document.getElementById('saveProfileBtn');
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Save';
        }
    }
}

function openAccountSidebar() {
    updateAccountSidebar();
    const overlay = document.getElementById('accountSidebarOverlay');
    if (!overlay) return;
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('account-sidebar-open');
}

function closeAccountSidebar() {
    const overlay = document.getElementById('accountSidebarOverlay');
    if (!overlay) return;
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('account-sidebar-open');
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
                    <button class="fav-btn active" onclick="toggleFav(event, ${jsArg(m.id || m._id)})">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.84-8.84 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    </button>
                </div>
                <div onclick="openMatModal(${jsArg(m.id || m._id)})" style="margin-top: 14px; cursor:pointer;">
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
    updateAccountSidebar();
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
    const currentUser = DataStore.getCurrentUser();
    document.getElementById('modalView').onclick = () => window.location.href = apiMaterialUrl('view', m.id || m._id, currentUser && currentUser.id);
    const downloadBtn = document.getElementById('modalDownload');
    const canDownload = currentUser && (['admin', 'superadmin'].includes(currentUser.role) || currentUser.plan === 'pro');
    if (canDownload) {
        downloadBtn.disabled = false;
        downloadBtn.onclick = () => {
            window.location.href = apiMaterialUrl('download', m.id || m._id, currentUser.id);
            showToast('Download started!', 'success');
        };
    } else {
        // Allow click to open upgrade prompt (do not perform download)
        downloadBtn.disabled = false;
        downloadBtn.style.opacity = '0.95';
        downloadBtn.onclick = () => showUpgradeModal('Upgrade Required', 'Downloads are available only for upgraded users. Upgrade to Pro to enable downloads and increased AI quota.');
    }
    document.getElementById('matModal').style.display = 'flex';
}

function closeMatModal() { document.getElementById('matModal').style.display = 'none'; }

document.getElementById('searchInput').addEventListener('input', renderMaterials);
document.getElementById('logoutBtn').addEventListener('click', () => { DataStore.logout(); window.location.href = 'index.html'; });

document.getElementById('accountSidebarBtn')?.addEventListener('click', openAccountSidebar);
document.getElementById('userAvatar')?.addEventListener('click', openAccountSidebar);
document.getElementById('userAvatar')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openAccountSidebar();
    }
});
document.getElementById('closeAccountSidebar')?.addEventListener('click', closeAccountSidebar);
document.getElementById('editProfileBtn')?.addEventListener('click', openEditProfileModal);
document.getElementById('closeEditProfileModal')?.addEventListener('click', closeEditProfileModal);
document.getElementById('cancelEditProfileBtn')?.addEventListener('click', closeEditProfileModal);
document.getElementById('editProfileForm')?.addEventListener('submit', saveCurrentUserProfile);
document.getElementById('editProfileModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'editProfileModal') closeEditProfileModal();
});
document.getElementById('accountSidebarOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'accountSidebarOverlay') closeAccountSidebar();
});
document.getElementById('upgradePlanBtn')?.addEventListener('click', () => {
    showToast('Upgrade request feature is coming soon', 'info');
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAccountSidebar();
});

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

// Rate App modal logic
let selectedRating = 0;

function openRateModal() {
    const modal = document.getElementById('rateModal');
    if (!modal) return;
    document.getElementById('rateReview').value = '';
    selectedRating = 0;
    setStars(0);

    const userId = user?.id;
    if (userId) {
        DataStore.getUserRating(userId).then(r => {
            if (r) {
                if (r.rating) setStars(r.rating);
                if (r.review) document.getElementById('rateReview').value = r.review;
            }
        }).catch(() => {});
    }

    DataStore.getRatingStats().then(s => {
        if (s && s.averageRating !== undefined) {
            const avg = document.getElementById('sidebarAvgRating');
            if (avg) avg.textContent = `${s.averageRating} ★ (${s.totalRatings})`;
            const el = document.getElementById('rateAvgDisplay');
            if (el) el.textContent = `Average: ${s.averageRating} (${s.totalRatings})`;
        }
    }).catch(() => {});

    modal.style.display = 'flex';
}

function closeRateModal() { const modal = document.getElementById('rateModal'); if (modal) modal.style.display = 'none'; }

function setStars(rating) {
    selectedRating = Number(rating) || 0;
    const stars = document.querySelectorAll('#rateStars .rate-star');
    stars.forEach(s => {
        const val = Number(s.dataset.value);
        s.textContent = val <= selectedRating ? '★' : '☆';
        s.classList.toggle('active', val <= selectedRating);
    });
}

document.addEventListener('click', (e) => {
    if (e.target && e.target.classList && e.target.classList.contains('rate-star')) {
        setStars(e.target.dataset.value);
    }
});

document.getElementById('rateAppBtn')?.addEventListener('click', openRateModal);
document.getElementById('submitRatingBtn')?.addEventListener('click', async () => {
    if (!user) { showToast('Please log in to submit rating', 'info'); return; }
    if (!selectedRating || selectedRating < 1) { showToast('Please select a rating (1-5)', 'info'); return; }
    const review = document.getElementById('rateReview').value.trim();
    try {
        const res = await DataStore.submitRating(user.id, selectedRating, review);
        if (res && (res.message || res.rating)) {
            showToast('Rating saved. Thank you!', 'success');
            closeRateModal();
            DataStore.getRatingStats().then(s => {
                if (s && s.averageRating !== undefined) {
                    const avgEl = document.getElementById('sidebarAvgRating');
                    if (avgEl) avgEl.textContent = `${s.averageRating} ★ (${s.totalRatings})`;
                }
            }).catch(() => {});
        } else {
            showToast(res.error || 'Unable to save rating', 'error');
        }
    } catch (err) {
        showToast('Server error while saving rating', 'error');
    }
});

// AI Assistant Logic
(function() {
    const aiBtn = document.getElementById('aiAssistantBtn');
    const chatContainer = document.getElementById('chatContainer');
    const closeChat = document.getElementById('closeChat');
    const chatInput = document.getElementById('chatInput');
    const sendMessage = document.getElementById('sendMessage');
    const chatMessages = document.getElementById('chatMessages');
    const typingIndicator = document.getElementById('typingIndicator');
    const chatHistory = [];
    let isSending = false;

    if (!aiBtn) return;

    aiBtn.addEventListener('click', () => {
        chatContainer.classList.toggle('active');
    });

    closeChat.addEventListener('click', () => {
        chatContainer.classList.remove('active');
    });

    async function handleSend() {
        const text = chatInput.value.trim();
        if (!text || isSending) return;

        addMessage(text, 'user');
        chatHistory.push({ role: 'user', content: text });
        trimChatHistory();
        chatInput.value = '';

        isSending = true;
        chatInput.disabled = true;
        sendMessage.disabled = true;
        typingIndicator.style.display = 'block';
        chatMessages.scrollTop = chatMessages.scrollHeight;

        try {
            const response = await fetch(`${window.API_BASE}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    history: chatHistory.slice(0, -1).slice(-10),
                    context: buildAssistantContext(text),
                    userId: user?.id
                })
            });

            const data = await response.json().catch(() => ({}));

        if (response.ok && data.response) {
            addMessage(data.response, 'ai');
            chatHistory.push({ role: 'assistant', content: data.response });
            trimChatHistory();
            // Update stored user AI usage info if provided
            if (data.aiQuestionsUsed !== undefined) {
                const cur = DataStore.getCurrentUser();
                if (cur) {
                    cur.aiQuestionsUsed = data.aiQuestionsUsed;
                    cur.plan = cur.plan || 'free';
                    DataStore.setCurrentUser(cur);
                }
            }
        } else {
            // If response indicates quota exceeded, show upgrade modal
            if (response.status === 429 || (data && data.error && /limit|quota|upgrade/i.test(data.error))) {
                showUpgradeModal('AI Limit Reached', data.error || 'Your daily AI question limit has been reached. Upgrade to Pro to increase your quota.');
            } else {
                addMessage(data.error || "Sorry, I'm having trouble answering right now. Please try again.", 'ai');
            }
        }
        } catch (error) {
            addMessage("I couldn't reach the assistant server. Please check your connection and make sure the backend is running.", 'ai');
        } finally {
            isSending = false;
            chatInput.disabled = false;
            sendMessage.disabled = false;
            typingIndicator.style.display = 'none';
            chatInput.focus();
        }
    }

    function buildAssistantContext(prompt) {
        const promptWords = prompt.toLowerCase().split(/\W+/).filter(word => word.length > 2);
        const scoredMaterials = allMaterials
            .map(material => {
                const searchable = `${material.title || ''} ${material.subject || ''} ${material.category || ''}`.toLowerCase();
                const score = promptWords.reduce((sum, word) => sum + (searchable.includes(word) ? 1 : 0), 0);
                return { material, score };
            })
            .sort((a, b) => b.score - a.score);

        const relevantMaterials = scoredMaterials.some(item => item.score > 0)
            ? scoredMaterials.filter(item => item.score > 0)
            : scoredMaterials;

        const topMaterials = relevantMaterials
            .slice(0, 12)
            .map(item => ({
                id: item.material.id || item.material._id,
                title: item.material.title,
                subject: item.material.subject,
                category: item.material.category || item.material.type || 'Material'
            }));

        return {
            userName: user?.name || 'Student',
            materials: topMaterials
        };
    }

    function addMessage(text, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}`;

        if (sender === 'ai') {
            msgDiv.innerHTML = formatAssistantMessage(text);
        } else {
            msgDiv.textContent = text;
        }

        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function formatAssistantMessage(text) {
        const lines = esc(text).replace(/\r\n/g, '\n').split('\n');
        const html = [];
        let listType = null;
        let inCodeBlock = false;
        let codeLines = [];
        let listIndex = 0;

        const closeList = () => {
            if (!listType) return;
            html.push(`</${listType}>`);
            listType = null;
            listIndex = 0;
        };

        const closeCodeBlock = () => {
            if (!inCodeBlock) return;
            html.push(`<pre><code>${codeLines.join('\n')}</code></pre>`);
            codeLines = [];
            inCodeBlock = false;
        };

        const openList = (type) => {
            if (listType === type) return;
            closeList();
            html.push(`<${type}>`);
            listType = type;
            listIndex = 0;
        };

        lines.forEach(rawLine => {
            const line = rawLine.trim();

            if (line.startsWith('```')) {
                closeList();
                if (inCodeBlock) {
                    closeCodeBlock();
                } else {
                    inCodeBlock = true;
                    codeLines = [];
                }
                return;
            }

            if (inCodeBlock) {
                codeLines.push(rawLine);
                return;
            }

            if (!line) {
                closeList();
                return;
            }

            const headingMatch =
                line.match(/^#{1,6}\s+(.+)$/) ||
                line.match(/^\*\*(.+?)\*\*:?\s*$/) ||
                line.match(/^([A-Z][A-Za-z0-9 /&+-]{2,42}):$/);
            if (headingMatch) {
                closeList();
                html.push(`<div class="chat-answer-heading">${formatInline(headingMatch[1])}</div>`);
                return;
            }

            const bulletMatch = line.match(/^(?:[-*•]|–|—)\s+(.+)$/);
            if (bulletMatch) {
                openList('ul');
                html.push(`<li><span class="chat-list-icon" aria-hidden="true"><svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4"/></svg></span><span class="chat-list-text">${formatInline(bulletMatch[1])}</span></li>`);
                return;
            }

            const numberedMatch = line.match(/^\d+[.)]\s+(.+)$/);
            if (numberedMatch) {
                openList('ol');
                listIndex += 1;
                html.push(`<li><span class="chat-list-number" aria-hidden="true">${listIndex}</span><span class="chat-list-text">${formatInline(numberedMatch[1])}</span></li>`);
                return;
            }

            closeList();
            html.push(`<p>${formatInline(line)}</p>`);
        });

        closeList();
        closeCodeBlock();
        return html.join('');
    }

    function formatInline(text) {
        const codeParts = [];
        const withPlaceholders = text.replace(/`([^`]+)`/g, (_, code) => {
            codeParts.push(`<code>${code}</code>`);
            return `@@CODE_${codeParts.length - 1}@@`;
        });

        return withPlaceholders
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/@@CODE_(\d+)@@/g, (_, index) => codeParts[Number(index)] || '');
    }

    function trimChatHistory() {
        if (chatHistory.length > 20) {
            chatHistory.splice(0, chatHistory.length - 20);
        }
    }

    sendMessage.addEventListener('click', handleSend);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSend();
        }
    });
})();

refreshMaterials();
