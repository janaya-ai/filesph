# Copilot Instructions — filesph.com

## Architecture

Monorepo with two independent packages (each has its own `package.json`):
- **`/frontend`** — React 18 + TypeScript + Vite (port 5173). Tailwind CSS styling, `react-router-dom` for routing, `axios` for API calls.
- **`/backend`** — Express (ESM, `"type": "module"`) single-file server (`server.js`, ~2200 lines, port 3001). JSON file-based database (`data.json`). No ORM.

The root `package.json` only has `concurrently` for running both servers. Run `npm run install:all` to install all three `node_modules`.

## Data Flow & Storage

- **Database**: `backend/data.json` stores `{ documents, categories, agencies }`. Read/write via `readData()`/`writeData()` helpers in `server.js`.
- **File storage (primary)**: Cloudflare R2 (S3-compatible). Files uploaded via `POST /api/documents/upload-r2`, stored at `{category}/{yyyy}/{mm}/{filename}`. Public URLs served directly or proxied through `/api/proxy`.
- **File storage (legacy)**: Local `backend/uploads/` directory via multer. Still supported for backward compatibility.
- **Three document formats coexist**: `fileUrls[]` (R2 multi-file), `fileUrl` (R2 single), `files[]` (local). `formatDocumentForResponse()` normalizes these for the API.
- Documents are identified by both `id` (UUID) and `slug` (URL-friendly). All GET endpoints accept either.

## Key Routing Pattern (Frontend)

Two viewer routes serve different purposes:
- `/view/:docId` → `Viewer.tsx` — Raw full-screen viewer (no SEO, used for embeds)
- `/d/:slug` → `DocumentPage.tsx` — SEO-optimized page with meta tags, JSON-LD, related documents
- `/embed/:slug` → `DocumentPage` with `embedded` prop for iframe embedding

Always prefer slug-based `/d/:slug` routes for new public-facing links.

## API Communication

- `frontend/src/utils/api.ts` — Centralized API client. Uses **relative paths** (`/api/...`) on localhost and filesph.com (proxied by Vite in dev, `_redirects` in prod). Only uses absolute URLs for non-standard deployments.
- Vite dev proxy: `/api` → `http://localhost:3001` (configured in `vite.config.ts`).
- **CORS proxy**: External URLs (R2/CDN) fetched through `GET /api/proxy?url=` to avoid browser CORS issues, especially for PDF.js canvas rendering.

## Frontend Conventions

- **Functional components only** with React hooks. No class components, no state management library.
- **Loading/error pattern**: Every data-fetching page uses `useState` for `loading`/`error` + `useEffect` for fetch. Show spinner → content → error with "Go Home" link.
- **SEO**: `react-helmet-async` on all public pages (Home, DocumentPage, SearchPage). JSON-LD `DigitalDocument` structured data on DocumentPage only.
- **Document rendering**: Type-detected via URL extension (`getFileTypeFromUrl`), dispatched to `PDFRenderer`, `ImageRenderer`, or `TextRenderer`. PDF.js renders to canvas elements with hi-DPI support (`devicePixelRatio`).
- **Icons**: `lucide-react` library throughout.
- **Responsive**: Tailwind breakpoints (`sm:`, `md:`, `lg:`). Mobile-specific hamburger menus and compact toolbars.

## Backend Conventions

- All routes in single `server.js` file (no router modules). Route order matters.
- Slug auto-generation via `generateSlug()` + `ensureUniqueSlug()`. Migration runs on startup for documents without slugs.
- `authenticateAdmin` middleware exists but is **not currently applied** to routes — all endpoints are public.
- Thumbnail generation: `jimp` for images, null/placeholder for PDFs and text.
- Downloads proxied through backend (hides R2 URLs): single file via `/api/download/:docId/:fileIndex`, ZIP via `/api/download-all/:docId`.
- SEO: Dynamic `sitemap.xml` and `robots.txt` generated at runtime.

## Development Workflow

```bash
npm run install:all     # Install root + frontend + backend deps
npm run dev             # Start both servers (concurrently)
npm run dev:frontend    # Frontend only (port 5173)
npm run dev:backend     # Backend only (port 3001, uses nodemon)
npm run build           # Build frontend (tsc + vite build → frontend/dist/)
```

Or use VS Code task: `Ctrl+Shift+B` → "Start Development Servers"

## Environment Variables

Backend requires for production: `STORAGE_PATH`, `FRONTEND_URL` (comma-separated for multiple origins), `ADMIN_PASSWORD`, `JWT_SECRET`. R2 needs: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`. Frontend build-time: `VITE_API_URL` (only for non-filesph.com deployments).

## Types

Shared TypeScript types in `frontend/src/types/index.ts`. Key interfaces: `Document` (supports all three file storage formats), `Category`, `Agency`, `ViewerState`. Backend is plain JavaScript (no types).
