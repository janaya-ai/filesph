import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import Jimp from 'jimp'
import { PDFDocument } from 'pdf-lib'

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

// Ensure directories exist
const uploadsDir = path.join(storagePath, 'uploads')
const dataFile = path.join(storagePath, 'data.json')

// Log storage configuration (only in development for security)
if (process.env.NODE_ENV !== 'production') {
  console.log(`Storage path configured: ${storagePath}`)
  console.log(`Uploads directory: ${uploadsDir}`)
  console.log(`Data file: ${dataFile}`)
} else {
  console.log('Storage path configured from STORAGE_PATH environment variable')
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
  return {
    ...doc,
    files: doc.files.map(file => ({
      ...file,
      path: file.filename // Use filename instead of absolute path for API
    })),
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

// Upload new document
app.post('/api/documents', upload.array('files', 10), async (req, res) => {
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

    // Delete physical files
    for (const file of document.files) {
      try {
        await fs.unlink(file.path)
      } catch (err) {
        console.error('Failed to delete file:', file.path, err)
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
})
