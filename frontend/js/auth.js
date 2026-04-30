/* ============================================
   Shniro Notes — Auth Logic (Async)
   ============================================ */

// --- Session check ---
(function () {
    if (DataStore.isLoggedIn()) {
        const user = DataStore.getCurrentUser();
        window.location.href = user.role === 'admin' ? 'admin.html' : 'home.html';
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

// --- Popup ---
function showPopup(title, msg) {
    document.getElementById('popupTitle').textContent = title;
    document.getElementById('popupMsg').textContent = msg;
    document.getElementById('popup').style.display = 'flex';
}

function closePopup() {
    document.getElementById('popup').style.display = 'none';
}

// --- Login ---
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const rollNo = document.getElementById('loginRollNo').value.trim();
    const enrollNo = document.getElementById('loginEnrollNo').value.trim();

    if (!rollNo || !enrollNo) { showToast('Please fill both fields', 'error'); return; }

    const btn = document.getElementById('loginBtn');
    btn.classList.add('loading');
    btn.disabled = true;

    try {
        const result = await DataStore.login(rollNo, enrollNo);
        if (result.success) {
            showToast('Welcome back!', 'success');
            setTimeout(() => {
                window.location.href = result.user.role === 'admin' ? 'admin.html' : 'home.html';
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

// --- Register ---
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('regName').value.trim();
    const rollNo = document.getElementById('regRollNo').value.trim();
    const enrollNo = document.getElementById('regEnrollNo').value.trim();
    const branch = document.getElementById('regBranch').value;
    const semester = document.getElementById('regSemester').value;

    if (!name || !rollNo || !enrollNo || !branch || !semester) {
        showToast('Fill all fields', 'error'); return;
    }

    const btn = document.getElementById('registerBtn');
    btn.classList.add('loading');
    btn.disabled = true;

    try {
        const result = await DataStore.register({ name, rollNo, enrollNo, branch, semester });
        if (result.success) {
            showPopup('Request Sent!', result.message);
            document.getElementById('registerForm').reset();
            setTimeout(() => showCard('loginCard'), 1000);
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

// Popup backdrop
document.getElementById('popup').addEventListener('click', (e) => {
    if (e.target === document.getElementById('popup')) closePopup();
});
