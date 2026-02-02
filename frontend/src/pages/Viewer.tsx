import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ZoomIn,
  ZoomOut,
  Download,
  Printer,
  Share2,
  Maximize,
  Home,
  Monitor,
  Smartphone,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { api } from '../utils/api'
import PDFRenderer from '../components/PDFRenderer'
import ImageRenderer from '../components/ImageRenderer'
import TextRenderer from '../components/TextRenderer'
import type { Document, ViewerState } from '../types'
import { getFileTypeFromUrl } from '../types'

interface ViewerProps {
  embedded?: boolean
}

export default function Viewer({ embedded }: ViewerProps) {
  const { docId } = useParams<{ docId: string }>()
  const navigate = useNavigate()
  const [document, setDocument] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toolbarVisible, setToolbarVisible] = useState(true)
  const [shareMenuOpen, setShareMenuOpen] = useState(false)
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [viewerState, setViewerState] = useState<ViewerState>({
    zoom: 1,
    currentPage: 1,
    totalPages: 0,
    fitMode: 'width'
  })

  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const viewerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (docId) {
      loadDocument()
    }
  }, [docId])

  const loadDocument = async () => {
    try {
      setLoading(true)
      const doc = await api.getDocument(docId!)
      setDocument(doc)
      setViewerState(prev => ({ ...prev, totalPages: doc.totalPages }))
      setCurrentFileIndex(0)
    } catch (err) {
      setError('Failed to load document')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Get all file URLs
  const getFileUrls = (): string[] => {
    if (!document) return []
    if (document.fileUrls && document.fileUrls.length > 0) return document.fileUrls
    if (document.fileUrl) return [document.fileUrl]
    return []
  }

  const fileUrls = getFileUrls()
  const currentFileUrl = fileUrls[currentFileIndex] || ''
  const currentFileType = currentFileUrl ? getFileTypeFromUrl(currentFileUrl) : 'other'
  const hasMultipleFiles = fileUrls.length > 1

  const handleScroll = () => {
    setToolbarVisible(false)
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setToolbarVisible(true)
    }, 1500)
  }

  const handleZoomIn = () => {
    setViewerState(prev => ({
      ...prev,
      zoom: Math.min(prev.zoom + 0.25, 3),
      fitMode: 'auto'
    }))
  }

  const handleZoomOut = () => {
    setViewerState(prev => ({
      ...prev,
      zoom: Math.max(prev.zoom - 0.25, 0.5),
      fitMode: 'auto'
    }))
  }

  const handleFitWidth = () => {
    setViewerState(prev => ({ ...prev, fitMode: 'width', zoom: 1 }))
  }

  const handleFitPage = () => {
    setViewerState(prev => ({ ...prev, fitMode: 'page', zoom: 1 }))
  }

  const handlePrevFile = () => {
    if (currentFileIndex > 0) {
      setCurrentFileIndex(currentFileIndex - 1)
    }
  }

  const handleNextFile = () => {
    if (currentFileIndex < fileUrls.length - 1) {
      setCurrentFileIndex(currentFileIndex + 1)
    }
  }

  const handleDownload = async () => {
    if (!document) return

    // R2 document - download current file
    if (currentFileUrl) {
      window.open(currentFileUrl, '_blank')
      return
    }

    // Legacy document with files array
    if (document.files && document.files.length === 1) {
      // Single file download
      const file = document.files[0]
      window.open(api.getFileUrl(file.filename), '_blank')
    } else if (document.files && document.files.length > 1) {
      // Multiple files - download as zip (backend will handle this)
      window.open(`/api/documents/${document.id}/download`, '_blank')
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleShare = () => {
    setShareMenuOpen(!shareMenuOpen)
  }

  const copyShareLink = () => {
    const link = `${window.location.origin}/view/${docId}`
    navigator.clipboard.writeText(link)
    alert('Link copied to clipboard!')
  }

  const copyEmbedCode = () => {
    const embedCode = `<iframe src="${window.location.origin}/embed/${docId}" width="100%" height="600" frameborder="0"></iframe>`
    navigator.clipboard.writeText(embedCode)
    alert('Embed code copied to clipboard!')
  }

  const handleFullscreen = () => {
    if (viewerRef.current) {
      if (window.document.fullscreenElement) {
        window.document.exitFullscreen()
      } else {
        viewerRef.current.requestFullscreen()
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading document...</p>
        </div>
      </div>
    )
  }

  if (error || !document) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Document not found'}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={viewerRef}
      className="min-h-screen bg-gray-900 relative overflow-y-auto"
      onScroll={handleScroll}
    >
      {/* Top Toolbar */}
      <div
        className={`fixed top-0 left-0 right-0 bg-gray-800 text-white shadow-lg z-50 transition-transform duration-300 ${
          toolbarVisible ? 'translate-y-0' : '-translate-y-full'
        } ${embedded ? 'hidden' : ''}`}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-gray-700 rounded-lg transition"
              title="Home"
            >
              <Home className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold truncate max-w-md">
              {document.name}
            </h1>
          </div>

          <div className="flex items-center space-x-2">
            {/* Zoom Controls */}
            <button
              onClick={handleZoomOut}
              className="p-2 hover:bg-gray-700 rounded-lg transition"
              title="Zoom Out"
            >
              <ZoomOut className="h-5 w-5" />
            </button>
            <span className="text-sm px-2">{Math.round(viewerState.zoom * 100)}%</span>
            <button
              onClick={handleZoomIn}
              className="p-2 hover:bg-gray-700 rounded-lg transition"
              title="Zoom In"
            >
              <ZoomIn className="h-5 w-5" />
            </button>

            <div className="h-6 w-px bg-gray-600 mx-2"></div>

            {/* Fit Controls */}
            <button
              onClick={handleFitWidth}
              className={`p-2 hover:bg-gray-700 rounded-lg transition ${
                viewerState.fitMode === 'width' ? 'bg-gray-700' : ''
              }`}
              title="Fit Width"
            >
              <Monitor className="h-5 w-5" />
            </button>
            <button
              onClick={handleFitPage}
              className={`p-2 hover:bg-gray-700 rounded-lg transition ${
                viewerState.fitMode === 'page' ? 'bg-gray-700' : ''
              }`}
              title="Fit Page"
            >
              <Smartphone className="h-5 w-5" />
            </button>

            <div className="h-6 w-px bg-gray-600 mx-2"></div>

            {/* Action Buttons */}
            <button
              onClick={handleDownload}
              className="p-2 hover:bg-gray-700 rounded-lg transition"
              title="Download"
            >
              <Download className="h-5 w-5" />
            </button>
            <button
              onClick={handlePrint}
              className="p-2 hover:bg-gray-700 rounded-lg transition"
              title="Print"
            >
              <Printer className="h-5 w-5" />
            </button>
            <div className="relative">
              <button
                onClick={handleShare}
                className="p-2 hover:bg-gray-700 rounded-lg transition"
                title="Share"
              >
                <Share2 className="h-5 w-5" />
              </button>
              {shareMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl text-gray-900 py-2">
                  <button
                    onClick={copyShareLink}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 transition"
                  >
                    Copy Link
                  </button>
                  <button
                    onClick={copyEmbedCode}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 transition"
                  >
                    Copy Embed Code
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleFullscreen}
              className="p-2 hover:bg-gray-700 rounded-lg transition"
              title="Fullscreen"
            >
              <Maximize className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Page Indicator */}
        <div className="text-center py-1 text-sm text-gray-400 border-t border-gray-700">
          Page {viewerState.currentPage} of {viewerState.totalPages}
        </div>
      </div>

      {/* Document Content */}
      <div className={`${embedded ? 'pt-0' : 'pt-24'} pb-8`}>
        <div className="max-w-6xl mx-auto px-4">
          {/* Multi-file navigation */}
          {hasMultipleFiles && (
            <div className="flex items-center justify-between bg-gray-800 rounded-lg p-3 mb-4">
              <button
                onClick={handlePrevFile}
                disabled={currentFileIndex === 0}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition text-white"
              >
                <ChevronLeft className="h-5 w-5" />
                <span className="hidden sm:inline">Previous</span>
              </button>
              
              <div className="text-center text-white">
                <span className="font-medium">
                  File {currentFileIndex + 1} of {fileUrls.length}
                </span>
              </div>
              
              <button
                onClick={handleNextFile}
                disabled={currentFileIndex === fileUrls.length - 1}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition text-white"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* R2 document with fileUrls */}
          {currentFileUrl && (
            <div className="mb-8">
              {currentFileType === 'pdf' && (
                <PDFRenderer
                  fileUrl={currentFileUrl}
                  viewerState={viewerState}
                  onPageChange={(page) =>
                    setViewerState(prev => ({ ...prev, currentPage: page }))
                  }
                />
              )}
              {currentFileType === 'image' && (
                <ImageRenderer
                  fileUrl={currentFileUrl}
                  viewerState={viewerState}
                />
              )}
              {currentFileType === 'text' && (
                <TextRenderer
                  fileUrl={currentFileUrl}
                  viewerState={viewerState}
                />
              )}
              {currentFileType === 'other' && (
                <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                  <p className="text-gray-600 mb-4">This file type cannot be previewed in the browser.</p>
                  <a
                    href={currentFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    <Download className="h-5 w-5" />
                    <span>Download File</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Legacy document with files array */}
          {!currentFileUrl && document.files && document.files.map((file) => (
            <div key={file.id} className="mb-8">
              {file.type === 'pdf' && (
                <PDFRenderer
                  fileUrl={api.getFileUrl(file.filename)}
                  viewerState={viewerState}
                  onPageChange={(page) =>
                    setViewerState(prev => ({ ...prev, currentPage: page }))
                  }
                />
              )}
              {file.type === 'image' && (
                <ImageRenderer
                  fileUrl={api.getFileUrl(file.filename)}
                  viewerState={viewerState}
                />
              )}
              {file.type === 'text' && (
                <TextRenderer
                  fileUrl={api.getFileUrl(file.filename)}
                  viewerState={viewerState}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
