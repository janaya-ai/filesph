import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Download, Printer, Share2, ZoomIn, ZoomOut, Maximize2, ArrowLeft, Code, ChevronLeft, ChevronRight, FileArchive, ExternalLink, BookOpen } from 'lucide-react'
import PDFRenderer from '../components/PDFRenderer'
import ImageRenderer from '../components/ImageRenderer'
import TextRenderer from '../components/TextRenderer'
import RelatedDocuments from '../components/RelatedDocuments'
import { api, API_BASE_URL } from '../utils/api'
import { Document as DocumentType, ViewerState, getFileTypeFromUrl } from '../types'

interface DocumentPageProps {
  embedded?: boolean
}

function DocumentPage({ embedded = false }: DocumentPageProps) {
  const { slug } = useParams<{ slug: string }>()
  const safeSlug = slug ? decodeURIComponent(slug) : ''
  const [document, setDocument] = useState<DocumentType | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEmbedCode, setShowEmbedCode] = useState(false)
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [viewerState, setViewerState] = useState<ViewerState>({
    zoom: 1,
    currentPage: 1,
    totalPages: 0,
    fitMode: 'width'
  })

  useEffect(() => {
    let isCancelled = false
    
    const fetchDocument = async (retryCount = 0) => {
      const MAX_RETRIES = 8
      const BASE_DELAY = 1000 // ms
      
      try {
        // Only set loading on first attempt to avoid flashing
        if (retryCount === 0) {
          setLoading(true)
        }
        
        if (!safeSlug) {
          setDocument(null)
          setLoading(false)
          return
        }
        
        const doc = await api.getDocument(safeSlug)
        
        if (isCancelled) return
        
        setDocument(doc)
        setViewerState(prev => ({ ...prev, totalPages: doc.totalPages }))
        setCurrentFileIndex(0) // Reset to first file
      } catch (error: any) {
        if (isCancelled) return
        
        console.error(`Error fetching document (attempt ${retryCount + 1}):`, error)
        
        // Retry on 404, 500, or network errors - server may need time to sync or wake from cold start
        const status = error?.response?.status
        const isRetryableError = status === 404 || status === 500 || status === 502 || status === 503
        const isNetworkError = !error?.response && error?.code !== 'ERR_CANCELED'
        
        if ((isRetryableError || isNetworkError) && retryCount < MAX_RETRIES) {
          const delay = BASE_DELAY * Math.pow(1.5, retryCount) // Exponential backoff
          console.log(`Retrying document fetch in ${delay}ms (attempt ${retryCount + 2}/${MAX_RETRIES + 1})...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          
          if (isCancelled) return
          return fetchDocument(retryCount + 1)
        }
        
        setDocument(null)
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    fetchDocument()
    
    return () => {
      isCancelled = true
    }
  }, [safeSlug])

  // Re-fetch document when returning from idle/background tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document === null && !loading && slug && window.document.visibilityState === 'visible') {
        // Document failed to load previously, retry now that the tab is active again
        setLoading(true)
        api.getDocument(slug)
          .then(doc => {
            setDocument(doc)
            setViewerState(prev => ({ ...prev, totalPages: doc.totalPages }))
            setCurrentFileIndex(0)
          })
          .catch(() => {
            setDocument(null)
          })
          .finally(() => {
            setLoading(false)
          })
      }
    }

    window.document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [slug, document, loading])

  // Get all file URLs (from fileUrls array or legacy fileUrl)
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

  const handleDownload = () => {
    if (!document) return
    
    // Use backend download route (proxies R2 and hides URL)
    const downloadUrl = `${API_BASE_URL}/api/download/${document.slug || document.id}/${currentFileIndex}`
    window.open(downloadUrl, '_blank')
  }

  const handleDownloadAll = () => {
    if (!document) return
    
    // Download all files as ZIP through backend
    const downloadUrl = `${API_BASE_URL}/api/download-all/${document.slug || document.id}`
    window.open(downloadUrl, '_blank')
  }

  const handlePrint = () => {
    window.print()
  }

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({
          title: document?.name,
          text: document?.description || `Check out ${document?.name}`,
          url: url,
        })
      } catch (error) {
        console.error('Error sharing:', error)
      }
    } else {
      setShowEmbedCode(true)
    }
  }

  const toggleFullscreen = () => {
    if (!window.document.fullscreenElement) {
      window.document.documentElement.requestFullscreen()
    } else {
      window.document.exitFullscreen()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading document...</p>
        </div>
      </div>
    )
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Document Not Found</h1>
          <p className="text-gray-600 mb-8">The document you're looking for doesn't exist.</p>
          <Link to="/" className="text-blue-600 hover:underline">
            Return to Home
          </Link>
        </div>
      </div>
    )
  }

  const pageUrl = `${window.location.origin}/d/${encodeURIComponent(document.slug)}`
  
  // Determine thumbnail URL - R2 thumbnailUrl takes priority, then legacy thumbnail
  let thumbnailUrl = `${window.location.origin}/placeholder.jpg`
  if (document.thumbnailUrl) {
    thumbnailUrl = document.thumbnailUrl
  } else if (document.thumbnail) {
    thumbnailUrl = api.getFileUrl(document.thumbnail)
  }

  // Determine encoding format for structured data
  const encodingFormat = document.fileUrl 
    ? (document.fileType === 'pdf' ? 'application/pdf' : document.fileType === 'image' ? 'image/jpeg' : 'text/plain')
    : document.files?.[0]?.mimeType

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'DigitalDocument',
    name: document.name,
    description: document.description || `View and download ${document.name}`,
    url: pageUrl,
    datePublished: document.createdAt,
    thumbnailUrl: thumbnailUrl,
    keywords: document.tags?.join(', '),
    genre: document.categories?.join(', '),
    numberOfPages: document.totalPages,
    encodingFormat: encodingFormat,
  }

  return (
    <>
      <Helmet>
        <title>{document.name} | filesph.com</title>
        <meta name="description" content={document.description || `View and download ${document.name}. Access high-quality documents on filesph.com.`} />
        <meta name="keywords" content={document.tags?.join(', ') || document.categories?.join(', ')} />
        
        {/* Open Graph */}
        <meta property="og:type" content="article" />
        <meta property="og:title" content={document.name} />
        <meta property="og:description" content={document.description || `View and download ${document.name}`} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={thumbnailUrl} />
        <meta property="og:site_name" content="filesph.com" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={document.name} />
        <meta name="twitter:description" content={document.description || `View and download ${document.name}`} />
        <meta name="twitter:image" content={thumbnailUrl} />
        
        {/* Canonical URL */}
        <link rel="canonical" href={pageUrl} />
        
        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <div className="min-h-screen bg-gray-50">
        {/* Header - hidden in embedded mode */}
        {!embedded && (
          <header className="bg-white border-b border-gray-200 sticky top-0 z-10 print:hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {/* Desktop layout */}
              <div className="hidden sm:flex items-center justify-between h-16">
                <div className="flex items-center space-x-4">
                  <Link 
                    to="/" 
                    className="flex items-center text-gray-700 hover:text-blue-600 transition-colors"
                  >
                    <ArrowLeft className="h-5 w-5 mr-2" />
                    <span className="font-medium">Back to Home</span>
                  </Link>
                </div>
                
                <div className="flex items-center space-x-2">
                <button
                  onClick={() => setViewerState(prev => ({ ...prev, zoom: Math.max(0.5, prev.zoom - 0.1) }))}
                  className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-5 w-5" />
                </button>
                <span className="text-sm text-gray-600 min-w-[60px] text-center">
                  {Math.round(viewerState.zoom * 100)}%
                </span>
                <button
                  onClick={() => setViewerState(prev => ({ ...prev, zoom: Math.min(2, prev.zoom + 0.1) }))}
                  className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  title="Zoom In"
                >
                  <ZoomIn className="h-5 w-5" />
                </button>
                <div className="h-6 w-px bg-gray-300 mx-2"></div>
                <button
                  onClick={handleDownload}
                  className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  title="Download Current File"
                >
                  <Download className="h-5 w-5" />
                </button>
                {hasMultipleFiles && (
                  <button
                    onClick={handleDownloadAll}
                    className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    title="Download All as ZIP"
                  >
                    <FileArchive className="h-5 w-5" />
                  </button>
                )}
                <button
                  onClick={handlePrint}
                  className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  title="Print"
                >
                  <Printer className="h-5 w-5" />
                </button>
                <button
                  onClick={handleShare}
                  className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  title="Share"
                >
                  <Share2 className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setShowEmbedCode(true)}
                  className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  title="Embed"
                >
                  <Code className="h-5 w-5" />
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  title="Fullscreen"
                >
                  <Maximize2 className="h-5 w-5" />
                </button>
              </div>
            </div>

              {/* Mobile layout - two rows */}
              <div className="sm:hidden">
                {/* First row: Back button */}
                <div className="flex items-center justify-between py-2">
                  <Link 
                    to="/" 
                    className="flex items-center text-gray-700 hover:text-blue-600 transition-colors"
                  >
                    <ArrowLeft className="h-5 w-5 mr-1" />
                    <span className="text-sm font-medium">Back</span>
                  </Link>
                  <h1 className="text-sm font-medium text-gray-800 truncate max-w-[200px]">
                    {document.name}
                  </h1>
                </div>
                
                {/* Second row: All action buttons */}
                <div className="flex items-center justify-between py-2 border-t border-gray-100">
                  {/* Zoom controls */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setViewerState(prev => ({ ...prev, zoom: Math.max(0.5, prev.zoom - 0.1) }))}
                      className="p-1.5 text-gray-700 hover:bg-gray-100 rounded"
                      title="Zoom Out"
                    >
                      <ZoomOut className="h-4 w-4" />
                    </button>
                    <span className="text-xs text-gray-600 min-w-[40px] text-center">
                      {Math.round(viewerState.zoom * 100)}%
                    </span>
                    <button
                      onClick={() => setViewerState(prev => ({ ...prev, zoom: Math.min(2, prev.zoom + 0.1) }))}
                      className="p-1.5 text-gray-700 hover:bg-gray-100 rounded"
                      title="Zoom In"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={handleDownload}
                      className="p-1.5 text-gray-700 hover:bg-gray-100 rounded"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    {hasMultipleFiles && (
                      <button
                        onClick={handleDownloadAll}
                        className="p-1.5 text-gray-700 hover:bg-gray-100 rounded"
                        title="Download All"
                      >
                        <FileArchive className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={handlePrint}
                      className="p-1.5 text-gray-700 hover:bg-gray-100 rounded"
                      title="Print"
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                    <button
                      onClick={handleShare}
                      className="p-1.5 text-gray-700 hover:bg-gray-100 rounded"
                      title="Share"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setShowEmbedCode(true)}
                      className="p-1.5 text-gray-700 hover:bg-gray-100 rounded"
                      title="Embed"
                    >
                      <Code className="h-4 w-4" />
                    </button>
                    <button
                      onClick={toggleFullscreen}
                      className="p-1.5 text-gray-700 hover:bg-gray-100 rounded"
                      title="Fullscreen"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
          </div>
        </header>
        )}

        {/* Compact toolbar for embedded mode */}
        {embedded && (
          <div className="bg-white border-b border-gray-200 sticky top-0 z-10 print:hidden">
            <div className="flex items-center justify-between px-4 py-2">
              <div className="text-sm font-medium text-gray-700 truncate flex-1">
                {document?.name}
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={handleDownload}
                  className="p-1.5 text-gray-700 hover:bg-gray-100 rounded"
                  title="Download Current File"
                >
                  <Download className="h-4 w-4" />
                </button>
                {hasMultipleFiles && (
                  <button
                    onClick={handleDownloadAll}
                    className="p-1.5 text-gray-700 hover:bg-gray-100 rounded"
                    title="Download All as ZIP"
                  >
                    <FileArchive className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={handlePrint}
                  className="p-1.5 text-gray-700 hover:bg-gray-100 rounded"
                  title="Print"
                >
                  <Printer className="h-4 w-4" />
                </button>
                <button
                  onClick={handleShare}
                  className="p-1.5 text-gray-700 hover:bg-gray-100 rounded"
                  title="Share"
                >
                  <Share2 className="h-4 w-4" />
                </button>
                <a
                  href={`${window.location.origin}/d/${document?.slug}`}
                  target="_parent"
                  className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded text-xs font-medium flex items-center gap-1"
                  title="View on filesph.com"
                >
                  <Maximize2 className="h-4 w-4" />
                  <span>View on filesph.com</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Document Info - hidden in embedded mode */}
        {!embedded && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{document.name}</h1>
            {document.description && (
              <p className="text-gray-600 mb-4">{document.description}</p>
            )}
            <div className="flex flex-wrap gap-2 items-center">
              {document.categories && document.categories.map(cat => (
                <span 
                  key={cat}
                  className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                >
                  {cat}
                </span>
              ))}
              {document.tags && document.tags.map(tag => (
                <span 
                  key={tag}
                  className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                >
                  #{tag}
                </span>
              ))}
              <span className="text-sm text-gray-500 ml-2">
                {document.totalPages} {document.totalPages === 1 ? 'page' : 'pages'}
              </span>
            </div>

            {/* Related Guides/Articles */}
            {document.relatedArticles && document.relatedArticles.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2 text-gray-700 mb-2">
                  <BookOpen className="h-4 w-4" />
                  <span className="text-sm font-medium">Related Guides</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {document.relatedArticles.map((article, index) => (
                    <a
                      key={index}
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 text-sm rounded-full transition"
                    >
                      <span>{article.title}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Document Viewer - with right margin for sidebar on desktop */}
        <main className={`${embedded ? 'p-0' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:pr-80'}`}>
          {/* Multi-file navigation bar */}
          {hasMultipleFiles && (
            <div className="flex items-center justify-between bg-gray-100 rounded-lg p-3 mb-4">
              <button
                onClick={handlePrevFile}
                disabled={currentFileIndex === 0}
                className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="h-5 w-5" />
                <span className="hidden sm:inline">Previous</span>
              </button>
              
              <div className="text-center">
                <span className="font-medium text-gray-900">
                  File {currentFileIndex + 1} of {fileUrls.length}
                </span>
                <p className="text-xs text-gray-500 mt-1 truncate max-w-xs">
                  {currentFileUrl.split('/').pop()?.split('?')[0]}
                </p>
              </div>
              
              <button
                onClick={handleNextFile}
                disabled={currentFileIndex === fileUrls.length - 1}
                className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}

          <div className={`bg-white ${embedded ? '' : 'rounded-lg shadow-sm'} overflow-y-auto`} style={{ transform: `scale(${viewerState.zoom})`, transformOrigin: 'top center' }}>
            {/* R2 document with fileUrls array (new format) or single fileUrl */}
            {currentFileUrl && (
              <div className="mb-4">
                {currentFileType === 'pdf' && (
                  <PDFRenderer 
                    fileUrl={currentFileUrl} 
                    viewerState={viewerState}
                    onPageChange={(page) => setViewerState(prev => ({ ...prev, currentPage: page }))}
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
                  <div className="bg-gray-50 rounded-lg p-8 text-center">
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
            
            {/* Legacy document with files array (local uploads) */}
            {!currentFileUrl && document.files && document.files.map(file => {
              const legacyFileUrl = api.getFileUrl(file.path)
              return (
                <div key={file.id} className="mb-4">
                  {file.type === 'pdf' && (
                    <PDFRenderer 
                      fileUrl={legacyFileUrl} 
                      viewerState={viewerState}
                      onPageChange={(page) => setViewerState(prev => ({ ...prev, currentPage: page }))}
                    />
                  )}
                  {file.type === 'image' && (
                    <ImageRenderer 
                      fileUrl={legacyFileUrl} 
                      viewerState={viewerState}
                    />
                  )}
                  {file.type === 'text' && (
                    <TextRenderer 
                      fileUrl={legacyFileUrl} 
                      viewerState={viewerState}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </main>

        {/* Related Documents - Mobile (shown below viewer) */}
        {!embedded && document && (
          <div className="lg:hidden max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <RelatedDocuments
              documentId={document.id}
              documentSlug={document.slug}
              limit={6}
              className="bg-white rounded-lg shadow-sm p-6"
            />
          </div>
        )}

        {/* Related Documents - Desktop Sidebar (fixed position) */}
        {!embedded && document && (
          <aside className="hidden lg:block fixed right-4 top-24 w-72 max-h-[calc(100vh-8rem)] overflow-y-auto">
            <RelatedDocuments
              documentId={document.id}
              documentSlug={document.slug}
              limit={8}
              className="bg-white rounded-lg shadow-sm p-4 border border-gray-200"
            />
          </aside>
        )}

        {/* Embed Code Modal */}
        {showEmbedCode && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Embed Document</h3>
                <button
                  onClick={() => setShowEmbedCode(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="text-2xl">&times;</span>
                </button>
              </div>
              
              <p className="text-gray-600 mb-4">
                Copy and paste this code to embed the document on your website:
              </p>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                <code className="text-sm text-gray-800 break-all">
                  {`<iframe src="${window.location.origin}/embed/${encodeURIComponent(document?.slug || '')}" width="100%" height="600" frameborder="0" allowfullscreen></iframe>`}
                </code>
              </div>
              
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `<iframe src="${window.location.origin}/embed/${encodeURIComponent(document?.slug || '')}" width="100%" height="600" frameborder="0" allowfullscreen></iframe>`
                  )
                  alert('Embed code copied to clipboard!')
                }}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Copy Embed Code
              </button>
              
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Direct Link:</strong>
                </p>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <code className="text-sm text-gray-800 break-all">
                    {`${window.location.origin}/d/${encodeURIComponent(document?.slug || '')}`}
                  </code>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/d/${encodeURIComponent(document?.slug || '')}`)
                    alert('Link copied to clipboard!')
                  }}
                  className="mt-2 w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
                >
                  Copy Link
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default DocumentPage
