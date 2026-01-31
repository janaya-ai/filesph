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

// Admin credentials (in production, use environment variables and proper hashing)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

// CORS configuration
const FALLBACK_ORIGIN = 'http://localhost:5173'
const allowedOrigins = []

if (process.env.FRONTEND_URL) {
  try {
    // Validate FRONTEND_URL is a valid URL
    new URL(process.env.FRONTEND_URL)
    allowedOrigins.push(process.env.FRONTEND_URL)
    console.log('CORS configured for origin:', process.env.FRONTEND_URL)
  } catch (error) {
    console.warn(`Invalid FRONTEND_URL environment variable: ${process.env.FRONTEND_URL}. Falling back to ${FALLBACK_ORIGIN}`)
    
    // In production, this is a critical error
    if (process.env.NODE_ENV === 'production') {
      console.error('ERROR: Invalid FRONTEND_URL in production environment. CORS will not work correctly.')
    }
    
    allowedOrigins.push(FALLBACK_ORIGIN)
  }
} else {
  // Default to localhost for development
  if (process.env.NODE_ENV === 'production') {
    console.warn('WARNING: FRONTEND_URL not set in production environment. Using default:', FALLBACK_ORIGIN)
  }
  allowedOrigins.push(FALLBACK_ORIGIN)
}

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

app.use('/api/files', express.static(path.join(__dirname, 'uploads')))

// Ensure directories exist
const uploadsDir = path.join(__dirname, 'uploads')
const dataFile = path.join(__dirname, 'data.json')

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
    const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.txt']
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
  if (ext === '.txt') return 'text'
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

    // Generate thumbnail from first file
    const firstFile = documentFiles[0]
    const thumbnail = await generateThumbnail(firstFile.path, firstFile.type)

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
      totalPages,
      thumbnail
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
