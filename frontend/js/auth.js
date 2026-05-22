/* ============================================
   Shniro Notes — Auth Logic (Async)
   ============================================ */

// --- Session check ---
(function () {
    if (DataStore.isLoggedIn()) {
        const user = DataStore.getCurrentUser();
        window.location.href = user.role === 'superadmin' ? 'superadmin.html' : user.role === 'admin' ? 'admin.html' : 'home.html';
    }
})();

// --- Theme ---
(function initTheme() {
    if (localStorage.getItem('sn_theme') === 'dark') {
        document.body.classList.add('dark');
        const icon = document.getElementById('themeIcon');
        if (icon) icon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
    }
})();

document.getElementById('themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('sn_theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    const icon = document.getElementById('themeIcon');
    if (document.body.classList.contains('dark')) {
        icon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
    } else {
        icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
    }
});

// --- Card switching ---
function showCard(id) {
    document.getElementById('loginCard').style.display = 'none';
    document.getElementById('registerCard').style.display = 'none';
    document.getElementById(id).style.display = 'block';
}

function syncRegisterRoleFields() {
    const role = document.querySelector('input[name="regRole"]:checked')?.value || 'student';
    const adminField = document.getElementById('regAdminField');
    const adminSelect = document.getElementById('regAdminId');
    const phoneField = document.getElementById('regPhoneField');
    const phoneInput = document.getElementById('regPhone');
    const instituteField = document.getElementById('regInstituteField');
    const instituteInput = document.getElementById('regInstituteName');
    const nameLabel = document.getElementById('regNameLabel');
    const nameInput = document.getElementById('regName');
    const rollField = document.getElementById('regRollField');
    const rollInput = document.getElementById('regRollNo');
    const enrollField = document.getElementById('regEnrollField');
    const enrollInput = document.getElementById('regEnrollNo');
    const submitText = document.getElementById('registerBtnText');
    const badgeText = document.getElementById('registerBadgeText');
    const isAdmin = role === 'admin';

    if (adminField) adminField.style.display = isAdmin ? 'none' : 'block';
    if (phoneField) phoneField.style.display = isAdmin ? 'block' : 'none';
    if (instituteField) instituteField.style.display = isAdmin ? 'block' : 'none';
    if (rollField) rollField.style.display = isAdmin ? 'none' : 'block';
    if (enrollField) enrollField.style.display = isAdmin ? 'none' : 'block';
    if (adminSelect) adminSelect.required = !isAdmin;
    if (phoneInput) phoneInput.required = isAdmin;
    if (instituteInput) instituteInput.required = isAdmin;
    if (rollInput) rollInput.required = !isAdmin;
    if (enrollInput) enrollInput.required = !isAdmin;
    if (adminSelect) adminSelect.disabled = isAdmin;
    if (phoneInput) phoneInput.disabled = !isAdmin;
    if (instituteInput) instituteInput.disabled = !isAdmin;
    if (rollInput) rollInput.disabled = isAdmin;
    if (enrollInput) enrollInput.disabled = isAdmin;
    if (nameLabel) nameLabel.textContent = isAdmin ? 'Teacher Name' : 'Student Name';
    if (nameInput) nameInput.placeholder = isAdmin ? 'Teacher full name' : 'Student full name';
    if (submitText) submitText.textContent = isAdmin ? 'Request Teacher Access' : 'Request Student Access';
    if (badgeText) badgeText.textContent = isAdmin
        ? 'Teacher requests are reviewed by the super admin'
        : 'Your request will be sent to admin for approval';
}

function syncLoginRoleFields() {
    const role = document.querySelector('input[name="loginRole"]:checked')?.value || 'student';
    const isTeacher = role === 'teacher';
    const primaryLabel = document.getElementById('loginPrimaryLabel');
    const secondaryLabel = document.getElementById('loginSecondaryLabel');
    const primaryInput = document.getElementById('loginRollNo');
    const secondaryInput = document.getElementById('loginEnrollNo');
    const adminField = document.getElementById('loginAdminField');
    const adminSelect = document.getElementById('loginAdminId');

    if (primaryLabel) primaryLabel.textContent = isTeacher ? 'Teacher Name' : 'Roll Number';
    if (secondaryLabel) secondaryLabel.textContent = isTeacher ? 'Teacher ID' : 'Enrollment Number';
    if (primaryInput) primaryInput.placeholder = isTeacher ? 'Teacher full name' : 'Student roll no.';
    if (secondaryInput) secondaryInput.placeholder = isTeacher ? 'Teacher ID' : 'Student enrollment no.';
    if (adminField) adminField.style.display = isTeacher ? 'none' : 'block';
    if (adminSelect) {
        adminSelect.disabled = isTeacher;
        if (isTeacher) adminSelect.value = '';
    }
}

document.querySelectorAll('input[name="regRole"]').forEach(input => {
    input.addEventListener('change', syncRegisterRoleFields);
});

document.querySelectorAll('input[name="loginRole"]').forEach(input => {
    input.addEventListener('change', syncLoginRoleFields);
});

