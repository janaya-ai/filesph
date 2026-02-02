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
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createCanvas } from 'canvas'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import sharp from 'sharp'

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
// R2 Configuration for Thumbnail Storage
// ========================================
// Set these environment variables for R2 uploads:
// R2_ACCOUNT_ID - Your Cloudflare account ID
// R2_ACCESS_KEY_ID - R2 API token access key
// R2_SECRET_ACCESS_KEY - R2 API token secret key
// R2_BUCKET_NAME - Your R2 bucket name
// R2_PUBLIC_URL - Public URL for your R2 bucket (e.g., https://pub-xxx.r2.dev)

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
  console.log('R2 client initialized for thumbnail uploads')
} else {
  console.log('R2 credentials not configured - thumbnail generation disabled')
}

// ========================================
// PDF Thumbnail Generation
// ========================================

/**
 * Generate a thumbnail from the first page of a PDF
 * @param {string} pdfUrl - URL of the PDF file
 * @returns {Promise<Buffer|null>} - PNG image buffer or null on error
 */
async function generatePdfThumbnail(pdfUrl) {
  try {
    console.log(`Generating thumbnail for PDF: ${pdfUrl}`)
    
    // Fetch the PDF
    const response = await fetch(pdfUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status}`)
    }
    
    const pdfBuffer = await response.arrayBuffer()
    const pdfData = new Uint8Array(pdfBuffer)
    
    // Load the PDF with pdf.js
    // Configure standardFontDataUrl to use the fonts included with pdfjs-dist
    // Use import.meta.resolve for robust path resolution across different environments
    const pdfjsDistPath = path.dirname(fileURLToPath(import.meta.resolve('pdfjs-dist/package.json')))
    // PDF.js requires a trailing separator for the standardFontDataUrl
    const standardFontDataUrl = path.join(pdfjsDistPath, 'standard_fonts') + path.sep
    const loadingTask = pdfjsLib.getDocument({ 
      data: pdfData,
      standardFontDataUrl: standardFontDataUrl,
      useSystemFonts: false
    })
    const pdfDoc = await loadingTask.promise
    
    // Get the first page
    const page = await pdfDoc.getPage(1)
    
    // Set up the canvas with good quality (scale 2x for retina)
    const scale = 2
    const viewport = page.getViewport({ scale })
    
    // Create canvas
    const canvas = createCanvas(viewport.width, viewport.height)
    const context = canvas.getContext('2d')
    
    // Render the page to canvas
    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise
    
    // Convert canvas to PNG buffer
    const pngBuffer = canvas.toBuffer('image/png')
    
    // Resize to thumbnail size using sharp (400x600 max, maintaining aspect ratio)
    const thumbnailBuffer = await sharp(pngBuffer)
      .resize(400, 600, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer()
    
    console.log(`Thumbnail generated: ${thumbnailBuffer.length} bytes`)
    return thumbnailBuffer
  } catch (error) {
    console.error('Error generating PDF thumbnail:', error)
    return null
  }
}

/**
 * Upload a thumbnail to R2
 * @param {Buffer} imageBuffer - Image data to upload
 * @param {string} filename - Filename for the thumbnail
 * @returns {Promise<string|null>} - Public URL of uploaded thumbnail or null on error
 */
async function uploadThumbnailToR2(imageBuffer, filename) {
  if (!r2Client || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
    console.log('R2 not configured, skipping thumbnail upload')
    return null
  }
  
  try {
    const key = `thumbnails/${filename}`
    
    await r2Client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: imageBuffer,
      ContentType: 'image/jpeg',
    }))
    
    const publicUrl = `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`
    console.log(`Thumbnail uploaded to R2: ${publicUrl}`)
    return publicUrl
  } catch (error) {
    console.error('Error uploading thumbnail to R2:', error)
    return null
  }
}

/**
 * Generate and upload thumbnail for a PDF document
 * @param {string} pdfUrl - URL of the PDF
 * @param {string} documentId - Document ID (used for filename)
 * @returns {Promise<string|null>} - Thumbnail URL or null on error
 */
async function createPdfThumbnail(pdfUrl, documentId) {
  // Generate thumbnail from PDF
  const thumbnailBuffer = await generatePdfThumbnail(pdfUrl)
  if (!thumbnailBuffer) {
    return null
  }
  
  // Upload to R2
  const filename = `${documentId}_thumb.jpg`
  const thumbnailUrl = await uploadThumbnailToR2(thumbnailBuffer, filename)
  
  return thumbnailUrl
}

// CORS configuration
// FALLBACK_ORIGIN uses HTTP for local development (localhost doesn't use HTTPS)
// Production environments will always use HTTPS via FRONTEND_URL env variable
const FALLBACK_ORIGIN = 'http://localhost:5173'
const allowedOrigins = []

if (process.env.FRONTEND_URL) {
  try {
    // Validate FRONTEND_URL is a valid URL
    new URL(process.env.FRONTEND_URL)
    allowedOrigins.push(process.env.FRONTEND_URL)
    console.log('CORS configured for origin:', process.env.FRONTEND_URL)
  } catch (error) {
    // In production, invalid FRONTEND_URL is a fatal error
    if (process.env.NODE_ENV === 'production') {
      console.error(`FATAL ERROR: Invalid FRONTEND_URL environment variable: ${process.env.FRONTEND_URL}`)
      console.error('Application cannot start with invalid FRONTEND_URL in production.')
      process.exit(1)
    }
    
    // In development, fall back to localhost
    console.warn(`Invalid FRONTEND_URL environment variable: ${process.env.FRONTEND_URL}. Falling back to ${FALLBACK_ORIGIN}`)
    allowedOrigins.push(FALLBACK_ORIGIN)
  }
} else {
  // In production, missing FRONTEND_URL is a fatal error
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL ERROR: FRONTEND_URL environment variable is not set.')
    console.error('Application cannot start without FRONTEND_URL in production.')
    process.exit(1)
  }
  
  // In development, use localhost
  console.log('Using default CORS origin for development:', FALLBACK_ORIGIN)
  allowedOrigins.push(FALLBACK_ORIGIN)
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
  await fs.writeFile(dataFile, JSON.stringify({ documents: [], categories: [] }, null, 2))
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
  
  return nameWithoutExt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim()
    .substring(0, 100) // Limit length
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
        .quality(80)
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
    const response = await fetch(url, { method: 'HEAD' })
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
      
      // Generate document ID first (needed for thumbnail filename)
      const documentId = uuidv4()
      
      // Get file type from first URL for thumbnail detection
      // Use async version to properly detect file types from R2 URLs without extensions
      const firstFileType = await getFileTypeFromUrlAsync(urls[0])
      console.log(`Detected file type for ${urls[0]}: ${firstFileType}`)

      // Determine thumbnail URL
      let finalThumbnailUrl = thumbnailUrl
      if (!finalThumbnailUrl) {
        if (firstFileType === 'pdf') {
          // Auto-generate thumbnail from first page of PDF
          console.log('Attempting to generate PDF thumbnail...')
          const generatedThumb = await createPdfThumbnail(urls[0], documentId)
          if (generatedThumb) {
            finalThumbnailUrl = generatedThumb
            console.log('PDF thumbnail generated successfully:', finalThumbnailUrl)
          } else {
            // Fall back to null if generation fails - frontend will show fallback icon
            finalThumbnailUrl = null
            console.log('PDF thumbnail generation failed, thumbnailUrl will be null')
          }
        } else if (firstFileType === 'image') {
          // Use the first image as thumbnail
          finalThumbnailUrl = urls[0]
        } else {
          // For other file types, set to null - frontend will show fallback icon
          finalThumbnailUrl = null
        }
      }

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

// Regenerate PDF thumbnail from first page
// Use this when PDF is updated or to regenerate existing document thumbnails
app.post('/api/documents/:id/regenerate-thumbnail', async (req, res) => {
  try {
    const data = await readData()
    const docIndex = data.documents.findIndex(doc => doc.id === req.params.id || doc.slug === req.params.id)
    
    if (docIndex === -1) {
      return res.status(404).json({ error: 'Document not found' })
    }

    const document = data.documents[docIndex]
    
    // Get PDF URL from document - use async version to check Content-Type for R2 URLs
    let pdfUrl = null
    if (document.fileUrls && document.fileUrls.length > 0) {
      // Find first PDF in fileUrls - check each URL with async function
      for (const url of document.fileUrls) {
        const fileType = await getFileTypeFromUrlAsync(url)
        if (fileType === 'pdf') {
          pdfUrl = url
          break
        }
      }
    } else if (document.fileUrl) {
      const fileType = await getFileTypeFromUrlAsync(document.fileUrl)
      if (fileType === 'pdf') {
        pdfUrl = document.fileUrl
      }
    }
    
    if (!pdfUrl) {
      return res.status(400).json({ error: 'No PDF file found in document' })
    }

    // Check if R2 is configured
    if (!r2Client) {
      return res.status(503).json({ error: 'R2 storage not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL environment variables.' })
    }

    // Generate and upload thumbnail
    console.log(`Regenerating thumbnail for document ${document.id}...`)
    const thumbnailUrl = await createPdfThumbnail(pdfUrl, document.id)
    
    if (!thumbnailUrl) {
      return res.status(500).json({ error: 'Failed to generate thumbnail from PDF' })
    }

    // Update document with new thumbnail
    data.documents[docIndex].thumbnailUrl = thumbnailUrl
    await writeData(data)
    
    console.log(`Thumbnail regenerated successfully: ${thumbnailUrl}`)
    res.json({ 
      thumbnailUrl, 
      message: 'Thumbnail regenerated successfully' 
    })
  } catch (error) {
    console.error('Thumbnail regeneration error:', error)
    res.status(500).json({ error: 'Failed to regenerate thumbnail' })
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

    // Delete physical files (only for legacy file uploads)
    if (document.files && Array.isArray(document.files)) {
      for (const file of document.files) {
        try {
          await fs.unlink(file.path)
        } catch (err) {
          console.error('Failed to delete file:', file.path, err)
        }
      }
    }

    // Update category counts
    document.categories.forEach(catId => {
      const category = data.categories.find(c => c.id === catId)
      if (category) category.documentCount--
    })

    data.documents.splice(docIndex, 1)
    await writeData(data)
    res.json({ success: true })
  } catch (error) {
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
