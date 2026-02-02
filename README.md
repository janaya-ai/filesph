# Document Viewer - Scribd-like Web Application

A modern, full-featured document viewer application inspired by Scribd, built with React and Node.js. View, share, download, and print documents with a beautiful, responsive interface.

## 🌟 Features

### Document Viewing
- **Full-page viewer** with continuous vertical scrolling
- **Multi-format support**: PDF, JPG, PNG, and TXT files
- **High-resolution rendering** using PDF.js
- **Zoom controls**: Zoom in/out, fit-to-width, fit-to-page
- **Auto-hide toolbar** for distraction-free reading
- **Page tracking** with visual indicators
- **Lazy loading** for optimal performance

### Document Management
- **Multi-file upload**: Upload multiple files that merge into a single viewer
- **Seamless scrolling** across multiple files
- **Categories**: Organize documents with custom categories
- **Featured documents**: Highlight important documents on the homepage
- **Download options**: Download individual or combined documents
- **Print support**: Print entire multi-file documents
- **Share functionality**: Copy links and embed codes

### Admin Dashboard
- **Upload management**: Easy drag-and-drop file uploads
- **Category management**: Create, edit, and delete categories
- **Document organization**: Assign documents to categories
- **Featured controls**: Mark documents as featured
- **Document deletion**: Remove documents and associated files

### User Experience
- **Clean, modern UI** with Tailwind CSS
- **Mobile-responsive** design
- **Touch-friendly** controls
- **Embeddable viewer**: Iframe support for external websites
- **Public access**: No login required for viewing

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. **Clone or navigate to the project**
   ```bash
   cd c:\Users\gavin\filesph.com
   ```

2. **Install all dependencies**
   ```bash
   npm run install:all
   ```
   Or install individually:
   ```bash
   npm install          # Root dependencies
   cd frontend && npm install
   cd ../backend && npm install
   ```

### Running the Application

#### Option 1: Run Both Servers (Recommended)
```bash
npm run dev
```
This starts both the frontend (port 5173) and backend (port 3001) concurrently.

#### Option 2: Run Separately
```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend
npm run dev:frontend
```

#### Option 3: Use VS Code Tasks
Press `Ctrl+Shift+B` and select "Start Development Servers"

### Access the Application
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Admin Dashboard**: http://localhost:5173/admin

## 📁 Project Structure

```
filesph.com/
├── frontend/               # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   │   ├── PDFRenderer.tsx
│   │   │   ├── ImageRenderer.tsx
│   │   │   └── TextRenderer.tsx
│   │   ├── pages/          # Main pages
│   │   │   ├── Home.tsx
│   │   │   ├── Viewer.tsx
│   │   │   └── Admin.tsx
│   │   ├── types/          # TypeScript definitions
│   │   ├── utils/          # API client and utilities
│   │   └── main.tsx
│   └── package.json
│
├── backend/                # Express API
│   ├── server.js           # Main server file
│   ├── data.json           # JSON database
│   ├── uploads/            # Uploaded files storage
│   └── package.json
│
├── .github/
│   └── copilot-instructions.md
├── .vscode/
│   └── tasks.json
└── package.json            # Root package
```

## 🎯 Usage Guide

### For Viewers

1. **Browse Documents**
   - Visit the homepage to see all available documents
   - View featured documents at the top
   - Filter by category using the category buttons

2. **View Documents**
   - Click any document card to open the viewer
   - Use toolbar controls:
     - 🔍 Zoom in/out
     - 📱 Fit to width/page
     - 📥 Download document
     - 🖨️ Print document
     - 🔗 Share link or embed code
     - ⛶ Fullscreen mode
   - Scroll continuously through all pages

3. **Share Documents**
   - Click the share button in the viewer
   - Copy link to share directly
   - Copy embed code to add to websites

### For Admins

1. **Access Admin Dashboard**
   - Click "Admin Dashboard" from the homepage
   - Or navigate to `/admin`

2. **Upload Documents**
   - Select one or multiple files (PDF, JPG, PNG, TXT)
   - Enter a document name
   - Select categories (optional)
   - Mark as featured (optional)
   - Click "Upload Document"

3. **Manage Categories**
   - Switch to "Categories" tab
   - Create new categories with descriptions
   - Edit or delete existing categories
   - View document counts per category

4. **Manage Documents**
   - View all uploaded documents
   - Toggle featured status
   - View documents in the viewer
   - Delete documents (removes files)

