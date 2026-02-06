import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import type { ViewerState } from '../types'
import { API_BASE_URL } from '../utils/api'

// Configure PDF.js worker - use CDN for simplicity
// In production, consider bundling the worker with your app
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

// API base URL for proxy
const API_BASE = API_BASE_URL || window.location.origin

interface PDFRendererProps {
  fileUrl: string
  viewerState: ViewerState
  onPageChange?: (page: number) => void
}

export default function PDFRenderer({ fileUrl, viewerState, onPageChange }: PDFRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [pages, setPages] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([])

  useEffect(() => {
    loadPDF()
  }, [fileUrl])

  useEffect(() => {
    if (pdf) {
      renderAllPages()
    }
  }, [pdf, viewerState.zoom, viewerState.fitMode])

  const loadPDF = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // For external URLs (R2, CDN), use our proxy to avoid CORS issues
      const isExternalUrl = fileUrl.startsWith('http://') || fileUrl.startsWith('https://')
      const pdfUrl = isExternalUrl 
        ? `${API_BASE}/api/proxy?url=${encodeURIComponent(fileUrl)}`
        : fileUrl
      
      const loadingTask = pdfjsLib.getDocument({
        url: pdfUrl,
      })
      
      const pdfDoc = await loadingTask.promise
      setPdf(pdfDoc)
      setPages(pdfDoc.numPages)
      canvasRefs.current = new Array(pdfDoc.numPages).fill(null)
    } catch (err: any) {
      console.error('PDF load error:', err)
      // Check if it's a CORS error
      if (err?.message?.includes('fetch') || err?.name === 'MissingPDFException') {
        setError('Unable to load PDF. The file may have CORS restrictions. Try downloading instead.')
      } else {
        setError('Failed to load PDF: ' + (err?.message || 'Unknown error'))
      }
    } finally {
      setLoading(false)
    }
  }

  const renderAllPages = async () => {
    if (!pdf || !containerRef.current) return

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      await renderPage(pageNum)
    }
  }

  const renderPage = async (pageNum: number) => {
    if (!pdf) return

    try {
      const page = await pdf.getPage(pageNum)
      const canvas = canvasRefs.current[pageNum - 1]
      if (!canvas) return

      const context = canvas.getContext('2d')
      if (!context) return

      const viewport = page.getViewport({ scale: 1 })
      
      let scale = viewerState.zoom
      if (viewerState.fitMode === 'width' && containerRef.current) {
        const containerWidth = containerRef.current.clientWidth
        scale = (containerWidth - 32) / viewport.width
      } else if (viewerState.fitMode === 'page' && containerRef.current) {
        const containerWidth = containerRef.current.clientWidth
        const containerHeight = window.innerHeight - 200
        const widthScale = (containerWidth - 32) / viewport.width
        const heightScale = containerHeight / viewport.height
        scale = Math.min(widthScale, heightScale)
      }

      const scaledViewport = page.getViewport({ scale })
      
      // Get device pixel ratio for high-DPI displays (Retina, mobile screens)
      // Use higher ratio (up to 3) for better quality on modern mobile devices
      const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 3)

      // Set canvas internal size to account for device pixel ratio
      // This ensures crisp rendering on high-DPI mobile screens
      canvas.height = Math.floor(scaledViewport.height * devicePixelRatio)
      canvas.width = Math.floor(scaledViewport.width * devicePixelRatio)
      
      // Set canvas display size (CSS pixels)
      canvas.style.width = '100%'
      canvas.style.height = 'auto'
      
      // Scale the canvas context to match device pixel ratio
      context.scale(devicePixelRatio, devicePixelRatio)

      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport
      }

      await page.render(renderContext).promise
    } catch (err) {
      console.error(`Error rendering page ${pageNum}:`, err)
    }
  }

  // Track visible page
  useEffect(() => {
    if (!containerRef.current || !onPageChange) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.getAttribute('data-page') || '1')
            onPageChange(pageNum)
          }
        })
      },
      { threshold: 0.5 }
    )

    const canvases = containerRef.current.querySelectorAll('canvas')
    canvases.forEach((canvas) => observer.observe(canvas))

    return () => observer.disconnect()
  }, [pdf, onPageChange])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading PDF...</p>
        </div>
      </div>
    )
  }

  if (error) {
    // Show iframe fallback for CORS errors
    const isExternalUrl = fileUrl.startsWith('http://') || fileUrl.startsWith('https://')
    
    return (
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {isExternalUrl ? (
          <>
            {/* Try embedded PDF viewer first */}
            <div className="w-full" style={{ height: '80vh' }}>
              <iframe
                src={fileUrl}
                className="w-full h-full border-0"
                title="PDF Document"
              />
            </div>
            {/* Fallback message */}
            <div className="p-4 bg-gray-50 border-t text-center">
              <p className="text-sm text-gray-600 mb-2">
                If the PDF doesn't display above, you can view or download it directly:
              </p>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Open PDF in New Tab
              </a>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-12">
            <p className="text-red-400">{error}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="space-y-4">
      {Array.from({ length: pages }, (_, i) => i + 1).map((pageNum) => (
        <div key={pageNum} className="bg-white shadow-lg" data-page={pageNum}>
          <canvas
            ref={(el) => (canvasRefs.current[pageNum - 1] = el)}
            className="w-full h-auto"
          />
          <div className="text-center py-2 text-sm text-gray-500 bg-gray-50">
            Page {pageNum} of {pages}
          </div>
        </div>
      ))}
    </div>
  )
}
