/* ============================================
   Shniro Notes - Super Admin Dashboard Logic
   ============================================ */

(function () {
    if (!DataStore.isLoggedIn() || !DataStore.isSuperAdmin()) {
        window.location.href = 'index.html';
        return;
    }
    if (localStorage.getItem('sn_theme') === 'dark') document.body.classList.add('dark');
})();

const currentSuperAdmin = DataStore.getCurrentUser();
if (currentSuperAdmin) {
    const navUser = document.querySelector('.nav-user');
    const avatar = navUser && navUser.querySelector('.avatar-circle');
    const label = navUser && navUser.querySelector('span');
    if (avatar) avatar.textContent = currentSuperAdmin.name ? currentSuperAdmin.name[0].toUpperCase() : 'S';
    if (label) label.textContent = currentSuperAdmin.name || 'Super Admin';
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
    if (str === null || str === undefined) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
}

function avatarText(name, fallback = 'U') {
    return esc((name || fallback)[0].toUpperCase());
}

function adminName(user) {
    if (!user || !user.adminId) return 'Unassigned';
    if (typeof user.adminId === 'string') return user.adminId;
    return user.adminId.name || user.adminId.rollNo || 'Admin';
}

async function refreshData() {
    try {
        const data = await DataStore.getSuperAdminData();
        if (data.success === false) throw new Error(data.message || 'Failed');

        renderPendingAdmins(data.pendingAdmins || []);
        renderAdmins(data.admins || []);
        renderStudents(data.pendingStudents || [], data.students || []);
        renderMaterials(data.materials || []);

        document.getElementById('statPendingAdmins').textContent = (data.pendingAdmins || []).length;
        document.getElementById('statAdmins').textContent = (data.admins || []).length;
        document.getElementById('statStudents').textContent = (data.students || []).length;
        document.getElementById('statMaterials').textContent = (data.materials || []).length;
    } catch (err) {
        showToast('Failed to load super admin data', 'error');
    }
}

function renderPendingAdmins(admins) {
    const list = document.getElementById('pendingAdminsList');
    const empty = document.getElementById('pendingAdminsEmpty');
    list.innerHTML = '';
    if (!admins.length) { list.style.display = 'none'; empty.style.display = 'block'; return; }
    list.style.display = 'block'; empty.style.display = 'none';

    admins.forEach(admin => {
        const row = document.createElement('div');
        row.className = 'user-row';
        row.innerHTML = `
            <div class="user-info">
                <div class="avatar-circle">${avatarText(admin.name, 'A')}</div>
                <div>
                    <div class="user-name">${esc(admin.name)}</div>
                    <div class="user-meta">${esc(admin.rollNo)} | ${esc(admin.enrollNo)} | ${esc(admin.branch || 'Admin')}</div>
                </div>
            </div>
            <div class="user-actions">
                <button class="btn btn-primary btn-sm" onclick="approveAdmin('${admin.id}')">Approve</button>
                <button class="btn btn-ghost btn-sm" onclick="rejectAdmin('${admin.id}')" style="color:var(--error)">Reject</button>
            </div>
        `;
        list.appendChild(row);
    });
}

function renderAdmins(admins) {
    const list = document.getElementById('adminsList');
    const empty = document.getElementById('adminsEmpty');
    list.innerHTML = '';
    if (!admins.length) { list.style.display = 'none'; empty.style.display = 'block'; return; }
    list.style.display = 'block'; empty.style.display = 'none';

    admins.forEach(admin => {
        const row = document.createElement('div');
        row.className = 'user-row';
        row.innerHTML = `
            <div class="user-info">
                <div class="avatar-circle">${avatarText(admin.name, 'A')}</div>
                <div>
                    <div class="user-name">${esc(admin.name)}</div>
                    <div class="user-meta">${esc(admin.rollNo)} | ${esc(admin.enrollNo)}</div>
                </div>
            </div>
            <div class="user-actions">
                <button class="btn btn-ghost btn-sm" onclick="removeAdmin('${admin.id}')" style="color:var(--error)">Remove</button>
            </div>
        `;
        list.appendChild(row);
    });
}

