/* ============================================
   YuVision — API Client (Replacing Local DataStore)
   ============================================ */

// Automatically switch between local development and production backend
const IS_LOCAL = window.location.protocol === 'http:' &&
                 (window.location.hostname === 'localhost' ||
                  window.location.hostname === '127.0.0.1' ||
                  window.location.hostname === '');

window.API_BASE = IS_LOCAL
    ? 'http://localhost:3000/api'
    : 'https://note-provider-nd4p.onrender.com/api'; 

const API_BASE = window.API_BASE;

const IS_NATIVE_ANDROID_APP = window.location.protocol === 'https:' &&
                              window.location.hostname === 'localhost';

if (IS_NATIVE_ANDROID_APP) {
    document.documentElement.classList.add('native-android-app');
    document.addEventListener('DOMContentLoaded', () => {
        document.body.classList.add('native-android-app');
    });
}

function syncViewportHeight() {
    const height = window.visualViewport?.height || window.innerHeight;
    document.documentElement.style.setProperty('--app-viewport-height', `${height}px`);
}

syncViewportHeight();
window.visualViewport?.addEventListener('resize', syncViewportHeight);
window.addEventListener('orientationchange', syncViewportHeight);

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
        return user && ['admin', 'superadmin'].includes(user.role) && user.id ? user.id : '';
    }

    function getCurrentSuperAdminId() {
        const user = getCurrentUser();
        return user && user.role === 'superadmin' && user.id ? user.id : '';
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

    async function login(details, enrollNo, adminId = '') {
        const payload = typeof details === 'object' && details !== null
            ? { ...details }
            : { rollNo: details, enrollNo };
        if (adminId && !payload.adminId) payload.adminId = adminId;

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

    // --- Super Admin ---
    async function getSuperAdminData() {
        const res = await fetch(appendQuery(`${API_BASE}/superadmin/data`, { superAdminId: getCurrentSuperAdminId() }));
        return await res.json();
    }

    async function approveAdmin(id) {
        const res = await fetch(`${API_BASE}/superadmin/approve-admin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, superAdminId: getCurrentSuperAdminId() })
        });
        return await res.json();
    }

    async function rejectAdmin(id) {
        const res = await fetch(`${API_BASE}/superadmin/reject-admin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, superAdminId: getCurrentSuperAdminId() })
        });
        return await res.json();
    }

    async function removeAdmin(id) {
        const res = await fetch(appendQuery(`${API_BASE}/superadmin/admin/${id}`, { superAdminId: getCurrentSuperAdminId() }), { method: 'DELETE' });
        return await res.json();
    }

    async function approveStudent(id) {
        const res = await fetch(`${API_BASE}/superadmin/approve-student`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, superAdminId: getCurrentSuperAdminId() })
        });
        return await res.json();
    }

    async function rejectStudent(id) {
        const res = await fetch(`${API_BASE}/superadmin/reject-student`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, superAdminId: getCurrentSuperAdminId() })
        });
        return await res.json();
    }

    async function removeStudent(id) {
        const res = await fetch(appendQuery(`${API_BASE}/superadmin/student/${id}`, { superAdminId: getCurrentSuperAdminId() }), { method: 'DELETE' });
        return await res.json();
    }

    async function upgradeStudent(id) {
        const res = await fetch(`${API_BASE}/superadmin/upgrade-student`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, superAdminId: getCurrentSuperAdminId() })
        });
        return await res.json();
    }

    async function deleteAnyMaterial(id) {
        const res = await fetch(appendQuery(`${API_BASE}/superadmin/material/${id}`, { superAdminId: getCurrentSuperAdminId() }), { method: 'DELETE' });
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

    async function getQuizScores(materialId = '') {
        const params = { userId: getCurrentUserId() };
        if (materialId) params.materialId = materialId;
        const res = await fetch(appendQuery(`${API_BASE}/materials/quiz-scores`, params));
        return await res.json();
    }

    async function submitQuizScore(materialId, answers) {
        const res = await fetch(`${API_BASE}/materials/quiz-scores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: getCurrentUserId(), materialId, answers })
        });
        return await res.json();
    }

    async function updateProfile(details, file) {
        const formData = new FormData();
        formData.append('userId', getCurrentUserId());
        Object.entries(details || {}).forEach(([key, value]) => {
            formData.append(key, value || '');
        });
        if (file) formData.append('profileImage', file);

        const res = await fetch(`${API_BASE}/users/profile`, {
            method: 'PUT',
            body: formData
        });
        const data = await res.json().catch(() => ({
            success: false,
            message: res.ok ? 'Profile update failed' : `Profile update failed (${res.status})`
        }));
        if (data.success && data.user) setCurrentUser({ ...getCurrentUser(), ...data.user });
        return data;
    }

    async function getSubscriptionConfig() {
        const res = await fetch(`${API_BASE}/subscriptions/config`);
        return await res.json();
    }

    async function getSubscriptionStatus() {
        const res = await fetch(appendQuery(`${API_BASE}/subscriptions/status`, { userId: getCurrentUserId() }));
        const data = await res.json();
        if (data.success) {
            setCurrentUser({
                ...getCurrentUser(),
                plan: data.plan,
                planStatus: data.planStatus,
                planExpiresAt: data.planExpiresAt,
                cashfreeSubscriptionId: data.cashfreeSubscriptionId
            });
        }
        return data;
    }

    async function createSubscription() {
        const res = await fetch(`${API_BASE}/subscriptions/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: getCurrentUserId() })
        });
        return await res.json();
    }

    async function verifySubscription(subscriptionId = '') {
        const res = await fetch(`${API_BASE}/subscriptions/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: getCurrentUserId(), subscriptionId })
        });
        const data = await res.json();
        if (data.success && data.user) {
            setCurrentUser({ ...getCurrentUser(), ...data.user });
        }
        return data;
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
    function isSuperAdmin() { const u = getCurrentUser(); return u && u.role === 'superadmin'; }

    async function getSystemStatus() {
        const res = await fetch(`${API_BASE}/system/status`);
        return await res.json();
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
        getSuperAdminData, approveAdmin, rejectAdmin, removeAdmin,
        approveStudent, rejectStudent, removeStudent, upgradeStudent, deleteAnyMaterial,
        getMaterials, uploadMaterial, deleteMaterial, getQuizScores, submitQuizScore, updateProfile,
        getFavorites, toggleFavorite, isFavorite,
        submitRating, getUserRating, getRatingStats,
        getSystemStatus,
        getSubscriptionConfig, getSubscriptionStatus, createSubscription, verifySubscription,
        setCurrentUser, getCurrentUser, logout, isLoggedIn, isAdmin, isSuperAdmin,
    };
})();
