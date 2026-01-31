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
5. Add Environment Variables:
   - `NODE_ENV`: `production`
   - `FRONTEND_URL`: (will be set after frontend deployment)
6. Click "Create Web Service"
7. **Copy the backend URL** (e.g., `https://filesph-backend.onrender.com`)

#### Deploy Frontend
1. Click "New +" → "Static Site"
2. Connect repository: `janaya-ai/filesph`
3. Configure:
   - **Name**: `filesph-frontend`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Add Environment Variable:
   - `VITE_API_URL`: Your backend URL from above
5. Click "Create Static Site"
6. **Copy the frontend URL** and update the backend's `FRONTEND_URL` environment variable

## Post-Deployment

1. Wait for both services to deploy (first deploy may take 5-10 minutes)
2. Visit your frontend URL to test the application
3. Check logs in Render dashboard if there are any issues

## Important Notes

- Free tier services on Render may spin down after inactivity
- First request after spin-down may take 30-60 seconds
- For production use, consider upgrading to paid tier for better performance

## Troubleshooting

### CORS Errors
- Ensure `FRONTEND_URL` in backend matches your frontend URL exactly
- Check that backend CORS configuration allows your frontend domain

### API Connection Issues
- Verify `VITE_API_URL` in frontend points to correct backend URL
- Check backend service logs for errors

### Build Failures
- Ensure all dependencies are in package.json
- Check Node version compatibility
- Review build logs in Render dashboard