function renderStudents(pending, students) {
    const pendingList = document.getElementById('pendingStudentsList');
    const list = document.getElementById('studentsList');
    const empty = document.getElementById('studentsEmpty');
    pendingList.innerHTML = '';
    list.innerHTML = '';

    pending.forEach(student => {
        const row = document.createElement('div');
        row.className = 'user-row';
        row.innerHTML = `
            <div class="user-info">
                <div class="avatar-circle">${avatarText(student.name, 'S')}</div>
                <div>
                    <div class="user-name">${esc(student.name)} <span class="nav-tag">PENDING</span></div>
                    <div class="user-meta">${esc(student.rollNo)} | ${esc(student.enrollNo)} | Admin: ${esc(adminName(student))}</div>
                </div>
            </div>
            <div class="user-actions">
                <button class="btn btn-primary btn-sm" onclick="approveStudent('${student.id}')">Approve</button>
                <button class="btn btn-ghost btn-sm" onclick="rejectStudent('${student.id}')" style="color:var(--error)">Reject</button>
            </div>
        `;
        pendingList.appendChild(row);
    });

    students.forEach(student => {
        const row = document.createElement('div');
        row.className = 'user-row';
        row.innerHTML = `
            <div class="user-info">
                <div class="avatar-circle">${avatarText(student.name, 'S')}</div>
                <div>
                    <div class="user-name">${esc(student.name)}</div>
                    <div class="user-meta">${esc(student.rollNo)} | Plan: ${esc(student.plan || 'free')} | Admin: ${esc(adminName(student))}</div>
                </div>
            </div>
            <div class="user-actions">
                ${student.plan === 'pro' ? '' : `<button class="btn btn-primary btn-sm" onclick="upgradeStudent('${student.id}')">Upgrade</button>`}
                <button class="btn btn-ghost btn-sm" onclick="removeStudent('${student.id}')" style="color:var(--error)">Remove</button>
            </div>
        `;
        list.appendChild(row);
    });

    const hasStudents = pending.length || students.length;
    pendingList.style.display = pending.length ? 'block' : 'none';
    list.style.display = students.length ? 'block' : 'none';
    empty.style.display = hasStudents ? 'none' : 'block';
}

function renderMaterials(materials) {
    const list = document.getElementById('materialsAdminList');
    list.innerHTML = '';
    if (!materials.length) {
        list.innerHTML = '<div class="empty-state"><h3>No materials yet</h3></div>';
        return;
    }

    materials.forEach(mat => {
        const owner = mat.createdBy && typeof mat.createdBy === 'object'
            ? (mat.createdBy.name || mat.createdBy.rollNo || 'Admin')
            : 'Unassigned';
        const row = document.createElement('div');
        row.className = 'user-row';
        row.innerHTML = `
            <div class="user-info">
                <div class="avatar-circle" style="background:var(--blue-light); color:var(--blue)">N</div>
                <div>
                    <div class="user-name">${esc(mat.title)}</div>
                    <div class="user-meta">${esc(mat.subject)} | ${esc(mat.size)} | Owner: ${esc(owner)}</div>
                </div>
            </div>
            <div class="user-actions">
                <button class="btn-icon-tile" onclick="window.location.href = \`${API_BASE}/materials/view/${mat.id}?userId=${currentSuperAdmin.id}\`" title="View" style="color:var(--blue); background:var(--blue-light);">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button class="btn-icon-tile" onclick="deleteMat('${mat.id}')" title="Delete" style="color:var(--error); background:rgba(231,76,60,0.1);">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>
        `;
        list.appendChild(row);
    });
}

async function approveAdmin(id) {
    const res = await DataStore.approveAdmin(id);
    showToast(res.success ? 'Admin approved' : res.message || 'Approval failed', res.success ? 'success' : 'error');
    if (res.success) refreshData();
}

async function rejectAdmin(id) {
    const res = await DataStore.rejectAdmin(id);
    showToast(res.success ? 'Admin request rejected' : res.message || 'Reject failed', res.success ? 'info' : 'error');
    if (res.success) refreshData();
}

async function removeAdmin(id) {
    if (!confirm('Remove this admin? Their students will become pending and unassigned.')) return;
    const res = await DataStore.removeAdmin(id);
    showToast(res.success ? 'Admin removed' : res.message || 'Remove failed', res.success ? 'success' : 'error');
    if (res.success) refreshData();
}

async function approveStudent(id) {
    const res = await DataStore.approveStudent(id);
    showToast(res.success ? 'Student approved' : res.message || 'Approval failed', res.success ? 'success' : 'error');
    if (res.success) refreshData();
}

async function rejectStudent(id) {
    const res = await DataStore.rejectStudent(id);
    showToast(res.success ? 'Student request rejected' : res.message || 'Reject failed', res.success ? 'info' : 'error');
    if (res.success) refreshData();
}

async function removeStudent(id) {
    if (!confirm('Remove this student?')) return;
    const res = await DataStore.removeStudent(id);
    showToast(res.success ? 'Student removed' : res.message || 'Remove failed', res.success ? 'success' : 'error');
    if (res.success) refreshData();
}

async function upgradeStudent(id) {
    const res = await DataStore.upgradeStudent(id);
    showToast(res.success ? 'Student upgraded to Pro' : res.message || 'Upgrade failed', res.success ? 'success' : 'error');
    if (res.success) refreshData();
}

