import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { ArrowRight } from 'lucide-react'
import { api, API_BASE } from '../utils/api'
import type { Document as DocumentType } from '../types'

/**
 * Minimal, responsive document embed preview page for iframe embedding.
 * 
 * This component mirrors the server-rendered /api/embed-preview/:slug endpoint
 * for local development. In production, embeds use the backend-rendered page
 * to bypass static site SPA routing.
 * 
 * Features:
 * - Clean white background with centered card
 * - Soft shadow styling
 * - Mobile-first responsive design
 * - FilesPH branding in header
 * - PDF viewer iframe (first page preview)
 * - CTA button to view full document
 * - SEO meta tags and structured data
 * - No heavy navigation, sidebar, or popups
 * - Fast loading, optimized for iframe embedding
 */
export default function EmbedPreview() {
  const { slug } = useParams<{ slug: string }>()
  const safeSlug = slug ? decodeURIComponent(slug) : ''
  const [document, setDocument] = useState<DocumentType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

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

  const pdfSrc = `${API_BASE}/pdf/${safeSlug}?file=0`
  const fullDocUrl = `${window.location.origin}/d/${safeSlug}`

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-3 text-sm text-gray-500">Loading document…</p>
        </div>
      </div>
    )
  }

  if (error || !document) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Document Not Found</h1>
          <p className="text-gray-500 text-sm mb-4">
            The document you're looking for doesn't exist or has been removed.
          </p>
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

  const pageUrl = fullDocUrl
  const thumbnailUrl = document.thumbnailUrl || `${window.location.origin}/placeholder.jpg`
  const description = document.description || `View and download ${document.name} on FilesPH`

  // JSON-LD structured data
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'DigitalDocument',
    name: document.name,
    description: description,
    url: pageUrl,
    datePublished: document.createdAt,
    thumbnailUrl: thumbnailUrl,
    keywords: document.tags?.join(', '),
    genre: document.categories?.join(', '),
    numberOfPages: document.totalPages,
    publisher: {
      '@type': 'Organization',
      name: 'FilesPH',
      url: 'https://filesph.com'
    }
  }

  return (
    <>
      <Helmet>
        <title>{document.name} — FilesPH Document Preview</title>
        <meta name="description" content={description} />
        <meta name="keywords" content={(document.tags || document.categories || []).join(', ')} />
        
        {/* Open Graph */}
        <meta property="og:type" content="article" />
        <meta property="og:title" content={document.name} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={thumbnailUrl} />
        <meta property="og:site_name" content="FilesPH" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={document.name} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={thumbnailUrl} />
        
        {/* Canonical URL */}
        <link rel="canonical" href={pageUrl} />
        
        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <div className="min-h-screen bg-white font-sans antialiased">
        {/* Centered container with soft shadow */}
        <div className="max-w-[800px] mx-auto my-8 bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.04)] px-7 py-6 flex flex-col sm:my-6 sm:mx-4 sm:max-w-[calc(100%-32px)] max-sm:my-3 max-sm:mx-2 max-sm:px-4 max-sm:py-4 max-sm:rounded-xl max-sm:max-w-full">
          
          {/* Header with logo */}
          <header className="flex items-center mb-5 pb-4 border-b border-gray-100 max-sm:mb-4 max-sm:pb-3">
            <img 
              src="https://filesph.com/favicon.png" 
              alt="FilesPH" 
              className="w-7 h-7 mr-3 rounded max-sm:w-6 max-sm:h-6 max-sm:mr-2.5"
              width={28}
              height={28}
            />
            <span className="text-[15px] font-semibold text-blue-600 tracking-tight max-sm:text-sm">
              FilesPH Document Preview
            </span>
          </header>
          
          {/* Document title */}
          <h1 className="text-center text-[22px] font-bold text-gray-900 mb-5 leading-tight break-words max-sm:text-lg max-sm:mb-4">
            {document.name}
          </h1>
          
          {/* PDF iframe */}
          <div className="w-full flex justify-center px-1">
            <iframe
              src={pdfSrc}
              title={document.name}
              loading="lazy"
              allow="fullscreen"
              className="w-full max-w-[760px] h-[520px] border border-gray-200 rounded-xl bg-gray-50 shadow-[0_2px_8px_rgba(0,0,0,0.04)] sm:h-[450px] max-sm:h-[380px] max-sm:rounded-lg"
            />
          </div>
          
          {/* CTA Section */}
          <div className="mt-7 text-center max-sm:mt-5">
            <a
              href={fullDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold text-base px-7 py-3.5 rounded-xl shadow-[0_2px_8px_rgba(37,99,235,0.25)] transition-all duration-200 hover:bg-blue-700 hover:shadow-[0_4px_12px_rgba(37,99,235,0.35)] hover:-translate-y-0.5 active:translate-y-0 max-sm:w-full max-sm:text-[15px] max-sm:px-5 max-sm:py-3"
            >
              View Full Document on FilesPH
              <ArrowRight className="w-[18px] h-[18px] flex-shrink-0" />
            </a>
            <p className="text-[13px] text-gray-500 mt-3 leading-snug max-sm:text-xs max-sm:mt-2.5 max-sm:px-2">
              Open the full document to view all pages and download the file.
            </p>
          </div>
          
          {/* Footer */}
          <footer className="text-center text-xs text-gray-400 mt-6 tracking-wide max-sm:mt-5">
            <a 
              href="https://filesph.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-400 no-underline hover:text-blue-600 transition-colors duration-200"
            >
              filesph.com
            </a>
          </footer>
        </div>
      </div>
    </>
  )
}
