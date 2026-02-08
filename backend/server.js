import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import Jimp from 'jimp'
import { PDFDocument } from 'pdf-lib'
import archiver from 'archiver'
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// Storage path configuration
// Use STORAGE_PATH env variable for persistent storage in production
// Falls back to backend directory for local development
const storagePath = process.env.STORAGE_PATH || __dirname

// Admin credentials (in production, use environment variables and proper hashing)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

// ========================================
// Cloudflare R2 Configuration
// ========================================
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL

// Initialize R2 client (S3-compatible)
let r2Client = null
if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
  r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  })
  console.log('R2 client initialized for file uploads')
} else {
  console.log('R2 credentials not configured - direct upload disabled')
}

/**
 * Sanitize filename for safe storage
 */
function sanitizeFilename(filename) {
  const basename = path.basename(filename)
  return basename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase()
}

/**
 * Get file extension from filename or content type
 */
function getFileExtension(filename, contentType) {
  const ext = path.extname(filename).toLowerCase()
  if (ext) return ext
  
  const mimeToExt = {
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/msword': '.doc',
    'text/csv': '.csv',
    'application/csv': '.csv',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp'
  }
  return mimeToExt[contentType] || ''
}

/**
 * Upload file to R2
 * @param {Buffer} fileBuffer - File data
 * @param {string} filename - Original filename
 * @param {string} contentType - MIME type
 * @param {string} category - Category for folder structure
 * @returns {Promise<{url: string, key: string, size: number}>}
 */
async function uploadToR2(fileBuffer, filename, contentType, category = 'documents') {
  if (!r2Client || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
    throw new Error('R2 storage not configured')
  }
  
  // Generate folder path: /{category}/{yyyy}/{mm}/{filename}
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  
  // Sanitize filename
  const ext = getFileExtension(filename, contentType)
  const baseName = sanitizeFilename(path.basename(filename, ext))
  const uniqueSuffix = uuidv4().slice(0, 8)
  const finalFilename = `${baseName}_${uniqueSuffix}${ext}`
  
  // Build the key path
  const categorySlug = category.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
  const key = `${categorySlug}/${year}/${month}/${finalFilename}`
  
  await r2Client.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  }))
  
  const publicUrl = `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`
  
  return {
    url: publicUrl,
    key: key,
    size: fileBuffer.length
  }
}

/**
 * Extract the R2 key from a public URL
 * @param {string} url - The public URL of the file
 * @returns {string|null} - The R2 key or null if not a valid R2 URL
 */
function getR2KeyFromUrl(url) {
  if (!R2_PUBLIC_URL || !url) return null
  
  const publicUrlBase = R2_PUBLIC_URL.replace(/\/$/, '')
  if (!url.startsWith(publicUrlBase)) {
    return null
  }
  
  // Extract the key (everything after the base URL)
  const key = url.substring(publicUrlBase.length + 1) // +1 for the /
  return key || null
}

/**
 * Delete a file from R2
 * @param {string} url - The public URL of the file to delete
 * @returns {Promise<boolean>} - True if deleted successfully or file didn't exist
 */
async function deleteFromR2(url) {
  if (!r2Client || !R2_BUCKET_NAME) {
    console.log('R2 not configured, skipping file deletion')
    return false
  }
  
  const key = getR2KeyFromUrl(url)
  if (!key) {
    console.log(`URL is not an R2 URL or could not extract key: ${url}`)
    return false
  }
  
  try {
    await r2Client.send(new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }))
    console.log(`Deleted from R2: ${key}`)
    return true
  } catch (error) {
    // DeleteObject doesn't throw if the object doesn't exist, but log any other errors
    console.error(`Failed to delete from R2: ${key}`, error)
    return false
  }
}

// CORS configuration
// FALLBACK_ORIGIN uses HTTP for local development (localhost doesn't use HTTPS)
// Production environments will always use HTTPS via FRONTEND_URL env variable
// FRONTEND_URL supports multiple comma-separated URLs for custom domains
const FALLBACK_ORIGIN = 'http://localhost:5173'
const allowedOrigins = []

if (process.env.FRONTEND_URL) {
  // Support multiple comma-separated URLs for custom domains
  // Parse URLs: split by comma, trim whitespace, filter empty strings
  const rawUrls = process.env.FRONTEND_URL.split(',')
  const urls = rawUrls.map(url => url.trim()).filter(url => url)
  let validCount = 0
  const invalidUrls = []
  
  for (const url of urls) {
    try {
      // Validate each URL is valid
      new URL(url)
      allowedOrigins.push(url)
      validCount++
    } catch (error) {
      invalidUrls.push(url)
    }
  }
  
  if (validCount > 0) {
    console.log('CORS configured for origins:', allowedOrigins.join(', '))
  }
  
  if (invalidUrls.length > 0) {
    console.warn(`WARNING: Invalid URL(s) in FRONTEND_URL: ${invalidUrls.join(', ')}`)
  }
  
  // If no valid URLs and in production, warn but continue
  if (validCount === 0) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('WARNING: No valid URLs in FRONTEND_URL environment variable.')
      console.warn('The API will start but CORS will block all requests until FRONTEND_URL is corrected.')
      console.warn('Please fix FRONTEND_URL environment variable to a valid URL (or comma-separated URLs).')
    } else {
      console.warn(`No valid URLs in FRONTEND_URL. Falling back to ${FALLBACK_ORIGIN}`)
      allowedOrigins.push(FALLBACK_ORIGIN)
    }
  }
} else {
  // In production, missing FRONTEND_URL is a warning (not fatal)
  // This allows initial deployment before frontend URL is available
  if (process.env.NODE_ENV === 'production') {
    console.warn('WARNING: FRONTEND_URL environment variable is not set.')
    console.warn('The API will start but CORS will block all requests until FRONTEND_URL is configured.')
    console.warn('Please set FRONTEND_URL environment variable to your frontend URL as soon as possible.')
    // Don't add any origins - CORS will block all requests
  } else {
    // In development, use localhost
    console.log('Using default CORS origin for development:', FALLBACK_ORIGIN)
    allowedOrigins.push(FALLBACK_ORIGIN)
  }
}

// Enable CORS with credentials support for authentication
// credentials: true allows cookies and authorization headers
// This is safe because allowedOrigins is strictly validated above
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}))

// Middleware
app.use(express.json())

// Allow iframe embedding
app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options')
  res.setHeader('Content-Security-Policy', "frame-ancestors *")
  next()
})

app.use('/api/files', express.static(path.join(storagePath, 'uploads')))

// Proxy endpoint for external files (R2, CDN) to avoid CORS issues
app.get('/api/proxy', async (req, res) => {
  const { url } = req.query
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' })
  }
  
  try {
    // Validate URL
    const parsedUrl = new URL(url)
    
    // Only allow https URLs for security
    if (parsedUrl.protocol !== 'https:') {
      return res.status(400).json({ error: 'Only HTTPS URLs are allowed' })
    }
    
    // Fetch the file
    const response = await fetch(url)
    
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch file' })
    }
    
    // Get content type and set headers
    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=86400') // Cache for 1 day
    
    // Stream the response
    const buffer = await response.arrayBuffer()
    res.send(Buffer.from(buffer))
  } catch (error) {
    console.error('Proxy error:', error)
    res.status(500).json({ error: 'Failed to proxy file' })
  }
})

// Helper function to extract filename from URL
function getFilenameFromUrl(url) {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const filename = pathname.split('/').pop() || 'document'
    // Decode URI component to handle encoded characters
    return decodeURIComponent(filename)
  } catch {
    return 'document'
  }
}

