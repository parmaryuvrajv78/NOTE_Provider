# Shniro Notes — Deployment Guide

This project has been separated into **Frontend** and **Backend** for optimized deployment on Vercel and Render.

## 🚀 Backend Deployment (Render)
1.  Go to [Render.com](https://render.com) and create a new **Web Service**.
2.  Connect your repository.
3.  Set the **Root Directory** to `backend`.
4.  **Build Command**: `npm install`
5.  **Start Command**: `npm start`
6.  **Environment Variables**: Add all variables from `backend/.env`.
7.  Copy the generated URL (e.g., `https://shniro-notes.onrender.com`).

## 🎨 Frontend Deployment (Vercel)
1.  Go to [Vercel.com](https://vercel.com) and create a new **Project**.
2.  Connect your repository.
3.  Set the **Root Directory** to `frontend`.
4.  **Install Command**: (Leave default)
5.  **Build Command**: (Leave default)
6.  **IMPORTANT**: Before deploying, update `frontend/js/data.js` with your Render URL.

## 🔧 Configuration
Update `frontend/js/data.js`:
```javascript
window.API_BASE = IS_LOCAL 
    ? 'http://localhost:3000/api' 
    : 'https://your-backend-url.onrender.com/api';
```

---
**Tech Stack:**
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla), Vercel
- **Backend**: Node.js, Express, Render
- **Storage**: Supabase Storage
- **Database**: MongoDB Atlas (NoSQL)
