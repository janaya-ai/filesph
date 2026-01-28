# Document Viewer Project - Copilot Instructions

## Project Overview
This is a Scribd-like document viewer application with React frontend and Node.js backend.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express
- **PDF Rendering**: PDF.js
- **Styling**: Tailwind CSS
- **File Uploads**: Multer
- **Database**: JSON file-based storage (can be upgraded to MongoDB/PostgreSQL)

## Project Structure
- `/frontend` - React application with document viewer and admin UI
- `/backend` - Express API for file management and metadata
- `/uploads` - Stored documents (PDF, images, text files)
- `/public` - Static assets

## Key Features
1. Full-page document viewer with continuous scrolling
2. Multi-file upload and merging into single viewer
3. Zoom, download, print, and share controls
4. Admin dashboard for categories and featured documents
5. Mobile-responsive and embeddable viewer
6. Lazy loading for performance

## Development Guidelines
- Use functional components with React hooks
- TypeScript for type safety
- Responsive design with Tailwind CSS
- RESTful API design patterns
- Error handling and loading states
- Optimize for performance with lazy loading
