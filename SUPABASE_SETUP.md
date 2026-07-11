# Supabase Setup

This app uses Supabase for file storage only. User accounts and admin ownership are stored in MongoDB.

## 1. Create The Storage Bucket

1. Open your Supabase project.
2. Go to Storage.
3. Create a bucket named the same as `SUPABASE_BUCKET`, for example `materials`.
4. Keep the bucket private. The backend already proxies view/download requests.

## 2. Add Backend Environment Variables

Copy [backend/.env.example](backend/.env.example) to `backend/.env`, then fill these values:

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
SUPABASE_BUCKET=materials
```

Use the service role key only in `backend/.env` or Render environment variables. Never put it in Floak JavaScript.

## 3. Render Variables

On Render, add the same backend variables from `backend/.env`. After changing them, restart the web service.

## 4. Quick Check

Start the backend and open:

```text
http://localhost:3000/api/system/status
```

`supabase` should show `online` when `SUPABASE_URL`, `SUPABASE_KEY`, and `SUPABASE_BUCKET` are correct.