// ========================================
// Secure PDF/file streaming — hides raw R2 URLs completely
// Used by embed viewer iframe: <iframe src="/api/pdf/:slug">
// ========================================
app.get('/api/pdf/:slug', async (req, res) => {
  const { slug } = req.params
  const fileIndex = parseInt(req.query.file) || 0

  try {
    const data = await readData()
    const document = data.documents.find(doc => doc.id === slug || doc.slug === slug)

    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }

    // Collect file URLs from all supported formats
    let fileUrls = []
    if (document.fileUrls && document.fileUrls.length > 0) {
      fileUrls = document.fileUrls
    } else if (document.fileUrl) {
      fileUrls = [document.fileUrl]
    } else if (document.files && document.files.length > 0) {
      // Legacy local files — read and serve directly
      const file = document.files[fileIndex]
      if (!file) return res.status(400).json({ error: 'Invalid file index' })
      const localPath = path.join(uploadsDir, file.filename)
      try {
        const fileBuffer = await fs.readFile(localPath)
        res.setHeader('Content-Type', file.mimeType || 'application/octet-stream')
        res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`)
        res.setHeader('Cache-Control', 'public, max-age=86400')
        return res.send(fileBuffer)
      } catch {
        return res.status(404).json({ error: 'File not found on disk' })
      }
    }

    if (fileUrls.length === 0) {
      return res.status(400).json({ error: 'No files available' })
    }
    if (fileIndex < 0 || fileIndex >= fileUrls.length) {
      return res.status(400).json({ error: 'Invalid file index' })
    }

    const fileUrl = fileUrls[fileIndex]
    const filename = getFilenameFromUrl(fileUrl)

    // Try R2 via S3 API first (works even with private buckets)
    const key = getR2KeyFromUrl(fileUrl)
    if (key && r2Client && R2_BUCKET_NAME) {
      try {
        const command = new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key })
        const r2Response = await r2Client.send(command)

        res.setHeader('Content-Type', r2Response.ContentType || 'application/octet-stream')
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
        res.setHeader('Cache-Control', 'public, max-age=86400')
        if (r2Response.ContentLength) {
          res.setHeader('Content-Length', r2Response.ContentLength)
        }

        // Pipe the R2 stream directly to the response
        r2Response.Body.pipe(res)

        // Track view (fire-and-forget)
        document.views = (document.views || 0) + 1
        writeData(data).catch(() => {})
        return
      } catch (r2Error) {
        console.error('R2 GetObject failed, falling back to fetch:', r2Error.message)
      }
    }

    // Fallback: fetch via public URL
    const response = await fetch(fileUrl)
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch file' })
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
    res.setHeader('Cache-Control', 'public, max-age=86400')

    const buffer = await response.arrayBuffer()
    res.send(Buffer.from(buffer))

    // Track view
    document.views = (document.views || 0) + 1
    await writeData(data)
  } catch (error) {
    console.error('PDF streaming error:', error)
    res.status(500).json({ error: 'Failed to stream file' })
  }
})

// ========================================
// Server-rendered embeddable viewer page
// Serves a self-contained HTML page with branding, ads, and secure PDF iframe
// This route is on the backend so it works regardless of static site SPA routing
// ========================================
app.get('/api/embed/:slug', async (req, res) => {
  const { slug } = req.params

  try {
    const data = await readData()
    const document = data.documents.find(doc => doc.id === slug || doc.slug === slug)

    if (!document) {
      return res.status(404).send(`<!DOCTYPE html><html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#666"><p>Document not found</p></body></html>`)
    }

    const fileCount = (document.fileUrls && document.fileUrls.length > 0)
      ? document.fileUrls.length
      : document.fileUrl ? 1 : (document.files ? document.files.length : 0)

    const frontendUrl = (process.env.FRONTEND_URL || 'https://filesph.com').split(',')[0].trim()
    const docName = document.name.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

    // Track embedded view
    document.views = (document.views || 0) + 1
    writeData(data).catch(() => {})

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${docName} | filesph.com</title>
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9735892690539350" crossorigin="anonymous"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; }
    .embed-container { min-height: 100vh; display: flex; flex-direction: column; }
    .ad-slot { background: #f9fafb; border-bottom: 1px solid #e5e7eb; padding: 8px 0; text-align: center; flex-shrink: 0; min-height: 80px; }
    .ad-slot-bottom { border-bottom: none; border-top: 1px solid #e5e7eb; }
    .viewer { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .viewer-iframe {
      width: 100vw;
      max-width: 900px;
      height: 75vh;
      min-height: 320px;
      border: 2px solid #2563eb;
      background: #fff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      border-radius: 10px;
      display: block;
    }
    .view-btn-wrap { margin: 18px 0 0 0; display: flex; justify-content: center; }
    .view-btn { display: inline-block; background: #2563eb; color: #fff; font-weight: 600; font-size: 16px; padding: 12px 28px; border-radius: 8px; text-decoration: none; box-shadow: 0 1px 4px rgba(37,99,235,0.08); transition: background 0.2s; }
    .view-btn:hover { background: #1d4ed8; }
    @media (max-width: 900px) {
      .viewer-iframe {
        max-width: 100vw;
        height: 60vh;
        min-height: 180px;
        border-radius: 0;
      }
    }
    @media (max-width: 640px) {
      .ad-slot, .ad-slot-bottom { min-height: 60px; padding: 4px 0; }
      .viewer-iframe {
        width: 100vw;
        height: 60vh;
        min-height: 140px;
        border-radius: 0;
        border-width: 2px;
      }
      .view-btn { font-size: 15px; padding: 10px 16px; }
    }
  </style>
</head>
<body>
  <div class="embed-container">
    <div class="ad-slot">
      <ins class="adsbygoogle"
        style="display:block"
        data-ad-client="ca-pub-9735892690539350"
        data-ad-slot="auto"
        data-ad-format="horizontal"
        data-full-width-responsive="true"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </div>

    <div class="viewer">
      <iframe id="pdfFrame" class="viewer-iframe" src="/api/pdf/${encodeURIComponent(slug)}?file=0" title="${docName}" allow="fullscreen"></iframe>
      <div class="view-btn-wrap">
        <a class="view-btn" href="${frontendUrl}/d/${encodeURIComponent(slug)}" target="_blank" rel="noopener">View or Download on filesph.com</a>
      </div>
    </div>

    <div class="ad-slot ad-slot-bottom">
      <ins class="adsbygoogle"
        style="display:block"
        data-ad-client="ca-pub-9735892690539350"
        data-ad-slot="auto"
        data-ad-format="horizontal"
        data-full-width-responsive="true"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </div>

    <!-- No download/print/save controls in embed -->
  </div>
</body>
</html>`

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.send(html)
  } catch (error) {
    console.error('Embed page error:', error)
    res.status(500).send('Failed to load embed page')
  }
})

// Minimal responsive embed preview — optimized for small iframes
app.get('/api/embed-preview/:slug', async (req, res) => {
  const { slug } = req.params
  try {
    const data = await readData()
    const document = data.documents.find(doc => doc.id === slug || doc.slug === slug)
    if (!document) {
      return res.status(404).send('<!doctype html><html><body style="font-family:sans-serif;padding:24px;text-align:center;color:#666">Document not found</body></html>')
    }

    const frontendUrl = (process.env.FRONTEND_URL || 'https://filesph.com').split(',')[0].trim()
    const title = (document.name || 'Document').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — FilesPH Document Preview</title>
  <meta name="robots" content="noindex, nofollow">
  <style>
    html, body { background: #fff; margin: 0; padding: 0; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #222; }
    .container { max-width: 800px; margin: 40px auto 0 auto; background: #fff; border-radius: 16px; box-shadow: 0 8px 32px rgba(16,24,40,0.13); padding: 0 0 36px 0; display: flex; flex-direction: column; }
    .header { display: flex; align-items: center; padding: 20px 28px 8px 28px; }
    .logo { width: 24px; height: 24px; margin-right: 10px; }
    .header-title { font-size: 16px; font-weight: 600; letter-spacing: 0.01em; color: #2563eb; }
    .doc-title { text-align: center; font-size: 21px; font-weight: 700; margin: 16px 0 8px 0; color: #222; }
    .iframe-wrap { width: 100%; display: flex; justify-content: center; }
    .doc-iframe { width: 100%; max-width: 760px; height: 500px; border: 1.5px solid #e6e6e6; border-radius: 8px; background: #fafafa; box-shadow: 0 2px 12px rgba(16,24,40,0.07); }
    @media (max-width: 900px) { .container { max-width: 98vw; } .doc-iframe { max-width: 98vw; height: 340px; } }
    @media (max-width: 640px) { .header { padding: 12px 8px 4px 8px; } .doc-title { font-size: 16px; } .doc-iframe { height: 180px; } .container { margin: 12px auto 0 auto; } }
    .cta-section { margin: 28px 0 0 0; text-align: center; }
    .cta-btn { display: inline-block; background: #2563eb; color: #fff; font-weight: 600; font-size: 17px; padding: 14px 32px; border-radius: 8px; text-decoration: none; box-shadow: 0 1px 4px rgba(37,99,235,0.08); transition: background 0.2s; }
    .cta-btn:hover { background: #1d4ed8; }
    .helper-text { font-size: 13px; color: #888; margin-top: 7px; }
    .footer { text-align: center; font-size: 12px; color: #bbb; margin-top: 22px; letter-spacing: 0.04em; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img class="logo" src="https://filesph.com/favicon.png" alt="FilesPH logo" loading="lazy">
      <span class="header-title">FilesPH Document Preview</span>
    </div>
    <div class="doc-title">${title}</div>
    <div class="iframe-wrap">
      <iframe class="doc-iframe" src="/api/pdf/${encodeURIComponent(slug)}?file=0" title="${title}" loading="lazy" allow="fullscreen"></iframe>
    </div>
    <div class="cta-section">
      <a class="cta-btn" href="${frontendUrl}/d/${encodeURIComponent(slug)}" target="_blank" rel="noopener noreferrer">View Full Document on FilesPH &rarr;</a>
      <div class="helper-text">Open the full document to view all pages and download the file.</div>
    </div>
    <div class="footer">filesph.com</div>
  </div>
</body>
</html>`

    // Short cache to reduce backend load for frequent previews
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=60')
    res.send(html)
  } catch (err) {
    console.error('embed-preview error:', err)
    res.status(500).send('Preview failed')
  }
})

// Download single file from R2 (proxied through backend)
app.get('/api/download/:docId/:fileIndex?', async (req, res) => {
  const { docId, fileIndex } = req.params
  
  try {
    const data = await readData()
    const document = data.documents.find(doc => doc.id === docId || doc.slug === docId)
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }
    
    // Get file URLs from document
    let fileUrls = []
    if (document.fileUrls && document.fileUrls.length > 0) {
      fileUrls = document.fileUrls
    } else if (document.fileUrl) {
      fileUrls = [document.fileUrl]
    } else if (document.files && document.files.length > 0) {
      // Legacy local files - redirect to direct download
      const idx = parseInt(fileIndex) || 0
      if (idx >= 0 && idx < document.files.length) {
        const file = document.files[idx]
        return res.redirect(`/api/files/${file.filename}`)
      }
      return res.status(400).json({ error: 'Invalid file index' })
    } else {
      return res.status(400).json({ error: 'No files available for download' })
    }
    
    // Get file by index (default to 0)
    const idx = parseInt(fileIndex) || 0
    if (idx < 0 || idx >= fileUrls.length) {
      return res.status(400).json({ error: 'Invalid file index' })
    }
    
    const fileUrl = fileUrls[idx]
    
    // Validate URL
    const parsedUrl = new URL(fileUrl)
    if (parsedUrl.protocol !== 'https:') {
      return res.status(400).json({ error: 'Only HTTPS URLs are allowed' })
    }
    
    // Fetch file from R2
    const response = await fetch(fileUrl)
    
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch file from storage' })
    }
    
    // Get filename and content type
    const filename = getFilenameFromUrl(fileUrl)
    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    
    // Set headers for download
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    
    // Stream the file
    const buffer = await response.arrayBuffer()
    res.send(Buffer.from(buffer))
    
    // Track download
    document.downloads = (document.downloads || 0) + 1
    await writeData(data)
  } catch (error) {
    console.error('Download error:', error)
    res.status(500).json({ error: 'Failed to download file' })
  }
})

// Download all files as ZIP
app.get('/api/download-all/:docId', async (req, res) => {
  const { docId } = req.params
  
  try {
    const data = await readData()
    const document = data.documents.find(doc => doc.id === docId || doc.slug === docId)
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }
    
    // Get file URLs from document
    let fileUrls = []
    if (document.fileUrls && document.fileUrls.length > 0) {
      fileUrls = document.fileUrls
    } else if (document.fileUrl) {
      fileUrls = [document.fileUrl]
    } else if (document.files && document.files.length > 0) {
      // Legacy local files
      fileUrls = document.files.map(f => `/api/files/${f.filename}`)
    } else {
      return res.status(400).json({ error: 'No files available for download' })
    }
    
    if (fileUrls.length === 1) {
      // Single file - redirect to single download
      return res.redirect(`/api/download/${docId}/0`)
    }
    
    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 5 } })
    
    // Generate ZIP filename from document name
    const zipFilename = `${document.name.replace(/[^a-z0-9]/gi, '_')}.zip`
    
    // Set headers for ZIP download
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`)
    
    // Pipe archive to response
    archive.pipe(res)
    
    // Add each file to the archive
    for (let i = 0; i < fileUrls.length; i++) {
      const fileUrl = fileUrls[i]
      
      try {
        let fileBuffer
        let filename
        
        if (fileUrl.startsWith('/api/files/')) {
          // Legacy local file
          const localFilename = fileUrl.replace('/api/files/', '')
          const localPath = path.join(uploadsDir, localFilename)
          fileBuffer = await fs.readFile(localPath)
          filename = localFilename
        } else {
          // R2 file
          const response = await fetch(fileUrl)
          if (!response.ok) {
            console.error(`Failed to fetch file ${i}: ${fileUrl}`)
            continue
          }
          const arrayBuffer = await response.arrayBuffer()
          fileBuffer = Buffer.from(arrayBuffer)
          filename = getFilenameFromUrl(fileUrl)
        }
        
        // Add file to archive with numbered prefix to avoid name conflicts
        const archiveFilename = `${i + 1}_${filename}`
        archive.append(fileBuffer, { name: archiveFilename })
      } catch (fileError) {
        console.error(`Error adding file ${i} to archive:`, fileError)
        // Continue with other files
      }
    }
    
    // Finalize archive
    await archive.finalize()
    
    // Track download
    document.downloads = (document.downloads || 0) + 1
    await writeData(data)
  } catch (error) {
    console.error('Download all error:', error)
    res.status(500).json({ error: 'Failed to create ZIP archive' })
  }
})

// Ensure directories exist
const uploadsDir = path.join(storagePath, 'uploads')
const dataFile = path.join(storagePath, 'data.json')

// Log storage configuration (only in development for security)
if (process.env.NODE_ENV !== 'production') {
  console.log(`Storage path configured: ${storagePath}`)
  console.log(`Uploads directory: ${uploadsDir}`)
  console.log(`Data file: ${dataFile}`)
} else {
  if (process.env.STORAGE_PATH) {
    console.log('✓ Persistent storage configured via STORAGE_PATH environment variable')
  } else {
    console.log('⚠️  WARNING: STORAGE_PATH not configured - using ephemeral storage')
    console.log('⚠️  All uploaded documents and data will be LOST when the container restarts!')
    console.log('⚠️  See https://github.com/janaya-ai/filesph/blob/main/DEPLOYMENT.md#persistent-storage-configuration')
  }
}

await fs.mkdir(uploadsDir, { recursive: true })

// Initialize data file if it doesn't exist
try {
  await fs.access(dataFile)
} catch {
  // Try to seed from repo copy if available
  const repoDataPath = path.join(__dirname, 'data.json')
  let seed = { documents: [], categories: [] }
  try {
    const repoData = await fs.readFile(repoDataPath, 'utf-8')
    seed = JSON.parse(repoData)
    console.log('Seeding persistent data.json from repo copy')
  } catch {
    console.log('No repo data.json found, starting empty')
  }
  await fs.writeFile(dataFile, JSON.stringify(seed, null, 2))
}

// Helper functions
async function readData() {
  const data = await fs.readFile(dataFile, 'utf-8')
  return JSON.parse(data)
}

async function writeData(data) {
  await fs.writeFile(dataFile, JSON.stringify(data, null, 2))
}

function generateSlug(name) {
  // Remove file extension if present
  const nameWithoutExt = name.replace(/\.[^/.]+$/, '')
  
  let slug = nameWithoutExt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim()
  
  // Limit length but cut at word boundary (hyphen)
  if (slug.length > 100) {
    slug = slug.substring(0, 100)
    const lastHyphen = slug.lastIndexOf('-')
    if (lastHyphen > 50) { // Only cut at hyphen if it's not too short
      slug = slug.substring(0, lastHyphen)
    }
  }
  
  // Remove trailing hyphen if present
  return slug.replace(/-$/, '')
}

async function ensureUniqueSlug(baseSlug, data, excludeId = null) {
  let slug = baseSlug
  let counter = 1
  
  while (data.documents.some(doc => doc.slug === slug && doc.id !== excludeId)) {
    slug = `${baseSlug}-${counter}`
    counter++
  }
  
  return slug
}

// Format document for API response (convert absolute paths to filenames)
function formatDocumentForResponse(doc) {
  // Handle R2 documents with multiple file URLs (new format)
  if (doc.fileUrls && doc.fileUrls.length > 0) {
    return {
      ...doc,
      thumbnail: doc.thumbnail ? doc.thumbnail.split(path.sep).pop() : doc.thumbnail
    }
  }
  
  // Handle R2 documents with single file URL (legacy R2 format)
  if (doc.fileUrl) {
    return {
      ...doc,
      // Convert single fileUrl to fileUrls array for consistency
      fileUrls: [doc.fileUrl],
      thumbnail: doc.thumbnail ? doc.thumbnail.split(path.sep).pop() : doc.thumbnail
    }
  }
  
  // Handle legacy documents with files array (local uploads)
  return {
    ...doc,
    files: doc.files ? doc.files.map(file => ({
      ...file,
      path: file.filename // Use filename instead of absolute path for API
    })) : [],
    thumbnail: doc.thumbnail ? doc.thumbnail.split(path.sep).pop() : doc.thumbnail
  }
}

// Migration: Add slugs to existing documents
async function migrateDocumentSlugs() {
  try {
    const data = await readData()
    let modified = false
    
    for (const doc of data.documents) {
      if (!doc.slug) {
        const baseSlug = generateSlug(doc.name)
        doc.slug = await ensureUniqueSlug(baseSlug, data, doc.id)
        modified = true
        console.log(`Generated slug for document "${doc.name}": ${doc.slug}`)
      }
    }
    
    if (modified) {
      await writeData(data)
      console.log('Document slug migration completed')
    }
  } catch (error) {
    console.error('Error during slug migration:', error)
  }
}

// Run migration on startup
await migrateDocumentSlugs()

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`
    cb(null, uniqueName)
  }
})

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.txt', '.csv']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowedTypes.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type'))
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
})

