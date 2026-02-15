# 🚂 Railway Deployment Guide

This guide will help you deploy your full-stack application (backend + frontend + database) to Railway with proper environment variable configuration.

## 📋 Prerequisites

- GitHub account with this repository
- Railway account (sign up at [railway.app](https://railway.app))
- Traccar SMS Gateway configured (get your API token and device ID)

## 🚀 Step-by-Step Deployment

### Step 1: Create Railway Project

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Authorize Railway to access your GitHub account
5. Select this repository (`oanatimid/oanatests`)

### Step 2: Add PostgreSQL Database

**IMPORTANT**: The database service MUST be named "Postgres" for auto-linking to work.

1. In your Railway project, click **"+ New"** or right-click the canvas
2. Select **"Database"** → **"PostgreSQL"**
3. Wait for it to provision (should take 1-2 minutes)
4. **Verify** the service is named "Postgres" (this is the default name)

### Step 3: Deploy Backend Service

Railway should automatically detect the backend service configuration.

1. Click **"+ New"** → **"GitHub Repo"**
2. Select this repository
3. Railway will detect `railway.json` at the root and deploy the backend
4. Wait for the initial build to complete

#### Configure Backend Environment Variables

**CRITICAL**: Railway does NOT automatically populate environment variables from `railway.json`. You MUST add them manually.

1. Click on your **backend service** in the Railway dashboard
2. Go to the **"Variables"** tab
3. Click **"RAW Editor"** (top right corner)
4. Paste the following (replace with your actual values):

```env
# Database (auto-linked from Postgres service)
DATABASE_URL=${{Postgres.DATABASE_URL}}
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_NAME=${{Postgres.PGDATABASE}}
DB_USER=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}

# Server Configuration
PORT=3001
NODE_ENV=production

# CORS - SET THIS TO YOUR FRONTEND URL (see Step 4 for frontend URL)
CORS_ORIGIN=https://your-frontend-url.railway.app

# Traccar SMS Gateway - REQUIRED
TRACCAR_SMS_URL=https://your-traccar-url.com
TRACCAR_SMS_DEVICE_ID=your_device_id_here
TRACCAR_API_TOKEN=your_api_token_here

# Optional: Cloudflare Tunnel (if using)
CLOUDFLARE_TUNNEL_URL=https://your-tunnel.trycloudflare.com

# SMS Configuration (optional, has defaults)
SMS_RATE_LIMIT_PER_MINUTE=30
SMS_RATE_LIMIT_PER_HOUR=500
SMS_MAX_RETRIES=5
SMS_MAX_PER_RECIPIENT_PER_DAY=3
SMS_MAX_PER_RECIPIENT_PER_WEEK=10
SMS_RECIPIENT_COOLDOWN_HOURS=4
SMS_ALLOWED_START_HOUR=9
SMS_ALLOWED_END_HOUR=20
SMS_TIMEZONE=Europe/Bucharest
SMS_SENDER_NAME=YourCompany
SMS_DEFAULT_COUNTRY_CODE=+40

# Logging
LOG_LEVEL=info
```

5. Click **"Update Variables"**
6. Railway will automatically trigger a redeploy

**Get Your Backend URL:**
- Go to **Settings** → **Networking** → **Generate Domain**
- Copy the generated URL (e.g., `https://your-backend.railway.app`)
- You'll need this for the frontend configuration

### Step 4: Deploy Frontend Service

1. In your Railway project, click **"+ New"** → **"GitHub Repo"**
2. Select this repository again
3. Railway will ask which service to deploy
4. In the configuration:
   - Set **Root Directory** to `/frontend`
   - Railway will detect `frontend/railway.json` and `frontend/Dockerfile`

#### Configure Frontend Environment Variables

**CRITICAL**: The frontend NEEDS the backend API URL at BUILD TIME!

1. Click on your **frontend service** in the Railway dashboard
2. Go to the **"Variables"** tab
3. Add the following variable:

```env
NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app/api
```

**Important Notes:**
- Replace `your-backend-url.railway.app` with your actual backend URL from Step 3
- Make sure to include `/api` at the end
- This variable MUST be set BEFORE the first build
- If you change this variable, you MUST rebuild the frontend

4. Click **"Deploy"** or wait for automatic deployment

**Get Your Frontend URL:**
- Go to **Settings** → **Networking** → **Generate Domain**
- Copy the generated URL (e.g., `https://your-frontend.railway.app`)

### Step 5: Update CORS_ORIGIN in Backend

Now that you have your frontend URL, you need to update the backend CORS configuration:

1. Go back to your **backend service**
2. Go to **"Variables"** tab
3. Find the `CORS_ORIGIN` variable
4. Update it with your frontend URL: `https://your-frontend.railway.app`
5. Railway will automatically redeploy the backend

### Step 6: Verify Deployment

1. **Check Backend Health:**
   - Visit `https://your-backend-url.railway.app/health`
   - You should see: `{"status":"healthy"}`

2. **Check Frontend:**
   - Visit `https://your-frontend-url.railway.app`
   - The application should load without errors
   - Check browser console (F12) for any API connection errors

3. **Check Database Migration:**
   - In Railway, go to your backend service
   - Click **"Deployments"** → Select latest deployment → **"View Logs"**
   - Look for migration success messages

## 🔧 Common Issues and Solutions

### Issue 1: Frontend shows "Failed to fetch" or API errors

**Problem:** `NEXT_PUBLIC_API_URL` was not set correctly or was changed after build.

**Solution:**
1. Go to frontend service → Variables
2. Verify `NEXT_PUBLIC_API_URL` is set correctly: `https://your-backend.railway.app/api`
3. Go to **Deployments** → Click **"Redeploy"** on latest deployment
4. Wait for rebuild to complete

### Issue 2: Backend CORS errors

**Problem:** `CORS_ORIGIN` doesn't match your frontend URL.

**Solution:**
1. Go to backend service → Variables
2. Update `CORS_ORIGIN` to match your frontend URL exactly
3. Railway will auto-redeploy

### Issue 3: Database connection errors

**Problem:** Database environment variables not linked correctly.

**Solution:**
1. Verify your Postgres service is named "Postgres"
2. Check backend variables include: `DATABASE_URL=${{Postgres.DATABASE_URL}}`
3. The `${{Postgres.DATABASE_URL}}` syntax is case-sensitive

### Issue 4: Environment variables not loading

**Problem:** Variables were added after the build.

**Solution:**
1. Railway builds the application BEFORE loading environment variables
2. For backend: Variables are loaded at runtime (no rebuild needed)
3. For frontend: `NEXT_PUBLIC_*` variables MUST be set before build
   - Update the variable
   - Manually trigger a redeploy

## 📝 Environment Variables Reference

### Backend Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `${{Postgres.DATABASE_URL}}` |
| `CORS_ORIGIN` | Frontend URL for CORS | `https://your-frontend.railway.app` |
| `TRACCAR_SMS_URL` | Traccar SMS Gateway URL | `https://traccar.example.com` |
| `TRACCAR_SMS_DEVICE_ID` | Device ID from Traccar app | `device_123` |
| `TRACCAR_API_TOKEN` | Traccar API authentication token | `token_abc123` |

### Frontend Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://your-backend.railway.app/api` |

### Backend Optional Variables (with defaults)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `NODE_ENV` | `production` | Node environment |
| `SMS_RATE_LIMIT_PER_MINUTE` | `30` | Max SMS per minute |
| `SMS_RATE_LIMIT_PER_HOUR` | `500` | Max SMS per hour |
| `SMS_SENDER_NAME` | `YourCompany` | Company name in SMS |
| `LOG_LEVEL` | `info` | Logging level |

## 🔄 Updating Environment Variables

### For Backend (Runtime Variables)

Most backend variables are loaded at runtime, so you can update them without rebuilding:

1. Go to backend service → Variables
2. Update the variable value
3. Railway will automatically restart the service (no rebuild needed)

### For Frontend (Build-Time Variables)

Frontend `NEXT_PUBLIC_*` variables are baked into the build, so you MUST rebuild:

1. Go to frontend service → Variables
2. Update `NEXT_PUBLIC_API_URL`
3. Go to Deployments → Click latest deployment → **"Redeploy"**
4. Wait for rebuild to complete (~2-3 minutes)

## 🔐 Security Best Practices

1. **Never commit `.env` files** to GitHub
2. **Rotate credentials regularly** (especially Traccar API tokens)
3. **Use different credentials** for development and production
4. **Enable Railway's secret scanning** (automatic)
5. **Restrict CORS_ORIGIN** to your actual frontend URL (don't use `*`)

## 📊 Monitoring

### View Logs

1. Go to your service in Railway
2. Click **"Deployments"**
3. Select a deployment
4. Click **"View Logs"**

### Set up Alerts

1. Go to your project settings
2. Enable **"Deployment Notifications"**
3. Connect to Slack/Discord/Email for deployment status updates

## 🆘 Getting Help

If you're still having issues:

1. Check the [Railway Documentation](https://docs.railway.app)
2. Review the deployment logs in Railway dashboard
3. Check browser console (F12) for frontend errors
4. Verify all required environment variables are set
5. Ensure service URLs are correct (no trailing slashes, correct `/api` path)

## 📚 Additional Resources

- [Railway Documentation](https://docs.railway.app)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Docker Build Arguments](https://docs.docker.com/engine/reference/builder/#arg)

---

**Last Updated:** February 15, 2026
