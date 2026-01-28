import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import type { ViewerState } from '../types'

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

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
      const loadingTask = pdfjsLib.getDocument(fileUrl)
      const pdfDoc = await loadingTask.promise
      setPdf(pdfDoc)
      setPages(pdfDoc.numPages)
      canvasRefs.current = new Array(pdfDoc.numPages).fill(null)
    } catch (err) {
      setError('Failed to load PDF')
      console.error(err)
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

      canvas.height = scaledViewport.height
      canvas.width = scaledViewport.width
      canvas.style.width = '100%'
      canvas.style.height = 'auto'

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
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-red-400">{error}</p>
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