// Helper to determine file type
function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase()
  if (ext === '.pdf') return 'pdf'
  if (['.jpg', '.jpeg', '.png'].includes(ext)) return 'image'
  if (['.txt', '.csv'].includes(ext)) return 'text'
  return 'unknown'
}

// Generate thumbnail from file
async function generateThumbnail(filePath, fileType) {
  try {
    const thumbnailName = `thumb_${uuidv4()}.jpg`
    const thumbnailPath = path.join(uploadsDir, thumbnailName)

    if (fileType === 'image') {
      // For images, resize to thumbnail using Jimp (pure JS)
      const image = await Jimp.read(filePath)
      await image
        .cover(400, 600) // Resize with cover (similar to sharp's fit: 'cover')
        .quality(90) // Balanced quality for good visuals and reasonable file size
        .writeAsync(thumbnailPath)
      return thumbnailName
    } else if (fileType === 'pdf') {
      // For PDFs, return null and use a placeholder
      return null
    } else if (fileType === 'text') {
      // For text files, return null (use placeholder)
      return null
    }
    
    return null
  } catch (error) {
    console.error('Failed to generate thumbnail:', error)
    return null
  }
}

// Authentication middleware
function authenticateAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  
  // Simple token validation (in production, use JWT)
  if (token === JWT_SECRET) {
    next()
  } else {
    res.status(401).json({ error: 'Invalid token' })
  }
}

