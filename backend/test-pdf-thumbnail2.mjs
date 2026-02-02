import { createCanvas } from 'canvas'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import sharp from 'sharp'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import fs from 'fs/promises'

// Create a simple PDF for testing
async function createTestPdf() {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([600, 800])
  const { width, height } = page.getSize()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  
  page.drawText('Test PDF Document', {
    x: 50,
    y: height - 100,
    size: 30,
    font: font,
    color: rgb(0, 0, 0),
  })
  
  page.drawText('This is a test PDF for thumbnail generation', {
    x: 50,
    y: height - 150,
    size: 16,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  })
  
  const pdfBytes = await pdfDoc.save()
  await fs.writeFile('/tmp/test.pdf', pdfBytes)
  console.log('✓ Test PDF created at /tmp/test.pdf')
  return pdfBytes
}

async function generatePdfThumbnail(pdfData) {
  try {
    console.log(`Generating thumbnail for PDF...`)
    
    console.log('PDF size:', pdfData.length, 'bytes')
    
    // Load the PDF with pdf.js
    console.log('Loading PDF with pdf.js...')
    const loadingTask = pdfjsLib.getDocument({ data: pdfData })
    const pdfDoc = await loadingTask.promise
    
    console.log('PDF loaded, pages:', pdfDoc.numPages)
    
    // Get the first page
    const page = await pdfDoc.getPage(1)
    console.log('Got first page')
    
    // Set up the canvas with good quality (scale 2x for retina)
    const scale = 2
    const viewport = page.getViewport({ scale })
    
    console.log('Viewport dimensions:', viewport.width, 'x', viewport.height)
    
    // Create canvas
    const canvas = createCanvas(viewport.width, viewport.height)
    const context = canvas.getContext('2d')
    
    console.log('Canvas created, rendering page...')
    
    // Render the page to canvas
    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise
    
    console.log('Page rendered to canvas')
    
    // Convert canvas to PNG buffer
    const pngBuffer = canvas.toBuffer('image/png')
    
    console.log('PNG buffer created, size:', pngBuffer.length, 'bytes')
    
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
    console.error('Stack:', error.stack)
    return null
  }
}

// Run test
console.log('Testing PDF thumbnail generation...')
console.log('Step 1: Creating test PDF...')
const pdfBytes = await createTestPdf()

console.log('\nStep 2: Generating thumbnail from PDF...')
const result = await generatePdfThumbnail(pdfBytes)
if (result) {
  console.log('✓ Success! Thumbnail generated')
  // Save to file for verification
  await fs.writeFile('/tmp/test-thumb.jpg', result)
  console.log('✓ Thumbnail saved to /tmp/test-thumb.jpg')
} else {
  console.log('✗ Failed to generate thumbnail')
  process.exit(1)
}
