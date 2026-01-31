# Deployment Guide for Render

This guide explains how to deploy the filesph application to Render.

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
7. **Important**: After deployment, you need to set the FRONTEND_URL:
   - Go to the backend service (`filesph-backend`) in the Render dashboard
   - Click "Environment" in the left sidebar
   - Add environment variable:
     - Key: `FRONTEND_URL`
     - Value: Your frontend URL (e.g., `https://filesph-frontend.onrender.com`)
   - Click "Save Changes" (this will trigger a redeploy of the backend)

**Note**: The backend will fail to start initially because FRONTEND_URL is not set. This is a security feature. Once you add the frontend URL in step 7, the backend will redeploy and start successfully.

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
7. **Important**: The backend will fail to start initially because FRONTEND_URL is not set. This is expected - you'll add it in step 12.
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

#### Configure Backend CORS
15. Go back to the backend service settings
16. Click "Environment" in the left sidebar
17. Add environment variable:
   - `FRONTEND_URL`: Your frontend URL from step 14
18. Click "Save Changes" (this will trigger a redeploy of the backend)
19. Wait for backend to redeploy successfully

## Post-Deployment

1. Wait for both services to deploy (first deploy may take 5-10 minutes)
2. Visit your frontend URL to test the application
3. Check logs in Render dashboard if there are any issues

## Important Notes

- Free tier services on Render may spin down after inactivity
- First request after spin-down may take 30-60 seconds
- For production use, consider upgrading to paid tier for better performance

## Troubleshooting

### Backend Fails to Start on Initial Deployment
- **Cause**: FRONTEND_URL environment variable is not set
- **Solution**: This is expected and is a security feature. The backend requires FRONTEND_URL to be set in production. Follow the deployment steps to add the frontend URL to the backend's environment variables after the frontend is deployed.

### CORS Errors
- Ensure `FRONTEND_URL` in backend matches your frontend URL exactly (including https://)
- Check that backend CORS configuration allows your frontend domain
- Verify the backend service has successfully redeployed after setting FRONTEND_URL

### API Connection Issues
- Verify `VITE_API_URL` in frontend points to correct backend URL
- Check backend service logs for errors

### Build Failures
- Ensure all dependencies are in package.json
- Check Node version compatibility
- Review build logs in Render dashboard
