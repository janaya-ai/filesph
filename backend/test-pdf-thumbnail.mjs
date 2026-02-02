import { createCanvas } from 'canvas'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import sharp from 'sharp'
import fetch from 'node-fetch'

// Test URL - a simple PDF
const TEST_PDF_URL = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'

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
    
    console.log('PDF fetched, size:', pdfData.length, 'bytes')
    
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
const result = await generatePdfThumbnail(TEST_PDF_URL)
if (result) {
  console.log('✓ Success! Thumbnail generated')
  // Save to file for verification
  import('fs').then(fs => {
    fs.promises.writeFile('/tmp/test-thumb.jpg', result)
      .then(() => console.log('✓ Thumbnail saved to /tmp/test-thumb.jpg'))
      .catch(err => console.error('Error saving file:', err))
  })
} else {
  console.log('✗ Failed to generate thumbnail')
}