// Routes

// Authentication
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body
  
  if (password === ADMIN_PASSWORD) {
    res.json({ token: JWT_SECRET, success: true })
  } else {
    res.status(401).json({ error: 'Invalid password' })
  }
})

// Get all documents
app.get('/api/documents', async (req, res) => {
  try {
    const data = await readData()
    const formattedDocs = data.documents.map(formatDocumentForResponse)
    res.json(formattedDocs)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch documents' })
  }
})

// Get single document by ID or slug
app.get('/api/documents/:id', async (req, res) => {
  try {
    const data = await readData()
    const identifier = req.params.id
    const document = data.documents.find(doc => doc.id === identifier || doc.slug === identifier)
    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }
    res.json(formatDocumentForResponse(document))
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch document' })
  }
})

// Get related documents (same category or shared tags)
app.get('/api/documents/:id/related', async (req, res) => {
  try {
    const data = await readData()
    const identifier = req.params.id
    const limit = parseInt(req.query.limit) || 6
    
    // Find the current document
    const currentDoc = data.documents.find(doc => doc.id === identifier || doc.slug === identifier)
    if (!currentDoc) {
      return res.status(404).json({ error: 'Document not found' })
    }
    
    const currentCategories = currentDoc.categories || []
    const currentTags = currentDoc.tags || []
    
    // Score other documents by relevance
    const scoredDocs = data.documents
      .filter(doc => doc.id !== currentDoc.id) // Exclude current document
      .map(doc => {
        let score = 0
        const docCategories = doc.categories || []
        const docTags = doc.tags || []
        
        // Primary: Same category (3 points each)
        const sharedCategories = docCategories.filter(cat => currentCategories.includes(cat))
        score += sharedCategories.length * 3
        
        // Secondary: Shared tags (1 point each)
        const sharedTags = docTags.filter(tag => currentTags.includes(tag))
        score += sharedTags.length
        
        // Bonus for featured documents
        if (doc.featured) score += 0.5
        
        // Bonus for recent documents (within last 30 days)
        const docDate = new Date(doc.createdAt)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        if (docDate > thirtyDaysAgo) score += 0.5
        
        return { doc, score, sharedCategories: sharedCategories.length, sharedTags: sharedTags.length }
      })
      .filter(item => item.score > 0) // Only include docs with some relevance
      .sort((a, b) => b.score - a.score) // Sort by score descending
      .slice(0, limit) // Limit results
    
    // Format response
    const relatedDocs = scoredDocs.map(item => ({
      ...formatDocumentForResponse(item.doc),
      relevanceScore: item.score,
      sharedCategories: item.sharedCategories,
      sharedTags: item.sharedTags
    }))
    
    res.json(relatedDocs)
  } catch (error) {
    console.error('Error fetching related documents:', error)
    res.status(500).json({ error: 'Failed to fetch related documents' })
  }
})

// Helper to detect file type from URL (synchronous, extension-based)
function getFileTypeFromUrl(url) {
  const urlLower = url.toLowerCase()
  if (urlLower.includes('.pdf')) return 'pdf'
  if (urlLower.includes('.jpg') || urlLower.includes('.jpeg') || urlLower.includes('.png') || urlLower.includes('.gif') || urlLower.includes('.webp')) return 'image'
  if (urlLower.includes('.txt') || urlLower.includes('.csv')) return 'text'
  if (urlLower.includes('.doc') || urlLower.includes('.docx')) return 'other'
  if (urlLower.includes('.zip') || urlLower.includes('.rar')) return 'other'
  return 'other'
}

/**
 * Async version of getFileTypeFromUrl that also checks Content-Type header for R2 URLs.
 * This is more reliable for R2 URLs that may not have file extensions.
 * @param {string} url - URL to check
 * @returns {Promise<'pdf'|'image'|'text'|'other'>} - Detected file type
 */