// --- Toast ---
function showToast(msg, type = 'info') {
    const svgs = {
        success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };
    const box = document.getElementById('toastBox');
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.innerHTML = (svgs[type] || svgs.info) + '<span>' + msg + '</span>';
    box.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

async function loadAdminOptions() {
    const loginSelect = document.getElementById('loginAdminId');
    const registerSelect = document.getElementById('regAdminId');
    if (!loginSelect && !registerSelect) return;

    try {
        const res = await DataStore.getAdmins();
        const admins = res && res.success && Array.isArray(res.admins) ? res.admins : [];

        if (loginSelect) {
            loginSelect.innerHTML = '<option value="">Auto detect admin</option>';
            admins.forEach(admin => {
                const option = document.createElement('option');
                option.value = admin.id;
                option.textContent = admin.name;
                loginSelect.appendChild(option);
            });
        }

        if (registerSelect) {
            registerSelect.innerHTML = '<option value="" disabled selected>Select admin</option>';
            admins.forEach(admin => {
                const option = document.createElement('option');
                option.value = admin.id;
                option.textContent = admin.name;
                registerSelect.appendChild(option);
            });
            registerSelect.disabled = admins.length === 0;
        }
    } catch (err) {
        if (registerSelect) {
            registerSelect.innerHTML = '<option value="" disabled selected>Admins unavailable</option>';
            registerSelect.disabled = true;
        }
    }
}

loadAdminOptions();
syncLoginRoleFields();
syncRegisterRoleFields();

// --- Popup ---
function showPopup(title, msg) {
    document.getElementById('popupTitle').textContent = title;
    document.getElementById('popupMsg').textContent = msg;
    document.getElementById('popup').style.display = 'flex';
}

function closePopup() {
    document.getElementById('popup').style.display = 'none';
}

function getDestination(user) {
    return user.role === 'superadmin' ? 'superadmin.html' : user.role === 'admin' ? 'admin.html' : 'home.html';
}

function getRegistrationDetails() {
    const name = document.getElementById('regName').value.trim();
    const phone = document.getElementById('regPhone')?.value.trim() || '';
    const instituteName = document.getElementById('regInstituteName')?.value.trim() || '';
    const rollNo = document.getElementById('regRollNo').value.trim();
    const enrollNo = document.getElementById('regEnrollNo').value.trim();
    const adminId = document.getElementById('regAdminId')?.value || '';
    const role = document.querySelector('input[name="regRole"]:checked')?.value || 'student';

    return { name, phone, instituteName, rollNo, enrollNo, adminId, role };
}

function validateRegistrationDetails(details) {
    if (details.role === 'admin') {
        return Boolean(details.name && details.phone && details.instituteName);
    }

    return Boolean(
        details.name &&
        details.rollNo &&
        details.enrollNo &&
        details.adminId
    );
}

// --- Login ---
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const role = document.querySelector('input[name="loginRole"]:checked')?.value || 'student';
    const primaryValue = document.getElementById('loginRollNo').value.trim();
    const secondaryValue = document.getElementById('loginEnrollNo').value.trim();
    const adminId = document.getElementById('loginAdminId')?.value || '';

    if (role === 'teacher') {
        if (!primaryValue || !secondaryValue) {
            showToast('Enter teacher name and teacher ID', 'error');
            return;
        }
    } else if (!primaryValue || !secondaryValue) {
        showToast('Enter student roll number and enrollment number', 'error');
        return;
    }

    const btn = document.getElementById('loginBtn');
    btn.classList.add('loading');
    btn.disabled = true;

    try {
        const result = await DataStore.login(role === 'teacher'
            ? { role: 'teacher', name: primaryValue, teacherId: secondaryValue }
            : { role: 'student', rollNo: primaryValue, enrollNo: secondaryValue, adminId });
        if (result.success) {
            showToast('Welcome back!', 'success');
            setTimeout(() => {
                window.location.href = getDestination(result.user);
            }, 600);
        } else {
            showToast(result.message, 'error');
        }
    } catch (err) {
        showToast('Server connection failed', 'error');
    } finally {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
});

const registerBtn = document.getElementById('registerBtn');

function showRegistrationValidationError(details) {
    showToast(details.role === 'admin'
        ? 'Fill teacher name, teacher ID, and institute name'
        : 'Fill admin, student name, roll number, and enrollment number', 'error');
}

function setRegistrationBusy(isBusy) {
    if (registerBtn) registerBtn.disabled = isBusy;
    registerBtn?.classList.toggle('loading', isBusy);
}

async function startRegistration(details) {
    setRegistrationBusy(true);

    try {
        const payload = details.role === 'admin'
            ? {
                role: 'admin',
                name: details.name,
                phone: details.phone,
                instituteName: details.instituteName
            }
            : {
                role: 'student',
                name: details.name,
                rollNo: details.rollNo,
                enrollNo: details.enrollNo,
                adminId: details.adminId
            };
        const result = await DataStore.register(payload);

        if (result && result.success) {
            showPopup('Request Sent!', result.message || 'Your request is pending approval.');
            document.getElementById('registerForm').reset();
            syncRegisterRoleFields();
            setTimeout(() => showCard('loginCard'), 1000);
        } else {
            showToast((result && result.message) || 'Access request failed', 'error');
        }
    } catch (err) {
        showToast('Server connection failed', 'error');
    } finally {
        setRegistrationBusy(false);
    }
}

// --- Register ---
document.getElementById('registerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const details = getRegistrationDetails();
    if (!validateRegistrationDetails(details)) {
        showRegistrationValidationError(details);
        return;
    }
    startRegistration(details);
});

// Popup backdrop
document.getElementById('popup').addEventListener('click', (e) => {
    if (e.target === document.getElementById('popup')) closePopup();
});
