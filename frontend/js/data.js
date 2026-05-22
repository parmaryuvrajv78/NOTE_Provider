/* ============================================
   Shniro Notes — API Client (Replacing Local DataStore)
   ============================================ */

// Automatically switch between local development and production backend
const IS_LOCAL = window.location.hostname === 'localhost' || 
                 window.location.hostname === '127.0.0.1' || 
                 window.location.hostname === '' || 
                 window.location.protocol === 'file:';

window.API_BASE = IS_LOCAL
    ? 'http://localhost:3000/api'
    : 'https://note-provider-nd4p.onrender.com/api'; 

const API_BASE = window.API_BASE;

const DataStore = (() => {
    // Session remains in local storage for persistence across tabs
    const SESSION_KEY = 'sn_currentUser';

    function init() {
        // No init needed for backend, server handles it
    }

    function getCurrentUserId() {
        const user = getCurrentUser();
        return user && user.id ? user.id : '';
    }

    function getCurrentAdminId() {
        const user = getCurrentUser();
        return user && user.role === 'admin' && user.id ? user.id : '';
    }

    function appendQuery(url, params) {
        const query = new URLSearchParams();
        Object.entries(params || {}).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') query.set(key, value);
        });
        const suffix = query.toString();
        return suffix ? `${url}?${suffix}` : url;
    }

    async function getAdmins() {
        const res = await fetch(`${API_BASE}/admins`);
        return await res.json();
    }

    async function login(rollNo, enrollNo, adminId = '') {
        const payload = { rollNo, enrollNo };
        if (adminId) payload.adminId = adminId;

        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) setCurrentUser(data.user);
        return data;
    }

    async function register(userData) {
        const res = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        return await res.json();
    }

    // --- Admin ---
    async function getAdminData() {
        const res = await fetch(appendQuery(`${API_BASE}/admin/data`, { adminId: getCurrentAdminId() }));
        return await res.json();
    }

    async function approvePending(id) {
        const res = await fetch(`${API_BASE}/admin/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, adminId: getCurrentAdminId() })
        });
        return await res.json();
    }

    async function rejectPending(id) {
        const res = await fetch(`${API_BASE}/admin/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, adminId: getCurrentAdminId() })
        });
        return await res.json();
    }

    async function removeUser(id) {
        const res = await fetch(appendQuery(`${API_BASE}/admin/user/${id}`, { adminId: getCurrentAdminId() }), { method: 'DELETE' });
        return await res.json();
    }

    async function upgradeUser(id) {
        const res = await fetch(`${API_BASE}/admin/upgrade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, adminId: getCurrentAdminId() })
        });
        return await res.json();
    }

    // --- Materials ---
    async function getMaterials() {
        const res = await fetch(appendQuery(`${API_BASE}/materials`, { userId: getCurrentUserId() }));
        return await res.json();
    }

    async function uploadMaterial(formData) {
        const adminId = getCurrentAdminId();
        if (adminId && !formData.has('adminId')) formData.append('adminId', adminId);

        const res = await fetch(`${API_BASE}/materials/upload`, {
            method: 'POST',
            body: formData // Note: Don't set Content-Type header for FormData
        });
        return await res.json();
    }

    async function deleteMaterial(id) {
        const res = await fetch(appendQuery(`${API_BASE}/materials/${id}`, { adminId: getCurrentAdminId() }), { method: 'DELETE' });
        return await res.json();
    }

    // --- Favorites (Keep in LocalStorage per device) ---
    function getFavorites() {
        const user = getCurrentUser();
        if (!user) return [];
        return JSON.parse(localStorage.getItem('sn_favs_' + user.id) || '[]');
    }

    function toggleFavorite(matId) {
        const user = getCurrentUser();
        if (!user) return;
        const key = 'sn_favs_' + user.id;
        let favs = JSON.parse(localStorage.getItem(key) || '[]');
        if (favs.includes(matId)) {
            favs = favs.filter(id => id !== matId);
        } else {
            favs.push(matId);
        }
        localStorage.setItem(key, JSON.stringify(favs));
        return favs.includes(matId);
    }

    function isFavorite(matId) {
        return getFavorites().includes(matId);
    }

    // --- Session ---
    function setCurrentUser(user) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    }

    function getCurrentUser() {
        try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
        catch { return null; }
    }

    function logout() {
        localStorage.removeItem(SESSION_KEY);
    }

    function isLoggedIn() { return getCurrentUser() !== null; }
    function isAdmin() { const u = getCurrentUser(); return u && u.role === 'admin'; }

    async function getSystemStatus() {
        const res = await fetch(`${API_BASE}/system/status`);
        return await res.json();
    }

    async function googleSignIn(adminId = '') {
        return new Promise((resolve, reject) => {
            const url = appendQuery(`${API_BASE}/auth/google`, { adminId });
            const popup = window.open(url, 'googleAuth', 'width=600,height=600');
            if (!popup) return reject({ success: false, message: 'Popup blocked' });

            const popupWatcher = setInterval(() => {
                if (popup.closed) {
                    clearInterval(popupWatcher);
                    window.removeEventListener('message', handleMessage);
                    resolve({ success: false, message: 'Google sign-in cancelled' });
                }
            }, 500);

            function handleMessage(e) {
                try {
                    const data = e.data;
                    if (data && typeof data.success !== 'undefined') {
                        clearInterval(popupWatcher);
                        window.removeEventListener('message', handleMessage);
                        if (data.success) {
                            setCurrentUser(data.user);
                            resolve(data);
                        } else {
                            resolve(data);
                        }
                    }
                } catch (err) {
                    // ignore
                }
            }

            window.addEventListener('message', handleMessage, false);
        });
    }

    // --- Ratings ---
    async function submitRating(userId, rating, review) {
        const res = await fetch(`${API_BASE}/ratings/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, rating, review })
        });
        return await res.json();
    }

    async function getUserRating(userId) {
        const res = await fetch(`${API_BASE}/ratings/user/${userId}`);
        return await res.json();
    }

    async function getRatingStats() {
        const res = await fetch(`${API_BASE}/ratings/stats`);
        return await res.json();
    }

    return {
        init, getAdmins, login, register,
        getAdminData, approvePending, rejectPending, removeUser,
        upgradeUser,
        getMaterials, uploadMaterial, deleteMaterial,
        getFavorites, toggleFavorite, isFavorite,
        submitRating, getUserRating, getRatingStats,
        getSystemStatus,
        googleSignIn,
        setCurrentUser, getCurrentUser, logout, isLoggedIn, isAdmin,
    };
})();