async function deleteMat(id) {
    if (!confirm('Delete material?')) return;
    const res = await DataStore.deleteMaterial(id);
    showToast(res.success ? 'Material deleted' : res.message || 'Delete failed', res.success ? 'success' : 'error');
    if (res.success) refreshData();
}

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
        const useFile = videoSource === 'file';
        fileGroup.style.display = useFile ? 'block' : 'none';
        linkGroup.style.display = useFile ? 'none' : 'block';
        fileInput.required = useFile;
        linkInput.required = !useFile;
        fileInput.accept = useFile ? 'video/*' : '';
        fileLabel.textContent = useFile ? 'Select Video File' : 'Select File';
    } else if (val === 'Quiz') {
        videoSourceGroup.style.display = 'none';
        fileGroup.style.display = 'none';
        linkGroup.style.display = 'none';
        quizGroup.style.display = 'block';
        fileInput.required = false;
        linkInput.required = false;
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
            const file = document.getElementById('matFile').files[0];
            if (!file) { showToast('Please select a video file', 'error'); btn.disabled = false; btn.textContent = 'Upload'; return; }
            formData.append('file', file);
        } else {
            const link = document.getElementById('matLink').value.trim();
            if (!link) { showToast('Please enter a video link', 'error'); btn.disabled = false; btn.textContent = 'Upload'; return; }
            formData.append('link', link);
        }
    } else if (category === 'Quiz') {
        const questions = [];
        document.querySelectorAll('.question-input-group').forEach(group => {
            const q = group.querySelector('.question-text').value.trim();
            const options = Array.from(group.querySelectorAll('.option-input')).map(opt => opt.value.trim());
            const correct = parseInt(group.querySelector('.correct-answer-select').value);
            const explanation = group.querySelector('.explanation-input').value.trim();
            if (q && options.filter(Boolean).length >= 2) questions.push({ question: q, options, correctAnswer: correct, explanation });
        });
        if (!questions.length) { showToast('Add at least one complete question', 'error'); btn.disabled = false; btn.textContent = 'Upload'; return; }
        formData.append('questions', JSON.stringify(questions));
    } else {
        const file = document.getElementById('matFile').files[0];
        if (!file) { showToast('Please select a file', 'error'); btn.disabled = false; btn.textContent = 'Upload'; return; }
        formData.append('file', file);
    }

    try {
        const res = await DataStore.uploadMaterial(formData);
        showToast(res.success ? 'Uploaded successfully' : res.message || 'Upload failed', res.success ? 'success' : 'error');
        if (res.success) {
            document.getElementById('addMaterialForm').reset();
            document.getElementById('questionsContainer').innerHTML = '';
            updateUploadFields();
            toggleUploadForm();
            refreshData();
        }
    } catch (err) {
        showToast('Upload failed', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Upload';
    }
});

function addQuizQuestion() {
    const container = document.getElementById('questionsContainer');
    const qNum = container.querySelectorAll('.question-input-group').length + 1;
    const questionGroup = document.createElement('div');
    questionGroup.className = 'question-input-group';
    questionGroup.style.cssText = 'padding: 16px; background: var(--bg); border: 1px solid var(--input-border); border-radius: 8px; margin-bottom: 12px;';
    questionGroup.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <label style="font-weight: 600; font-size: 14px;">Question ${qNum}</label>
            <button type="button" onclick="this.closest('.question-input-group').remove()" class="btn btn-ghost" style="padding: 4px 8px; font-size: 12px;">Remove</button>
        </div>
        <input type="text" class="question-text input-box" placeholder="Enter question" required style="padding-left: 12px; margin-bottom: 12px; width: 100%;">
        <input type="text" class="option-input input-box" placeholder="Option 1" style="padding-left: 12px; margin-bottom: 6px; width: 100%;">
        <input type="text" class="option-input input-box" placeholder="Option 2" style="padding-left: 12px; margin-bottom: 6px; width: 100%;">
        <input type="text" class="option-input input-box" placeholder="Option 3" style="padding-left: 12px; margin-bottom: 6px; width: 100%;">
        <input type="text" class="option-input input-box" placeholder="Option 4" style="padding-left: 12px; margin-bottom: 12px; width: 100%;">
        <select class="correct-answer-select input-box" required style="padding-left: 12px; margin-bottom: 12px;"><option value="">Correct answer</option><option value="0">Option 1</option><option value="1">Option 2</option><option value="2">Option 3</option><option value="3">Option 4</option></select>
        <input type="text" class="explanation-input input-box" placeholder="Explanation (optional)" style="padding-left: 12px; width: 100%;">
    `;
    container.appendChild(questionGroup);
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab + 'Tab').classList.add('active');
    });
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    DataStore.logout();
    window.location.href = 'index.html';
});

refreshData();