async function getFileTypeFromUrlAsync(url) {
  // First try the simple extension-based detection
  const extensionType = getFileTypeFromUrl(url)
  if (extensionType !== 'other') {
    return extensionType
  }
  
  // If extension detection returned 'other', try fetching Content-Type header
  // This is especially useful for R2 URLs without file extensions
  try {
    console.log(`Checking Content-Type for URL: ${url}`)
    
    // Create abort controller for timeout (10 seconds)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    
    const response = await fetch(url, { 
      method: 'HEAD',
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      console.log(`HEAD request failed with status: ${response.status}`)
      return 'other'
    }
    
    const contentType = response.headers.get('content-type') || ''
    console.log(`Content-Type header: ${contentType}`)
    
    if (contentType.includes('application/pdf')) {
      return 'pdf'
    }
    if (contentType.includes('image/')) {
      return 'image'
    }
    if (contentType.includes('text/plain') || contentType.includes('text/csv')) {
      return 'text'
    }
    
    return 'other'
  } catch (error) {
    console.error('Error checking Content-Type:', error.message)
    return 'other'
  }
}

// ========================================
// Direct File Upload to R2
// ========================================
// Configure multer for memory storage (files go to R2, not disk)
const uploadToMemory = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Allow PDF, DOCX, DOC, CSV, Excel, and images
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/csv',
      'application/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ]
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`))
    }
  }
})

// Upload files directly to R2 and create document
// POST /api/documents/upload-r2
// multipart/form-data with fields: files[], name, description, categories, etc.
app.post('/api/documents/upload-r2', uploadToMemory.array('files', 10), async (req, res) => {
  try {
    // Check if R2 is configured
    if (!r2Client) {
      return res.status(503).json({ 
        error: 'R2 storage not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL environment variables.' 
      })
    }

    const files = req.files
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' })
    }

    const { 
      name,
      description = '',
      categories: categoriesJson = '[]',
      featured = 'false',
      releaseDate,
      deadline,
      sourceAgency,
      agencyId = '',
      tags: tagsJson = '[]',
      relatedArticles: relatedArticlesJson = '[]',
      customSlug = ''
    } = req.body

    if (!name) {
      return res.status(400).json({ error: 'Document name is required' })
    }

    // Validate agency if provided (recommended for new uploads)
    const data = await readData()
    if (agencyId && data.agencies) {
      const agencyExists = data.agencies.some(a => a.id === agencyId)
      if (!agencyExists) {
        return res.status(400).json({ error: 'Invalid agency selected' })
      }
    }

    // Parse JSON fields
    let categories = []
    let tags = []
    let relatedArticles = []
    try {
      categories = JSON.parse(categoriesJson)
      tags = JSON.parse(tagsJson)
      relatedArticles = JSON.parse(relatedArticlesJson)
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON in categories, tags, or relatedArticles' })
    }

    // Get category name for folder structure (use first category or 'documents')
    // Note: 'data' was already loaded above for agency validation
    let categoryName = 'documents'
    if (categories.length > 0) {
      const cat = data.categories.find(c => c.id === categories[0])
      if (cat) {
        categoryName = cat.name
      }
    }

    // Upload each file to R2
    console.log(`Uploading ${files.length} file(s) to R2...`)
    const uploadedUrls = []
    let thumbnailUrl = null
    let totalSize = 0

    for (const file of files) {
      try {
        const result = await uploadToR2(
          file.buffer,
          file.originalname,
          file.mimetype,
          categoryName
        )
        uploadedUrls.push(result.url)
        totalSize += result.size
        console.log(`Uploaded: ${file.originalname} -> ${result.url}`)

        // Use first image as thumbnail
        if (!thumbnailUrl && file.mimetype.startsWith('image/')) {
          thumbnailUrl = result.url
        }
      } catch (uploadError) {
        console.error(`Failed to upload ${file.originalname}:`, uploadError)
        return res.status(500).json({ error: `Failed to upload ${file.originalname}: ${uploadError.message}` })
      }
    }

    // Create document record
    // Use custom slug if provided, otherwise auto-generate from name
    let baseSlug = customSlug.trim() ? customSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') : generateSlug(name)
    const slug = await ensureUniqueSlug(baseSlug, data)
    const documentId = uuidv4()

    const newDocument = {
      id: documentId,
      name,
      slug,
      description: description || '',
      tags: Array.isArray(tags) ? tags : [],
      fileUrls: uploadedUrls,
      thumbnailUrl: thumbnailUrl,
      categories: Array.isArray(categories) ? categories : [],
      featured: featured === 'true' || featured === true,
      createdAt: new Date().toISOString(),
      releaseDate: releaseDate || null,
      deadline: deadline || null,
      totalPages: uploadedUrls.length,
      views: 0,
      downloads: 0,
      agencyId: agencyId || null,
      sourceAgency: sourceAgency || null,
      fileSize: totalSize,
      relatedArticles: Array.isArray(relatedArticles) ? relatedArticles.filter(a => a.title && a.url) : []
    }

    data.documents.push(newDocument)

    // Update category document counts
    newDocument.categories.forEach(catId => {
      const category = data.categories.find(c => c.id === catId)
      if (category) {
        category.documentCount++
      }
    })

    await writeData(data)
    
    console.log(`Document created: ${name} with ${uploadedUrls.length} file(s)`)
    res.status(201).json(newDocument)
  } catch (error) {
    console.error('R2 upload error:', error)
    res.status(500).json({ error: 'Failed to upload document' })
  }
})

// Upload thumbnail to R2
app.post('/api/documents/:id/thumbnail-r2', uploadToMemory.single('thumbnail'), async (req, res) => {
  try {
    if (!r2Client) {
      return res.status(503).json({ error: 'R2 storage not configured' })
    }

    const file = req.file
    if (!file) {
      return res.status(400).json({ error: 'No thumbnail file uploaded' })
    }

    const data = await readData()
    const docIndex = data.documents.findIndex(doc => doc.id === req.params.id)
    if (docIndex === -1) {
      return res.status(404).json({ error: 'Document not found' })
    }

    // Upload to R2 in thumbnails folder
    const result = await uploadToR2(
      file.buffer,
      file.originalname,
      file.mimetype,
      'thumbnails'
    )

    // Update document
    data.documents[docIndex].thumbnailUrl = result.url
    await writeData(data)

    console.log(`Thumbnail uploaded for document ${req.params.id}: ${result.url}`)
    res.json({ thumbnailUrl: result.url })
  } catch (error) {
    console.error('Thumbnail upload error:', error)
    res.status(500).json({ error: 'Failed to upload thumbnail' })
  }
})

// Replace a specific file in a document
// POST /api/documents/:id/replace-file
// Body: { fileIndex: number } + multipart file upload
app.post('/api/documents/:id/replace-file', uploadToMemory.single('file'), async (req, res) => {
  try {
    if (!r2Client) {
      return res.status(503).json({ error: 'R2 storage not configured' })
    }

    const file = req.file
    const fileIndex = parseInt(req.body.fileIndex)
    
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }
    
    if (isNaN(fileIndex) || fileIndex < 0) {
      return res.status(400).json({ error: 'Invalid file index' })
    }

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large. Maximum size is 50MB' })
    }

    const data = await readData()
    const docIndex = data.documents.findIndex(doc => doc.id === req.params.id)
    if (docIndex === -1) {
      return res.status(404).json({ error: 'Document not found' })
    }

    const document = data.documents[docIndex]
    
    // Get current file URLs
    let fileUrls = document.fileUrls || []
    if (fileUrls.length === 0 && document.fileUrl) {
      fileUrls = [document.fileUrl]
    }
    
    if (fileIndex >= fileUrls.length) {
      return res.status(400).json({ error: 'File index out of range' })
    }

    const oldFileUrl = fileUrls[fileIndex]
    
    // Get category name for folder structure
    let categoryName = 'documents'
    if (document.categories && document.categories.length > 0) {
      const cat = data.categories.find(c => c.id === document.categories[0])
      if (cat) {
        categoryName = cat.name
      }
    }

    // Upload new file to R2
    const result = await uploadToR2(
      file.buffer,
      file.originalname,
      file.mimetype,
      categoryName
    )

    // Delete old file from R2 (if it's an R2 URL)
    if (oldFileUrl) {
      await deleteFromR2(oldFileUrl)
    }

    // Update document with new file URL
    fileUrls[fileIndex] = result.url
    data.documents[docIndex].fileUrls = fileUrls
    
    // Update file size if this is the only file or add to total
    if (fileUrls.length === 1) {
      data.documents[docIndex].fileSize = result.size
    }
    
    await writeData(data)

    console.log(`File replaced for document ${req.params.id}: ${oldFileUrl} -> ${result.url}`)
    res.json({ 
      success: true,
      fileUrl: result.url,
      fileUrls: fileUrls,
      message: 'File replaced successfully'
    })
  } catch (error) {
    console.error('File replace error:', error)
    res.status(500).json({ error: 'Failed to replace file' })
  }
})

// Delete a specific file from a document (without replacement)
// DELETE /api/documents/:id/file/:fileIndex
app.delete('/api/documents/:id/file/:fileIndex', async (req, res) => {
  try {
    const fileIndex = parseInt(req.params.fileIndex)
    
    if (isNaN(fileIndex) || fileIndex < 0) {
      return res.status(400).json({ error: 'Invalid file index' })
    }

    const data = await readData()
    const docIndex = data.documents.findIndex(doc => doc.id === req.params.id)
    if (docIndex === -1) {
      return res.status(404).json({ error: 'Document not found' })
    }

    const document = data.documents[docIndex]
    
    // Get current file URLs
    let fileUrls = document.fileUrls || []
    if (fileUrls.length === 0 && document.fileUrl) {
      fileUrls = [document.fileUrl]
    }
    
    if (fileIndex >= fileUrls.length) {
      return res.status(400).json({ error: 'File index out of range' })
    }
    
    // Don't allow deleting the last file
    if (fileUrls.length <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last file. Use replace file or delete the document instead.' })
    }

    const oldFileUrl = fileUrls[fileIndex]
    
    // Delete file from R2
    if (oldFileUrl) {
      await deleteFromR2(oldFileUrl)
    }

    // Remove file from array
    fileUrls.splice(fileIndex, 1)
    data.documents[docIndex].fileUrls = fileUrls
    data.documents[docIndex].totalPages = fileUrls.length
    
    await writeData(data)

    console.log(`File deleted from document ${req.params.id}: ${oldFileUrl}`)
    res.json({ 
      success: true,
      fileUrls: fileUrls,
      message: 'File deleted successfully'
    })
  } catch (error) {
    console.error('File delete error:', error)
    res.status(500).json({ error: 'Failed to delete file' })
  }
})

// Add a new file to an existing document
// POST /api/documents/:id/add-file
app.post('/api/documents/:id/add-file', uploadToMemory.single('file'), async (req, res) => {
  try {
    if (!r2Client) {
      return res.status(503).json({ error: 'R2 storage not configured' })
    }

    const file = req.file
    
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large. Maximum size is 50MB' })
    }

    const data = await readData()
    const docIndex = data.documents.findIndex(doc => doc.id === req.params.id)
    if (docIndex === -1) {
      return res.status(404).json({ error: 'Document not found' })
    }

    const document = data.documents[docIndex]
    
    // Get current file URLs
    let fileUrls = document.fileUrls || []
    if (fileUrls.length === 0 && document.fileUrl) {
      fileUrls = [document.fileUrl]
    }

    // Get category name for folder structure
    let categoryName = 'documents'
    if (document.categories && document.categories.length > 0) {
      const cat = data.categories.find(c => c.id === document.categories[0])
      if (cat) {
        categoryName = cat.name
      }
    }

    // Upload new file to R2
    const result = await uploadToR2(
      file.buffer,
      file.originalname,
      file.mimetype,
      categoryName
    )

    // Add new file URL
    fileUrls.push(result.url)
    data.documents[docIndex].fileUrls = fileUrls
    data.documents[docIndex].totalPages = fileUrls.length
    
    // Update total file size
    data.documents[docIndex].fileSize = (data.documents[docIndex].fileSize || 0) + result.size
    
    await writeData(data)

    console.log(`File added to document ${req.params.id}: ${result.url}`)
    res.json({ 
      success: true,
      fileUrl: result.url,
      fileUrls: fileUrls,
      message: 'File added successfully'
    })
  } catch (error) {
    console.error('File add error:', error)
    res.status(500).json({ error: 'Failed to add file' })
  }
})

// Check R2 configuration status
app.get('/api/r2-status', (req, res) => {
  res.json({
    configured: !!r2Client,
    bucketName: R2_BUCKET_NAME ? '***configured***' : null,
    publicUrl: R2_PUBLIC_URL ? R2_PUBLIC_URL : null
  })
})

// Create new document with R2 URL (JSON body)
app.post('/api/documents', async (req, res) => {
  try {
    // Check if this is a JSON request (R2 URL based) or form-data (legacy upload)
    const contentType = req.headers['content-type'] || ''
    
    if (contentType.includes('application/json')) {
      // R2 URL-based document creation
      const { 
        name, 
        description, 
        fileUrl,      // Single URL (legacy)
        fileUrls,     // Multiple URLs (new)
        thumbnailUrl, 
        categories = [], 
        featured = false,
        releaseDate,
        deadline,
        sourceAgency,
        tags = [],
        relatedArticles = []  // Array of {title, url} for related guides/blog posts
      } = req.body

      // Support both single fileUrl and multiple fileUrls
      let urls = []
      if (fileUrls && Array.isArray(fileUrls) && fileUrls.length > 0) {
        urls = fileUrls.filter(url => url && url.trim())
      } else if (fileUrl) {
        urls = [fileUrl]
      }

      if (!name || urls.length === 0) {
        return res.status(400).json({ error: 'Name and at least one file URL are required' })
      }

      const data = await readData()
      const baseSlug = generateSlug(name)
      const slug = await ensureUniqueSlug(baseSlug, data)
      
      // Generate document ID
      const documentId = uuidv4()
      
      // Get file type from first URL for thumbnail detection
      // Use async version to properly detect file types from R2 URLs without extensions
      const firstFileType = await getFileTypeFromUrlAsync(urls[0])
      console.log(`Detected file type for ${urls[0]}: ${firstFileType}`)

      // Determine thumbnail URL - use provided thumbnail or fallback for images
      let finalThumbnailUrl = thumbnailUrl
      if (!finalThumbnailUrl && firstFileType === 'image') {
        // Use the first image as thumbnail
        finalThumbnailUrl = urls[0]
      }
      // If no thumbnail provided and it's a PDF, it will be null and frontend shows fallback icon

      const newDocument = {
        id: documentId,
        name,
        slug,
        description: description || '',
        tags: Array.isArray(tags) ? tags : [],
        fileUrls: urls,
        thumbnailUrl: finalThumbnailUrl,
        categories: Array.isArray(categories) ? categories : [],
        featured: Boolean(featured),
        createdAt: new Date().toISOString(),
        releaseDate: releaseDate || null,
        deadline: deadline || null,
        totalPages: urls.length,
        views: 0,
        downloads: 0,
        sourceAgency: sourceAgency || null,
        relatedArticles: Array.isArray(relatedArticles) ? relatedArticles.filter(a => a.title && a.url) : []
      }

      data.documents.push(newDocument)

      // Update category document counts
      newDocument.categories.forEach(catId => {
        const category = data.categories.find(c => c.id === catId)
        if (category) {
          category.documentCount++
        }
      })

      await writeData(data)
      res.status(201).json(newDocument)
    } else {
      // Legacy file upload - redirect to upload endpoint
      return res.status(400).json({ error: 'File uploads should use /api/documents/upload endpoint' })
    }
  } catch (error) {
    console.error('Create document error:', error)
    res.status(500).json({ error: 'Failed to create document' })
  }
})

// Legacy: Upload new document with files
app.post('/api/documents/upload', upload.array('files', 10), async (req, res) => {
  try {
    const files = req.files
    const categories = JSON.parse(req.body.categories || '[]')
    const featured = req.body.featured === 'true'
    const description = req.body.description || ''
    const tags = req.body.tags ? JSON.parse(req.body.tags) : []
    const releaseDate = req.body.releaseDate || null
    const deadline = req.body.deadline || null
    const sourceAgency = req.body.sourceAgency || null

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' })
    }

    const documentFiles = files.map(file => ({
      id: uuidv4(),
      filename: file.filename,
      originalName: file.originalname,
      path: file.path,
      type: getFileType(file.filename),
      mimeType: file.mimetype,
      size: file.size,
      pageCount: file.mimetype === 'application/pdf' ? null : 1 // PDF page count would need pdf-lib
    }))

    // Calculate total pages (simplified - PDFs would need actual page counting)
    const totalPages = documentFiles.reduce((sum, file) => {
      return sum + (file.pageCount || 1)
    }, 0)

    // Generate thumbnail from first image file found
    let thumbnail = null
    for (const file of documentFiles) {
      if (file.type === 'image') {
        thumbnail = await generateThumbnail(file.path, file.type)
        if (thumbnail) break
      }
    }

    // Generate unique slug
    const data = await readData()
    const documentName = req.body.name || files[0].originalname
    const baseSlug = generateSlug(documentName)
    const slug = await ensureUniqueSlug(baseSlug, data)

    const newDocument = {
      id: uuidv4(),
      name: documentName,
      slug,
      description,
      tags,
      files: documentFiles,
      categories,
      featured,
      createdAt: new Date().toISOString(),
      releaseDate,
      deadline,
      totalPages,
      thumbnail,
      views: 0,
      downloads: 0,
      sourceAgency
    }

    data.documents.push(newDocument)
    
    // Update category document counts
    categories.forEach(catId => {
      const category = data.categories.find(c => c.id === catId)
      if (category) {
        category.documentCount++
      }
    })
    
    await writeData(data)
    res.status(201).json(newDocument)
  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({ error: 'Failed to upload document' })
  }
})

// Update document
app.patch('/api/documents/:id', async (req, res) => {
  try {
    const data = await readData()
    const docIndex = data.documents.findIndex(doc => doc.id === req.params.id)
    
    if (docIndex === -1) {
      return res.status(404).json({ error: 'Document not found' })
    }

    const oldDoc = data.documents[docIndex]
    const updatedDoc = { ...oldDoc, ...req.body }
    data.documents[docIndex] = updatedDoc

    // Update category counts if categories changed
    if (req.body.categories) {
      const oldCategories = oldDoc.categories || []
      const newCategories = req.body.categories

      oldCategories.forEach(catId => {
        if (!newCategories.includes(catId)) {
          const category = data.categories.find(c => c.id === catId)
          if (category) category.documentCount--
        }
      })

      newCategories.forEach(catId => {
        if (!oldCategories.includes(catId)) {
          const category = data.categories.find(c => c.id === catId)
          if (category) category.documentCount++
        }
      })
    }

    await writeData(data)
    res.json(updatedDoc)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update document' })
  }
})

// Upload thumbnail for a document
app.post('/api/documents/:id/thumbnail', upload.single('thumbnail'), async (req, res) => {
  try {
    const data = await readData()
    const docIndex = data.documents.findIndex(doc => doc.id === req.params.id)
    
    if (docIndex === -1) {
      return res.status(404).json({ error: 'Document not found' })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No thumbnail file uploaded' })
    }

    const fileType = getFileType(req.file.filename)
    if (fileType !== 'image') {
      await fs.unlink(req.file.path)
      return res.status(400).json({ error: 'Thumbnail must be an image file' })
    }

    // Generate thumbnail from uploaded image
    const thumbnail = await generateThumbnail(req.file.path, 'image')
    
    // Delete the original uploaded file since we created a resized thumbnail
    try {
      await fs.unlink(req.file.path)
    } catch (err) {
      console.error('Failed to delete original thumbnail upload:', err)
    }

    // Delete old thumbnail if exists
    const oldDoc = data.documents[docIndex]
    if (oldDoc.thumbnail) {
      try {
        await fs.unlink(path.join(uploadsDir, oldDoc.thumbnail))
      } catch (err) {
        console.error('Failed to delete old thumbnail:', err)
      }
    }

    // Update document with new thumbnail
    data.documents[docIndex].thumbnail = thumbnail
    await writeData(data)
    
    res.json({ thumbnail, message: 'Thumbnail updated successfully' })
  } catch (error) {
    console.error('Thumbnail upload error:', error)
    res.status(500).json({ error: 'Failed to upload thumbnail' })
  }
})

// Track document view
app.post('/api/documents/:id/view', async (req, res) => {
  try {
    const data = await readData()
    const identifier = req.params.id
    const docIndex = data.documents.findIndex(doc => doc.id === identifier || doc.slug === identifier)
    
    if (docIndex === -1) {
      return res.status(404).json({ error: 'Document not found' })
    }

    // Increment view count
    data.documents[docIndex].views = (data.documents[docIndex].views || 0) + 1
    await writeData(data)
    
    res.json({ views: data.documents[docIndex].views })
  } catch (error) {
    res.status(500).json({ error: 'Failed to track view' })
  }
})

// Track document download
app.post('/api/documents/:id/download', async (req, res) => {
  try {
    const data = await readData()
    const identifier = req.params.id
    const docIndex = data.documents.findIndex(doc => doc.id === identifier || doc.slug === identifier)
    
    if (docIndex === -1) {
      return res.status(404).json({ error: 'Document not found' })
    }

    // Increment download count
    data.documents[docIndex].downloads = (data.documents[docIndex].downloads || 0) + 1
    await writeData(data)
    
    res.json({ downloads: data.documents[docIndex].downloads })
  } catch (error) {
    res.status(500).json({ error: 'Failed to track download' })
  }
})

// Get popular documents (top 10 by views)
app.get('/api/documents/stats/popular', async (req, res) => {
  try {
    const data = await readData()
    const limit = parseInt(req.query.limit) || 10
    
    const popularDocs = [...data.documents]
      .sort((a, b) => ((b.views || 0) + (b.downloads || 0)) - ((a.views || 0) + (a.downloads || 0)))
      .slice(0, limit)
      .map(formatDocumentForResponse)
    
    res.json(popularDocs)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch popular documents' })
  }
})

// Get recent documents
app.get('/api/documents/stats/recent', async (req, res) => {
  try {
    const data = await readData()
    const limit = parseInt(req.query.limit) || 5
    
    const recentDocs = [...data.documents]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
      .map(formatDocumentForResponse)
    
    res.json(recentDocs)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recent documents' })
  }
})

// Delete document
app.delete('/api/documents/:id', async (req, res) => {
  try {
    const data = await readData()
    const docIndex = data.documents.findIndex(doc => doc.id === req.params.id)
    
    if (docIndex === -1) {
      return res.status(404).json({ error: 'Document not found' })
    }

    const document = data.documents[docIndex]

    // Delete R2 files
    if (document.fileUrls && Array.isArray(document.fileUrls)) {
      for (const fileUrl of document.fileUrls) {
        try {
          await deleteFromR2(fileUrl)
        } catch (err) {
          console.error('Failed to delete R2 file:', fileUrl, err)
        }
      }
    }
    
    // Delete single R2 file URL (legacy format)
    if (document.fileUrl) {
      try {
        await deleteFromR2(document.fileUrl)
      } catch (err) {
        console.error('Failed to delete R2 file:', document.fileUrl, err)
      }
    }
    
    // Delete R2 thumbnail
    if (document.thumbnailUrl) {
      try {
        await deleteFromR2(document.thumbnailUrl)
      } catch (err) {
        console.error('Failed to delete R2 thumbnail:', document.thumbnailUrl, err)
      }
    }

    // Delete physical files (only for legacy local file uploads)
    if (document.files && Array.isArray(document.files)) {
      for (const file of document.files) {
        try {
          await fs.unlink(file.path)
        } catch (err) {
          console.error('Failed to delete local file:', file.path, err)
        }
      }
    }
    
    // Delete local thumbnail (legacy)
    if (document.thumbnail && !document.thumbnail.startsWith('http')) {
      try {
        await fs.unlink(path.join(uploadsDir, document.thumbnail))
      } catch (err) {
        console.error('Failed to delete local thumbnail:', document.thumbnail, err)
      }
    }

    // Update category counts
    document.categories.forEach(catId => {
      const category = data.categories.find(c => c.id === catId)
      if (category) category.documentCount--
    })

    data.documents.splice(docIndex, 1)
    await writeData(data)
    
    console.log(`Document deleted: ${document.name} (${document.id})`)
    res.json({ success: true })
  } catch (error) {
    console.error('Delete document error:', error)
    res.status(500).json({ error: 'Failed to delete document' })
  }
})

// Get all categories
app.get('/api/categories', async (req, res) => {
  try {
    const data = await readData()
    res.json(data.categories)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' })
  }
})

// Create category
app.post('/api/categories', async (req, res) => {
  try {
    const { name, description } = req.body
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' })
    }

    const newCategory = {
      id: uuidv4(),
      name,
      description: description || '',
      documentCount: 0
    }

    const data = await readData()
    data.categories.push(newCategory)
    await writeData(data)
    res.status(201).json(newCategory)
  } catch (error) {
    res.status(500).json({ error: 'Failed to create category' })
  }
})

// Update category
app.patch('/api/categories/:id', async (req, res) => {
  try {
    const data = await readData()
    const catIndex = data.categories.findIndex(cat => cat.id === req.params.id)
    
    if (catIndex === -1) {
      return res.status(404).json({ error: 'Category not found' })
    }

    const updatedCategory = { ...data.categories[catIndex], ...req.body }
    data.categories[catIndex] = updatedCategory
    await writeData(data)
    res.json(updatedCategory)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update category' })
  }
})

// Delete category
app.delete('/api/categories/:id', async (req, res) => {
  try {
    const data = await readData()
    const catIndex = data.categories.findIndex(cat => cat.id === req.params.id)
    
    if (catIndex === -1) {
      return res.status(404).json({ error: 'Category not found' })
    }

    // Remove category from all documents
    data.documents.forEach(doc => {
      doc.categories = doc.categories.filter(catId => catId !== req.params.id)
    })

    data.categories.splice(catIndex, 1)
    await writeData(data)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete category' })
  }
})

// ========================================
// Agency Endpoints
// ========================================

// Get all agencies
app.get('/api/agencies', async (req, res) => {
  try {
    const data = await readData()
    // Ensure agencies array exists
    const agencies = data.agencies || []
    
    // Calculate document counts for each agency
    const agenciesWithCounts = agencies.map(agency => {
      const docCount = data.documents.filter(doc => doc.agencyId === agency.id).length
      return { ...agency, documentCount: docCount }
    })
    
    res.json(agenciesWithCounts)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch agencies' })
  }
})

// Get agency by slug with documents
app.get('/api/agencies/:slug', async (req, res) => {
  try {
    const data = await readData()
    const agencies = data.agencies || []
    const agency = agencies.find(a => a.slug === req.params.slug || a.id === req.params.slug)
    
    if (!agency) {
      return res.status(404).json({ error: 'Agency not found' })
    }
    
    // Get query params for filtering
    const { category, year, sort = 'newest' } = req.query
    
    // Get documents for this agency
    let documents = data.documents.filter(doc => doc.agencyId === agency.id)
    
    // Filter by category if provided
    if (category) {
      documents = documents.filter(doc => 
        doc.categories.some(catId => {
          const cat = data.categories.find(c => c.id === catId)
          return cat && (cat.id === category || cat.name.toLowerCase() === category.toLowerCase())
        })
      )
    }
    
    // Filter by year if provided
    if (year) {
      documents = documents.filter(doc => {
        const docYear = new Date(doc.createdAt).getFullYear().toString()
        return docYear === year
      })
    }
    
    // Sort documents
    if (sort === 'newest') {
      documents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    } else if (sort === 'oldest') {
      documents.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    } else if (sort === 'downloads') {
      documents.sort((a, b) => (b.downloads || 0) - (a.downloads || 0))
    } else if (sort === 'views') {
      documents.sort((a, b) => (b.views || 0) - (a.views || 0))
    }
    
    // Format documents for response
    const formattedDocs = documents.map(doc => formatDocumentForResponse(doc))
    
    // Get available categories for filter
    const availableCategories = [...new Set(
      data.documents
        .filter(doc => doc.agencyId === agency.id)
        .flatMap(doc => doc.categories)
    )].map(catId => data.categories.find(c => c.id === catId)).filter(Boolean)
    
    // Get available years for filter
    const availableYears = [...new Set(
      data.documents
        .filter(doc => doc.agencyId === agency.id)
        .map(doc => new Date(doc.createdAt).getFullYear())
    )].sort((a, b) => b - a)
    
    res.json({
      agency: {
        ...agency,
        documentCount: data.documents.filter(doc => doc.agencyId === agency.id).length
      },
      documents: formattedDocs,
      filters: {
        categories: availableCategories,
        years: availableYears
      }
    })
  } catch (error) {
    console.error('Error fetching agency:', error)
    res.status(500).json({ error: 'Failed to fetch agency' })
  }
})

// Create agency (admin only)
app.post('/api/agencies', async (req, res) => {
  try {
    const { name, shortName, description } = req.body
    
    if (!name || !shortName) {
      return res.status(400).json({ error: 'Name and short name are required' })
    }

    // Generate slug from short name
    const slug = shortName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
    
    const data = await readData()
    if (!data.agencies) data.agencies = []
    
    // Check for duplicate slug
    if (data.agencies.some(a => a.slug === slug)) {
      return res.status(400).json({ error: 'Agency with this short name already exists' })
    }

    const newAgency = {
      id: `agency-${slug}`,
      name,
      slug,
      shortName,
      description: description || '',
      documentCount: 0
    }

    data.agencies.push(newAgency)
    await writeData(data)
    res.status(201).json(newAgency)
  } catch (error) {
    res.status(500).json({ error: 'Failed to create agency' })
  }
})

// Update agency
app.patch('/api/agencies/:id', async (req, res) => {
  try {
    const data = await readData()
    if (!data.agencies) data.agencies = []
    
    const agencyIndex = data.agencies.findIndex(a => a.id === req.params.id)
    
    if (agencyIndex === -1) {
      return res.status(404).json({ error: 'Agency not found' })
    }

    const updatedAgency = { ...data.agencies[agencyIndex], ...req.body }
    data.agencies[agencyIndex] = updatedAgency
    await writeData(data)
    res.json(updatedAgency)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update agency' })
  }
})

// Delete agency
app.delete('/api/agencies/:id', async (req, res) => {
  try {
    const data = await readData()
    if (!data.agencies) data.agencies = []
    
    const agencyIndex = data.agencies.findIndex(a => a.id === req.params.id)
    
    if (agencyIndex === -1) {
      return res.status(404).json({ error: 'Agency not found' })
    }

    // Remove agency from all documents
    data.documents.forEach(doc => {
      if (doc.agencyId === req.params.id) {
        doc.agencyId = null
      }
    })

    data.agencies.splice(agencyIndex, 1)
    await writeData(data)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete agency' })
  }
})

// ========================================
// Search Endpoint with Agency Filter
// ========================================
app.get('/api/search', async (req, res) => {
  try {
    const { q, agency, category, year, sort = 'relevance', limit = 50 } = req.query
    const data = await readData()
    
    let results = [...data.documents]
    
    // Filter by agency if provided
    if (agency) {
      const agencyData = (data.agencies || []).find(a => a.slug === agency || a.id === agency)
      if (agencyData) {
        results = results.filter(doc => doc.agencyId === agencyData.id)
      }
    }
    
    // Filter by category if provided
    if (category) {
      results = results.filter(doc => 
        doc.categories.some(catId => {
          const cat = data.categories.find(c => c.id === catId)
          return cat && (cat.id === category || cat.slug === category || cat.name.toLowerCase() === category.toLowerCase())
        })
      )
    }
    
    // Filter by year if provided
    if (year) {
      results = results.filter(doc => {
        const docYear = new Date(doc.createdAt).getFullYear().toString()
        return docYear === year
      })
    }
    
    // Search by keyword if provided
    if (q && q.trim()) {
      const searchTerms = q.toLowerCase().trim().split(/\s+/)
      results = results.filter(doc => {
        const searchText = `${doc.name} ${doc.description || ''} ${(doc.tags || []).join(' ')}`.toLowerCase()
        return searchTerms.every(term => searchText.includes(term))
      })
      
      // Score by relevance for keyword search
      results = results.map(doc => {
        let score = 0
        const nameLower = doc.name.toLowerCase()
        const searchLower = q.toLowerCase()
        
        // Exact match in name
        if (nameLower.includes(searchLower)) score += 10
        // Word match in name
        searchTerms.forEach(term => {
          if (nameLower.includes(term)) score += 3
        })
        // Tag match
        (doc.tags || []).forEach(tag => {
          if (tag.toLowerCase().includes(searchLower)) score += 2
        })
        // Featured bonus
        if (doc.featured) score += 1
        
        return { ...doc, _score: score }
      })
      
      // Sort by relevance score if using keyword search
      if (sort === 'relevance') {
        results.sort((a, b) => b._score - a._score)
      }
    }
    
    // Apply sorting
    if (sort === 'newest') {
      results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    } else if (sort === 'oldest') {
      results.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    } else if (sort === 'downloads') {
      results.sort((a, b) => (b.downloads || 0) - (a.downloads || 0))
    } else if (sort === 'views') {
      results.sort((a, b) => (b.views || 0) - (a.views || 0))
    }
    
    // Limit results
    results = results.slice(0, parseInt(limit))
    
    // Remove internal score and format response
    const formattedResults = results.map(doc => {
      const { _score, ...rest } = doc
      return formatDocumentForResponse(rest)
    })
    
    res.json({
      query: q || '',
      filters: { agency, category, year },
      total: formattedResults.length,
      results: formattedResults
    })
  } catch (error) {
    console.error('Search error:', error)
    res.status(500).json({ error: 'Search failed' })
  }
})

// SEO: Generate XML sitemap
app.get('/sitemap.xml', async (req, res) => {
  try {
    const data = await readData()
    const baseUrl = process.env.BASE_URL || 'http://localhost:5173'
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    
    // Homepage
    xml += '  <url>\n'
    xml += `    <loc>${baseUrl}/</loc>\n`
    xml += '    <changefreq>daily</changefreq>\n'
    xml += '    <priority>1.0</priority>\n'
    xml += '  </url>\n'
    
    // Agency pages
    const agencies = data.agencies || []
    agencies.forEach(agency => {
      xml += '  <url>\n'
      xml += `    <loc>${baseUrl}/agency/${agency.slug}</loc>\n`
      xml += '    <changefreq>weekly</changefreq>\n'
      xml += '    <priority>0.9</priority>\n'
      xml += '  </url>\n'
    })
    
    // Document pages
    data.documents.forEach(doc => {
      xml += '  <url>\n'
      xml += `    <loc>${baseUrl}/d/${doc.slug}</loc>\n`
      xml += `    <lastmod>${doc.createdAt.split('T')[0]}</lastmod>\n`
      xml += '    <changefreq>monthly</changefreq>\n'
      xml += '    <priority>0.8</priority>\n'
      xml += '  </url>\n'
    })
    
    xml += '</urlset>'
    
    res.header('Content-Type', 'application/xml')
    res.send(xml)
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate sitemap' })
  }
})

// SEO: Generate robots.txt
app.get('/robots.txt', (req, res) => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:5173'
  const robotsTxt = `User-agent: *
Allow: /
Sitemap: ${baseUrl}/sitemap.xml
`
  res.header('Content-Type', 'text/plain')
  res.send(robotsTxt)
})

// Download combined document
app.get('/api/documents/:id/download', async (req, res) => {
  try {
    const data = await readData()
    const document = data.documents.find(doc => doc.id === req.params.id)
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }

    if (document.files.length === 1) {
      // Single file - direct download
      res.download(document.files[0].path, document.files[0].originalName)
    } else {
      // Multiple files - would need archiver for zip
      // For now, just send the first file
      res.download(document.files[0].path, `${document.name}.${path.extname(document.files[0].originalName)}`)
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to download document' })
  }
})

// Storage status endpoint - helps detect if persistent storage is configured
app.get('/api/storage-status', (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production'
  const hasStoragePath = !!process.env.STORAGE_PATH
  
  // In production, if STORAGE_PATH is not set, we're using ephemeral storage
  // which means data will be lost when the container restarts
  const isPersistent = !isProduction || hasStoragePath
  
  res.json({
    persistent: isPersistent,
    storagePath: hasStoragePath ? 'configured' : 'default',
    environment: isProduction ? 'production' : 'development',
    warning: !isPersistent ? 
      'Data is stored in ephemeral storage and will be lost when the server restarts. Configure STORAGE_PATH with a persistent volume to prevent data loss.' : 
      null
  })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  
  // Final warning about ephemeral storage in production
  if (process.env.NODE_ENV === 'production' && !process.env.STORAGE_PATH) {
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('⚠️  CRITICAL WARNING: EPHEMERAL STORAGE DETECTED')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')
    console.log('Your data is NOT persistent!')
    console.log('All uploads and documents will be DELETED when:')
    console.log('  • The server restarts')
    console.log('  • You deploy a new version')
    console.log('  • The container is replaced')
    console.log('')
    console.log('To fix this issue:')
    console.log('1. Configure persistent storage for your deployment platform')
    console.log('2. Set the STORAGE_PATH environment variable')
    console.log('')
    console.log('Documentation:')
    console.log('https://github.com/janaya-ai/filesph/blob/main/DEPLOYMENT.md#persistent-storage-configuration')
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')
  }
})
