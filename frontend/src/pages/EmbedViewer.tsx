import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Download, FileArchive, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { api, API_BASE } from '../utils/api'
import type { Document as DocumentType } from '../types'

// Detect mobile devices (touch devices or narrow screens)
function isMobileDevice() {
  if (typeof window === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
    || (window.innerWidth <= 768 && 'ontouchstart' in window)
}

/**
 * Lightweight embeddable viewer that displays documents via a secure iframe.
 * 
 * The PDF is loaded from /api/pdf/:slug which streams from R2 without
 * exposing raw storage URLs. The browser's native PDF viewer renders it.
 * 
 * In production, embeds use the backend-rendered /api/embed/:slug page
 * (bypasses static site SPA routing). This React version is used for
 * local development at /embed/:slug.
 * 
 * On mobile devices, shows a thumbnail preview with a link to the full document
 * since mobile browsers don't render PDFs well in iframes.
 */
export default function EmbedViewer() {
  const { slug } = useParams<{ slug: string }>()
  const safeSlug = slug ? decodeURIComponent(slug) : ''
  const [document, setDocument] = useState<DocumentType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  
  // Detect mobile on mount
  useEffect(() => {
    setIsMobile(isMobileDevice())
  }, [])

  useEffect(() => {
    if (!safeSlug) {
      setLoading(false)
      return
    }

    let cancelled = false
    const fetchDoc = async (retries = 0) => {
      try {
        const doc = await api.getDocument(safeSlug)
        if (cancelled) return
        setDocument(doc)
        setLoading(false)
      } catch (err: any) {
        if (cancelled) return
        const status = err?.response?.status
        const isRetryable = !status || status === 404 || status >= 500
        if (isRetryable && retries < 5) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(1.5, retries)))
          if (!cancelled) await fetchDoc(retries + 1)
          return
        }
        setError(true)
        setLoading(false)
      }
    }
    fetchDoc()
    return () => { cancelled = true }
  }, [safeSlug])

  // Track embedded view
  useEffect(() => {
    if (document) {
      api.trackView(document.slug || document.id).catch(() => {})
    }
  }, [document])

  const fileCount = document?.fileUrls?.length || document?.files?.length || 0
  const pdfSrc = `${API_BASE}/pdf/${safeSlug}?file=${currentFileIndex}`
  const downloadUrl = `${API_BASE}/download/${safeSlug}/${currentFileIndex}`
  const downloadAllUrl = `${API_BASE}/download-all/${safeSlug}`

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-3 text-sm text-gray-500">Loading document…</p>
        </div>
      </div>
    )
  }

  if (error || !document) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-3">Document not found or temporarily unavailable.</p>
          <button
            onClick={() => window.location.reload()}
            className="text-blue-600 hover:underline text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Branding toolbar */}
      <div className="bg-white border-b border-gray-200 px-3 py-1.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <a
            href="https://filesph.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 font-bold text-sm whitespace-nowrap hover:text-blue-700"
          >
            filesph.com
          </a>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-700 truncate" title={document.name}>
            {document.name}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {fileCount > 1 && (
            <>
              <button
                onClick={() => setCurrentFileIndex(i => Math.max(0, i - 1))}
                disabled={currentFileIndex === 0}
                className="p-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30"
                title="Previous file"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-gray-500 tabular-nums">
                {currentFileIndex + 1}/{fileCount}
              </span>
              <button
                onClick={() => setCurrentFileIndex(i => Math.min(fileCount - 1, i + 1))}
                disabled={currentFileIndex >= fileCount - 1}
                className="p-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30"
                title="Next file"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <div className="h-4 w-px bg-gray-200 mx-0.5" />
            </>
          )}

          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 text-gray-600 hover:bg-gray-100 rounded"
            title="Download"
          >
            <Download className="h-4 w-4" />
          </a>
          {fileCount > 1 && (
            <a
              href={downloadAllUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 text-gray-600 hover:bg-gray-100 rounded"
              title="Download all as ZIP"
            >
              <FileArchive className="h-4 w-4" />
            </a>
          )}

          <div className="h-4 w-px bg-gray-200 mx-0.5" />
          <a
            href={`https://filesph.com/d/${safeSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition"
          >
            <ExternalLink className="h-3 w-3" />
            <span className="hidden sm:inline">Open Full</span>
          </a>
        </div>
      </div>

      {/* Ad slot — top */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 text-center shrink-0">
        <div className="bg-gray-200 rounded h-[90px] max-w-[728px] mx-auto flex items-center justify-center text-xs text-gray-400">
          Advertisement
        </div>
      </div>

      {/* Secure PDF viewer — raw R2 URLs are never exposed */}
      {/* On mobile, show thumbnail preview instead since PDF iframes don't work well */}
      {isMobile ? (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 bg-white">
          {document.thumbnailUrl && (
            <img 
              src={document.thumbnailUrl} 
              alt={document.name}
              className="max-w-[280px] w-full h-auto rounded-lg shadow-md mb-6"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <h2 className="text-lg font-semibold text-gray-900 text-center mb-2">{document.name}</h2>
          <p className="text-sm text-gray-600 text-center mb-4">Tap the button below to view the full document</p>
          <a
            href={`https://filesph.com/d/${safeSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition shadow-md"
          >
            <ExternalLink className="h-5 w-5" />
            View Full Document
          </a>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <iframe
            key={currentFileIndex}
            src={pdfSrc}
            className="w-full h-full border-0"
            title={document.name}
            allow="fullscreen"
          />
        </div>
      )}

      {/* Ad slot — bottom */}
      <div className="bg-gray-50 border-t border-gray-200 px-4 py-2 text-center shrink-0">
        <div className="bg-gray-200 rounded h-[90px] max-w-[728px] mx-auto flex items-center justify-center text-xs text-gray-400">
          Advertisement
        </div>
      </div>
    </div>
  )
}
