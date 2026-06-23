/* ============================================
   YuVision — Admin Dashboard Logic (Async)
   ============================================ */

// Auth Guard
(function () {
    if (!DataStore.isLoggedIn() || !DataStore.isAdmin()) {
        window.location.href = 'index.html';
        return;
    }
    if (localStorage.getItem('sn_theme') === 'dark') document.body.classList.add('dark');
})();

const currentAdmin = DataStore.getCurrentUser();
function renderAvatar(el, currentUser, fallback = 'A') {
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

if (currentAdmin) {
    const navUser = document.querySelector('.nav-user');
    const avatar = navUser && navUser.querySelector('.avatar-circle');
    const label = navUser && navUser.querySelector('span');
    const instituteLabel = document.getElementById('adminInstituteName');
    renderAvatar(avatar, currentAdmin);
    if (label) label.textContent = currentAdmin.name || 'Admin';
    if (instituteLabel) instituteLabel.textContent = currentAdmin.instituteName || 'Institution not set';
}

// --- Toast ---
function showToast(msg, type = 'info') {
    const box = document.getElementById('toastBox');
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = msg;
    box.appendChild(toast);
    setTimeout(() => { toast.classList.add('hide'); setTimeout(() => toast.remove(), 300); }, 3500);
}

function esc(str) {
    if (str === null || str === undefined) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
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

function refreshCurrentUserProfileUi() {
    const updated = DataStore.getCurrentUser();
    if (!updated) return;
    renderAvatar(document.getElementById('adminProfileAvatar'), updated);
    const navUser = document.querySelector('.nav-user');
    const label = navUser && navUser.querySelector('span');
    const instituteLabel = document.getElementById('adminInstituteName');
    if (label) label.textContent = updated.name || 'Admin';
    if (instituteLabel) instituteLabel.textContent = updated.instituteName || 'Institution not set';
}

function openEditProfileModal() {
    const current = DataStore.getCurrentUser();
    if (!current) return;
    document.getElementById('profileName').value = current.name || '';
    document.getElementById('profileInstituteName').value = current.instituteName || '';
    document.getElementById('profileBranch').value = current.branch || '';
    document.getElementById('profileSemester').value = current.semester || '';
    document.getElementById('profileImageFile').value = '';
    document.getElementById('editProfileModal').style.display = 'flex';
}

function closeEditProfileModal() {
    document.getElementById('editProfileModal').style.display = 'none';
}

async function saveCurrentUserProfile(e) {
    if (e) e.preventDefault();
    const file = document.getElementById('profileImageFile').files[0];

    try {
        const details = {
            name: document.getElementById('profileName').value.trim(),
            instituteName: document.getElementById('profileInstituteName').value.trim(),
            branch: document.getElementById('profileBranch').value.trim(),
            semester: document.getElementById('profileSemester').value.trim()
        };

        if (!details.name || !details.instituteName) {
            showToast('Name and institution are required', 'error');
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

// --- Data Fetching ---
async function refreshData() {
    try {
        const data = await DataStore.getAdminData();
        renderPending(data.pending);
        renderStudents(data.students);
        renderMaterials(data.materials);
        renderQuizScores(data.quizScores || []);
        
        document.getElementById('statPending').textContent = data.pending.length;
        document.getElementById('statStudents').textContent = data.students.length;
        document.getElementById('statMaterials').textContent = data.materials.length;

        // Fetch System Status
        updateSystemStatus();
    } catch (err) {
        showToast('Failed to load data from server', 'error');
    }
}

async function updateSystemStatus() {
    try {
        const res = await DataStore.getSystemStatus();
        if (res.success) {
            const s = res.status;
            updateStatusDot('statusVercel', s.vercel === 'online');
            updateStatusDot('statusRender', s.render === 'online');
            updateStatusDot('statusSupabase', s.supabase === 'online');
            updateStatusDot('statusMongodb', s.mongodb === 'online');
        }
    } catch (e) {
        console.error('System status check failed');
    }
}

function updateStatusDot(id, isOnline) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'status-dot ' + (isOnline ? 'online' : 'offline');
    el.title = isOnline ? 'Online' : 'Offline';
}

// --- Renders ---
function renderPending(pending) {
    const list = document.getElementById('pendingList');
    const empty = document.getElementById('pendingEmpty');
    list.innerHTML = '';
    if (pending.length === 0) { list.style.display = 'none'; empty.style.display = 'block'; return; }
    list.style.display = 'block'; empty.style.display = 'none';

    pending.forEach(p => {
        const row = document.createElement('div');
        row.className = 'user-row';
        row.innerHTML = `
            <div class="user-info">
                <div class="avatar-circle">${p.name[0].toUpperCase()}</div>
                <div>
                    <div class="user-name">${esc(p.name)}</div>
                    <div class="user-meta">${esc(p.instituteName || '')} | ${esc(p.rollNo)} | ${esc(p.enrollNo)}</div>
                </div>
            </div>
            <div class="user-actions">
                <button class="btn btn-primary btn-sm" onclick="approveUser(${jsArg(p.id)})">Approve</button>
                <button class="btn btn-ghost btn-sm" onclick="rejectUser(${jsArg(p.id)})" style="color:var(--error)">Reject</button>
            </div>
        `;
        list.appendChild(row);
    });
}

function renderStudents(students) {
    const list = document.getElementById('studentsList');
    const empty = document.getElementById('studentsEmpty');
    list.innerHTML = '';
    if (students.length === 0) { list.style.display = 'none'; empty.style.display = 'block'; return; }
    list.style.display = 'block'; empty.style.display = 'none';

    students.forEach(u => {
        const row = document.createElement('div');
        row.className = 'user-row';
        row.innerHTML = `
            <div class="user-info">
                <div class="avatar-circle">${u.name[0].toUpperCase()}</div>
                <div><div class="user-name">${esc(u.name)}</div><div class="user-meta">${esc(u.instituteName || '')} | ${esc(u.rollNo)} | Plan: ${esc(u.plan || 'free')}</div></div>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
                ${u.plan === 'pro' ? '' : `<button class="btn btn-primary btn-sm" onclick="upgradeUser(${jsArg(u.id)})">Upgrade</button>`}
                <button class="btn btn-ghost btn-sm" onclick="removeUser(${jsArg(u.id)})" style="color:var(--error)">Remove</button>
            </div>
        `;
        list.appendChild(row);
    });
}

function renderQuizScores(scores) {
    const list = document.getElementById('quizScoresList');
    const empty = document.getElementById('quizScoresEmpty');
    if (!list || !empty) return;

    list.innerHTML = '';
    if (!scores.length) {
        list.style.display = 'none';
        empty.style.display = 'block';
        return;
    }

    list.style.display = 'block';
    empty.style.display = 'none';

    scores.forEach(score => {
        const row = document.createElement('div');
        row.className = 'user-row';
        const submitted = score.submittedAt ? new Date(score.submittedAt).toLocaleString() : 'Not available';
        row.innerHTML = `
            <div class="user-info">
                <div class="avatar-circle">${esc(score.studentName || 'S')[0].toUpperCase()}</div>
                <div>
                    <div class="user-name">${esc(score.studentName || 'Student')} <span class="nav-tag">${esc(score.subject || 'Quiz')}</span></div>
                    <div class="user-meta">${esc(score.quizTitle || 'Quiz')} | Roll: ${esc(score.studentRollNo || '-')} | Attempts: ${esc(score.attempts || 1)}</div>
                    <div class="user-meta">Last: ${esc(score.score)}/${esc(score.total)} (${esc(score.percentage)}%) | Best: ${esc(score.bestScore)}/${esc(score.total)} (${esc(score.bestPercentage)}%) | ${esc(submitted)}</div>
                </div>
            </div>
        `;
        list.appendChild(row);
    });
}

function renderMaterials(materials) {
    const list = document.getElementById('materialsAdminList');
    list.innerHTML = '';
    materials.forEach(m => {
        const row = document.createElement('div');
        row.className = 'user-row';
        row.innerHTML = `
            <div class="user-info">
                <div class="avatar-circle" style="background:var(--blue-light); color:var(--blue)">📄</div>
                <div><div class="user-name">${esc(m.title)}</div><div class="user-meta">${esc(m.subject)} • ${esc(m.size)}</div></div>
            </div>
            <div class="user-actions">
                <button class="btn-icon-tile" onclick="window.location.href = apiMaterialUrl('view', ${jsArg(m.id)}, DataStore.getCurrentUser() && DataStore.getCurrentUser().id)" title="View" style="color:var(--blue); background:var(--blue-light);">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button class="btn-icon-tile" onclick="window.location.href = apiMaterialUrl('download', ${jsArg(m.id)}, DataStore.getCurrentUser() && DataStore.getCurrentUser().id)" title="Download" style="color:var(--green); background:rgba(46,204,113,0.1);">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
                <button class="btn-icon-tile" onclick="deleteMat(${jsArg(m.id)})" title="Delete" style="color:var(--error); background:rgba(231,76,60,0.1);">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
            </div>
        `;
        list.appendChild(row);
    });
}

// --- Actions ---
async function approveUser(id) {
    const res = await DataStore.approvePending(id);
    if (res.success) { showToast('Approved!', 'success'); refreshData(); }
}

async function rejectUser(id) {
    const res = await DataStore.rejectPending(id);
    if (res.success) { showToast('Rejected', 'info'); refreshData(); }
}

async function removeUser(id) {
    if (confirm('Delete student?')) {
        const res = await DataStore.removeUser(id);
        if (res.success) { showToast('Removed', 'success'); refreshData(); }
    }
}

async function upgradeUser(id) {
    if (!confirm('Upgrade this user to Pro plan?')) return;
    const res = await DataStore.upgradeUser(id);
    if (res && res.success) {
        showToast('User upgraded to Pro', 'success');
        refreshData();
    } else {
        showToast(res && res.message ? res.message : 'Upgrade failed', 'error');
    }
}

async function deleteMat(id) {
    if (confirm('Delete material?')) {
        const res = await DataStore.deleteMaterial(id);
        if (res.success) { showToast('Deleted', 'success'); refreshData(); }
    }
}

// --- Upload Logic ---
function toggleUploadForm() {
    const form = document.getElementById('uploadForm');
    const area = document.getElementById('uploadArea');
    const visible = form.style.display === 'block';
    form.style.display = visible ? 'none' : 'block';
    area.style.display = visible ? 'block' : 'none';
}

function updateUploadFields() {
    const val = document.getElementById('matCategory').value;
    const videoSource = document.getElementById('matVideoSource').value;
    const fileGroup = document.getElementById('fileFieldGroup');
    const linkGroup = document.getElementById('linkFieldGroup');
    const quizGroup = document.getElementById('quizFieldGroup');
    const videoSourceGroup = document.getElementById('videoSourceGroup');
    const fileInput = document.getElementById('matFile');
    const linkInput = document.getElementById('matLink');
    const fileLabel = document.getElementById('matFileLabel');
    
    if (val === 'Video') {
        videoSourceGroup.style.display = 'block';
        quizGroup.style.display = 'none';

        if (videoSource === 'file') {
            fileGroup.style.display = 'block';
            linkGroup.style.display = 'none';
            fileInput.required = true;
            linkInput.required = false;
            fileInput.accept = 'video/*';
            fileLabel.textContent = 'Select Video File';
        } else {
            fileGroup.style.display = 'none';
            linkGroup.style.display = 'block';
            fileInput.required = false;
            linkInput.required = true;
            fileInput.accept = '';
            fileLabel.textContent = 'Select File';
        }
    } else if (val === 'Quiz') {
        videoSourceGroup.style.display = 'none';
        fileGroup.style.display = 'none';
        linkGroup.style.display = 'none';
        quizGroup.style.display = 'block';
        fileInput.required = false;
        linkInput.required = false;
        fileInput.accept = '';
        fileLabel.textContent = 'Select File';
    } else {
        videoSourceGroup.style.display = 'none';
        fileGroup.style.display = 'block';
        linkGroup.style.display = 'none';
        quizGroup.style.display = 'none';
        fileInput.required = true;
        linkInput.required = false;
        fileInput.accept = '.pdf,.doc,.docx,.ppt,.pptx,.txt';
        fileLabel.textContent = 'Select File';
    }
}

document.getElementById('matCategory').addEventListener('change', updateUploadFields);
document.getElementById('matVideoSource').addEventListener('change', updateUploadFields);
updateUploadFields();

document.getElementById('addMaterialForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('uploadBtn');
    btn.disabled = true;
    btn.textContent = 'Uploading...';

    const category = document.getElementById('matCategory').value;
    const formData = new FormData();
    formData.append('title', document.getElementById('matTitle').value);
    formData.append('subject', document.getElementById('matSubject').value);
    formData.append('category', category);
    
    if (category === 'Video') {
        const videoSource = document.getElementById('matVideoSource').value;
        formData.append('videoSource', videoSource);

        if (videoSource === 'file') {
            const fileInput = document.getElementById('matFile');
            const file = fileInput.files && fileInput.files[0];

            if (!file) {
                showToast('Please select a video file to upload', 'error');
                btn.disabled = false;
                btn.textContent = 'Upload';
                fileInput.focus();
                return;
            }

            if (file.type && !file.type.startsWith('video/')) {
                showToast('Please select a valid video file', 'error');
                btn.disabled = false;
                btn.textContent = 'Upload';
                fileInput.focus();
                return;
            }

            formData.append('file', file);
        } else {
            const link = document.getElementById('matLink').value.trim();

            if (!link) {
                showToast('Please enter a video link', 'error');
                btn.disabled = false;
                btn.textContent = 'Upload';
                document.getElementById('matLink').focus();
                return;
            }

            formData.append('link', link);
        }
    } else if (category === 'Quiz') {
        // Collect quiz questions
        const questions = [];
        document.querySelectorAll('.question-input-group').forEach((group, idx) => {
            const q = group.querySelector('.question-text').value.trim();
            const options = Array.from(group.querySelectorAll('.option-input')).map(opt => opt.value.trim());
            const correct = parseInt(group.querySelector('.correct-answer-select').value);
            const explanation = group.querySelector('.explanation-input').value.trim();
            
            if (q && options.filter(o => o).length >= 2) {
                questions.push({ question: q, options, correctAnswer: correct, explanation });
            }
        });

        if (questions.length === 0) {
            showToast('Add at least one complete question', 'error');
            btn.disabled = false;
            btn.textContent = 'Upload';
            return;
        }

        formData.append('questions', JSON.stringify(questions));
    } else {
        const fileInput = document.getElementById('matFile');
        const file = fileInput.files && fileInput.files[0];

        if (!file) {
            showToast('Please select a file to upload', 'error');
            btn.disabled = false;
            btn.textContent = 'Upload';
            fileInput.focus();
            return;
        }

        formData.append('file', file);
    }

    try {
        const res = await DataStore.uploadMaterial(formData);
        if (res.success) {
            showToast('Uploaded successfully!', 'success');
            document.getElementById('addMaterialForm').reset();
            document.getElementById('questionsContainer').innerHTML = '';
            updateUploadFields();
            
            toggleUploadForm();
            refreshData();
        } else {
            showToast(res.message, 'error');
        }
    } catch (err) {
        showToast('Upload failed', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Upload';
    }
});

// Quiz Question Management
function addQuizQuestion() {
    const container = document.getElementById('questionsContainer');
    const qNum = container.querySelectorAll('.question-input-group').length + 1;
    
    const questionGroup = document.createElement('div');
    questionGroup.className = 'question-input-group';
    
    questionGroup.innerHTML = `
        <div class="question-card-head">
            <label>Question ${qNum}</label>
            <button type="button" onclick="this.closest('.question-input-group').remove()" class="btn btn-ghost btn-inline">Remove</button>
        </div>
        <input type="text" class="question-text input-box" placeholder="Enter question" required>
        <div class="options-grid">
            <input type="text" class="option-input input-box" placeholder="Option 1">
            <input type="text" class="option-input input-box" placeholder="Option 2">
            <input type="text" class="option-input input-box" placeholder="Option 3">
            <input type="text" class="option-input input-box" placeholder="Option 4">
        </div>
        <div class="answer-grid">
            <select class="correct-answer-select input-box" required>
                <option value="">Select...</option>
                <option value="0">Option 1</option>
                <option value="1">Option 2</option>
                <option value="2">Option 3</option>
                <option value="3">Option 4</option>
            </select>
            <input type="text" class="explanation-input input-box" placeholder="Explanation (optional)">
        </div>
    `;
    
    container.appendChild(questionGroup);
}

// --- Tab Logic ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab + 'Tab').classList.add('active');
    });
});

document.getElementById('logoutBtn').addEventListener('click', () => { DataStore.logout(); window.location.href = 'index.html'; });
document.getElementById('editProfileBtn')?.addEventListener('click', openEditProfileModal);
document.getElementById('closeEditProfileModal')?.addEventListener('click', closeEditProfileModal);
document.getElementById('cancelEditProfileBtn')?.addEventListener('click', closeEditProfileModal);
document.getElementById('editProfileForm')?.addEventListener('submit', saveCurrentUserProfile);
document.getElementById('editProfileModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'editProfileModal') closeEditProfileModal();
});

// Mobile Theme Toggle
const mobTheme = document.getElementById('mobileThemeToggle');
if (mobTheme) {
    mobTheme.addEventListener('click', () => {
        document.body.classList.toggle('dark');
        const isDark = document.body.classList.contains('dark');
        localStorage.setItem('sn_theme', isDark ? 'dark' : 'light');
    });
}

// --- Init ---
refreshData();
