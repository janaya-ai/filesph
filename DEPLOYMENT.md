# Deployment Guide for Render

This guide explains how to deploy the filesph application to Render.

## ⚠️ CRITICAL: Data Persistence Warning

**Before deploying, read this carefully!**

By default, this application will store uploaded files and data in **ephemeral storage** that is **DELETED** every time:
- The server restarts
- You deploy a new version  
- The container is replaced or restarted

**This means all uploaded documents will disappear after a few hours or days!**

To prevent data loss, you **MUST** configure persistent storage. See the [Persistent Storage Configuration](#persistent-storage-configuration) section below.

## Prerequisites
- A [Render account](https://render.com)
- Your GitHub repository connected to Render

## Deployment Steps

### Option 1: Using render.yaml (Recommended)

1. Push your code to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com/)
3. Click "New" → "Blueprint"
4. Connect your repository: `janaya-ai/filesph`
5. Render will automatically detect the `render.yaml` and create both services
6. Click "Apply" to deploy

**Note**: The backend will start successfully even without FRONTEND_URL, but will show warnings and block all CORS requests until it's configured. This is a security feature. Continue with the following steps to complete the setup.

7. **CRITICAL - Configure Persistent Storage** (Do this IMMEDIATELY):
   - Go to the backend service (`filesph-backend`) in the Render dashboard
   - Click "Disks" in the left sidebar
   - Click "Add Disk"
   - Configure:
     - **Name**: `filesph-data`
     - **Mount Path**: `/var/data`
     - **Size**: At least 1 GB (choose based on your storage needs)
   - Click "Save"

8. **Set Required Environment Variables**:
   - Still in the backend service settings, click "Environment" in the left sidebar
   - Add two environment variables:
     - Key: `STORAGE_PATH` Value: `/var/data`
     - Key: `FRONTEND_URL` Value: Your frontend URL (e.g., `https://filesph-frontend.onrender.com`)
   - Click "Save Changes" (this will trigger a redeploy of the backend)

9. Wait for the backend to redeploy successfully with persistent storage enabled

**Without step 7-8, all your documents will be lost on every restart!**

### Option 2: Manual Deployment

#### Deploy Backend
1. Go to Render Dashboard
2. Click "New +" → "Web Service"
3. Connect repository: `janaya-ai/filesph`
4. Configure:
   - **Name**: `filesph-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free
5. Add Environment Variable:
   - `NODE_ENV`: `production`
6. Click "Create Web Service"
7. **Important**: The backend will start successfully but will show warnings and block all CORS requests until FRONTEND_URL is set. This is expected - you'll add it in step 12.
8. **Copy the backend URL** (e.g., `https://filesph-backend.onrender.com`)

#### Deploy Frontend
9. Click "New +" → "Static Site"
10. Connect repository: `janaya-ai/filesph`
11. Configure:
   - **Name**: `filesph-frontend`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
12. Add Environment Variable:
   - `VITE_API_URL`: Your backend URL from step 8
13. Click "Create Static Site"
14. **Copy the frontend URL** (e.g., `https://filesph-frontend.onrender.com`)

#### Configure Backend (CORS and Persistent Storage)
15. Go back to the backend service settings

**CRITICAL - Add Persistent Disk First:**
16. Click "Disks" in the left sidebar
17. Click "Add Disk"
18. Configure:
    - **Name**: `filesph-data`
    - **Mount Path**: `/var/data`
    - **Size**: At least 1 GB (choose based on your storage needs)
19. Click "Save"

**Then Configure Environment Variables:**
20. Click "Environment" in the left sidebar
21. Add two environment variables:
    - Key: `STORAGE_PATH` Value: `/var/data`
    - Key: `FRONTEND_URL` Value: Your frontend URL from step 14
22. Click "Save Changes" (this will trigger a redeploy of the backend)
23. Wait for backend to redeploy successfully

**Without persistent storage (steps 16-19), all your documents will be lost on every restart!**

## Post-Deployment

1. Wait for both services to deploy (first deploy may take 5-10 minutes)
2. Visit your frontend URL to test the application
3. Check logs in Render dashboard if there are any issues

## Persistent Storage Configuration

**Important**: By default, uploaded files and data are stored in ephemeral storage that is lost when the container restarts or redeploys. To persist your data, you must configure persistent storage.

### Render (Persistent Disk)

1. Go to your backend service (`filesph-backend`) in the Render dashboard
2. Click "Disks" in the left sidebar
3. Click "Add Disk"
4. Configure the disk:
   - **Name**: `filesph-data`
   - **Mount Path**: `/var/data`
   - **Size**: Choose based on your needs (minimum 1 GB recommended)
5. Click "Save"
6. Add environment variable:
   - Go to "Environment" in the left sidebar
   - Add: `STORAGE_PATH` = `/var/data`
   - Click "Save Changes"
7. The service will redeploy with persistent storage enabled

### Railway (Volume Mount)

1. Go to your Railway project dashboard
2. Click on your backend service
3. Go to the "Variables" tab
4. Add: `STORAGE_PATH` = `/var/data`
5. Go to the "Settings" tab
6. Under "Deploy" section, add a volume:
   - **Mount Path**: `/var/data`
   - **Size**: Choose based on your needs
7. Click "Deploy" to apply changes

### Other Platforms

For other deployment platforms, set the `STORAGE_PATH` environment variable to point to a persistent volume mount path. The application will store:
- `data.json` - Document and category metadata
- `uploads/` - Uploaded files and thumbnails

## Custom Domain Setup

If you want to use your own domain instead of the default Render/Railway domain:

### Step 1: Configure Custom Domain on Your Platform

**On Render:**
1. Go to your frontend service settings
2. Click "Custom Domains" 
3. Add your custom domain (e.g., `mydomain.com`)
4. Configure DNS as instructed by Render

**On Railway:**
1. Go to your frontend service settings
2. Click "Settings" → "Domains"
3. Add your custom domain
4. Configure DNS as instructed by Railway

### Step 2: Update Backend CORS Configuration

This is **critical** - after adding a custom domain, you must update the `FRONTEND_URL` environment variable on your backend:

1. Go to your backend service settings
2. Update the `FRONTEND_URL` environment variable to include **both** the original and custom domains (comma-separated):
   ```
   FRONTEND_URL=https://old-render-domain.onrender.com,https://mycustomdomain.com
   ```
3. Save and wait for the backend to redeploy

**Why both URLs?** Including both ensures:
- Users accessing via the old URL still work during migration
- Users accessing via the new custom domain work immediately
- No login/authentication issues due to CORS blocking

### Step 3: (Optional) Remove Old Domain

Once you've fully migrated to your custom domain, you can update `FRONTEND_URL` to only include your custom domain:
```
FRONTEND_URL=https://mycustomdomain.com
```

## Important Notes

- Free tier services on Render may spin down after inactivity
- First request after spin-down may take 30-60 seconds
- For production use, consider upgrading to paid tier for better performance
- **Data persistence requires a paid plan on most platforms** (free tiers typically have ephemeral storage)

## Troubleshooting

### Login Not Working After Domain Change
- **Cause**: The `FRONTEND_URL` environment variable on the backend doesn't include your new domain, causing CORS to block login requests.
- **Solution**: Update `FRONTEND_URL` on your backend to include your new domain. You can use comma-separated URLs to include multiple domains:
  ```
  FRONTEND_URL=https://old-domain.onrender.com,https://yournewdomain.com
  ```
  After updating, redeploy the backend service.

### Uploaded Documents Disappear After a Few Hours
- **Cause**: Persistent storage is not configured. The default storage location is ephemeral and is lost when the container restarts.
- **Solution**: Configure persistent storage as described in the "Persistent Storage Configuration" section above.

### Backend Shows CORS Warnings on Initial Deployment
- **Cause**: FRONTEND_URL environment variable is not set yet
- **Solution**: This is expected behavior. The backend will start successfully but show warnings and block all CORS requests until FRONTEND_URL is configured. Follow the deployment steps to add the frontend URL to the backend's environment variables after the frontend is deployed. Once FRONTEND_URL is set, the backend will automatically configure CORS correctly.

### CORS Errors
- Ensure `FRONTEND_URL` in backend matches your frontend URL exactly (including https://)
- For custom domains, use comma-separated URLs: `FRONTEND_URL=https://render-url.onrender.com,https://customdomain.com`
- Check that backend CORS configuration allows your frontend domain
- Verify the backend service has successfully redeployed after setting FRONTEND_URL

### API Connection Issues
- Verify `VITE_API_URL` in frontend points to correct backend URL
- Check backend service logs for errors

### Build Failures
- Ensure all dependencies are in package.json
- Check Node version compatibility
- Review build logs in Render dashboard