## 🔧 API Endpoints

### Documents
- `GET /api/documents` - Get all documents
- `GET /api/documents/:id` - Get single document
- `POST /api/documents` - Upload new document (multipart/form-data)
- `PATCH /api/documents/:id` - Update document
- `DELETE /api/documents/:id` - Delete document
- `GET /api/documents/:id/download` - Download document

### Categories
- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create category
- `PATCH /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

### Files
- `GET /api/files/:filename` - Access uploaded file

## 🎨 Customization

### Styling
- Tailwind CSS classes are used throughout
- Modify `frontend/tailwind.config.js` for theme customization
- Edit component styles in respective `.tsx` files

### Configuration
- Frontend port: `frontend/vite.config.ts`
- Backend port: `backend/server.js` (PORT variable)
- File size limits: `backend/server.js` (multer config)
- Allowed file types: `backend/server.js` (fileFilter)

## 🌐 Deployment

⚠️ **CRITICAL: Data Persistence Required**

Before deploying to production, you **MUST** configure persistent storage, or all uploaded documents will be deleted when the server restarts! See the [DEPLOYMENT.md](DEPLOYMENT.md) guide for detailed instructions.

### Quick Deployment Checklist
- [ ] Deploy backend and frontend services
- [ ] **Configure persistent disk/volume** (CRITICAL!)
- [ ] Set `STORAGE_PATH` environment variable to persistent disk path
- [ ] Set `FRONTEND_URL` environment variable for CORS
- [ ] Test that storage is persistent

For detailed deployment instructions for Render, Railway, and other platforms, see [DEPLOYMENT.md](DEPLOYMENT.md).

### Frontend (Build for Production)
```bash
cd frontend
npm run build
```
Output will be in `frontend/dist/`

For production deployment where backend is on a different domain:
```bash
cd frontend
VITE_API_URL=https://your-backend-url.com npm run build
```

### Backend
- Can be deployed to any Node.js hosting (Heroku, Railway, Render, etc.)
- Set environment variable `PORT` if needed
- **CRITICAL**: Configure persistent storage and set `STORAGE_PATH` environment variable

### Environment Variables

#### Backend
- `PORT` - Backend server port (default: 3001)
- `STORAGE_PATH` - **REQUIRED for production** - Path to persistent storage volume (e.g., `/var/data`)
- `FRONTEND_URL` - **REQUIRED for production** - Frontend URL for CORS (e.g., `https://your-frontend.com`)
- `ADMIN_PASSWORD` - Admin login password (default: `admin123`)
- `JWT_SECRET` - JWT secret for authentication (change in production)
- `NODE_ENV` - Set to `production` for production deployment

#### Frontend (Build Time)
- `VITE_API_URL` - Backend URL for production deployment (optional)
  - If not set: Uses `/api` (works with Vite dev proxy)
  - If set: Uses `${VITE_API_URL}/api` (e.g., `https://your-backend.com/api`)
  - Example: `VITE_API_URL=https://api.example.com npm run build`

## 📦 Tech Stack

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Tailwind CSS** - Styling
- **PDF.js** - PDF rendering
- **Axios** - HTTP client
- **Lucide React** - Icon library

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **Multer** - File upload handling
- **CORS** - Cross-origin support
- **UUID** - Unique ID generation

## 🔒 Security Considerations

- File type validation on upload
- File size limits (50MB default)
- CORS enabled (configure for production)
- No authentication (add for production use)
- Sanitize user inputs in production

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Change port in package.json or kill existing process
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### PDF.js Worker Issues
- Worker is loaded from CDN
- Check browser console for errors
- Ensure internet connection for worker script

### File Upload Fails
- Check file size (max 50MB)
- Verify file type (PDF, JPG, PNG, TXT)
- Ensure `backend/uploads/` directory exists
- Check backend logs for errors

### Frontend Can't Connect to Backend
- **Development**: Verify backend is running on port 3001
- **Development**: Check proxy settings in `vite.config.ts`
- **Production**: Ensure `VITE_API_URL` is set correctly during build
- **Both**: Ensure CORS is enabled in backend

## 📝 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🤝 Contributing

This is a personal project, but suggestions and improvements are welcome!

## 📧 Support

For issues or questions, please check the troubleshooting section or create an issue in the repository.

---

**Built with ❤️ using React, Node.js, and modern web technologies**
