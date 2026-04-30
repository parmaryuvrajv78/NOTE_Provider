/* ============================================
   Shniro Notes — API Client (Replacing Local DataStore)
   ============================================ */

// Automatically switch between local development and production backend
const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
window.API_BASE = IS_LOCAL
    ? 'http://localhost:3000/api'
    : 'https://note-provider.onrender.com/api'; // <-- REPLACE with your Render URL

const API_BASE = window.API_BASE;

const DataStore = (() => {
    // Session remains in local storage for persistence across tabs
    const SESSION_KEY = 'sn_currentUser';

    function init() {
        // No init needed for backend, server handles it
    }

    async function login(rollNo, enrollNo) {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rollNo, enrollNo })
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
        const res = await fetch(`${API_BASE}/admin/data`);
        return await res.json();
    }

    async function approvePending(id) {
        const res = await fetch(`${API_BASE}/admin/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        return await res.json();
    }

    async function rejectPending(id) {
        const res = await fetch(`${API_BASE}/admin/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        return await res.json();
    }

    async function removeUser(id) {
        const res = await fetch(`${API_BASE}/admin/user/${id}`, { method: 'DELETE' });
        return await res.json();
    }

    // --- Materials ---
    async function getMaterials() {
        const res = await fetch(`${API_BASE}/materials`);
        return await res.json();
    }

    async function uploadMaterial(formData) {
        const res = await fetch(`${API_BASE}/materials/upload`, {
            method: 'POST',
            body: formData // Note: Don't set Content-Type header for FormData
        });
        return await res.json();
    }

    async function deleteMaterial(id) {
        const res = await fetch(`${API_BASE}/materials/${id}`, { method: 'DELETE' });
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

    return {
        init, login, register,
        getAdminData, approvePending, rejectPending, removeUser,
        getMaterials, uploadMaterial, deleteMaterial,
        getFavorites, toggleFavorite, isFavorite,
        getSystemStatus,
        setCurrentUser, getCurrentUser, logout, isLoggedIn, isAdmin,
    };
})();
