import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { api } from '../utils/api'
import type { Document } from '../types'

interface RelatedDocumentsProps {
  documentId: string
  documentSlug?: string
  limit?: number
  className?: string
}

export default function RelatedDocuments({ 
  documentId, 
  documentSlug,
  limit = 6,
  className = ''
}: RelatedDocumentsProps) {
  const [relatedDocs, setRelatedDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRelated = async () => {
      try {
        setLoading(true)
        const docs = await api.getRelatedDocuments(documentSlug || documentId, limit)
        setRelatedDocs(docs)
      } catch (error) {
        console.error('Error fetching related documents:', error)
        setRelatedDocs([])
      } finally {
        setLoading(false)
      }
    }

    if (documentId || documentSlug) {
      fetchRelated()
    }
  }, [documentId, documentSlug, limit])

  if (loading) {
    return (
      <div className={`${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Related Documents</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex gap-3">
              <div className="w-16 h-20 bg-gray-200 rounded"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (relatedDocs.length === 0) {
    return null // Don't show section if no related docs
  }

  return (
    <div className={`${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Related Documents</h3>
      <div className="space-y-3">
        {relatedDocs.map((doc) => (
          <Link
            key={doc.id}
            to={`/d/${doc.slug}`}
            className="flex gap-3 p-2 rounded-lg hover:bg-gray-50 transition group"
          >
            {/* Thumbnail */}
            <div className="w-16 h-20 flex-shrink-0 rounded overflow-hidden bg-gray-100">
              {doc.thumbnailUrl || doc.thumbnail ? (
                <img
                  src={doc.thumbnailUrl || (doc.thumbnail ? api.getFileUrl(doc.thumbnail) : '')}
                  alt={doc.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <FileText className="w-8 h-8" />
                </div>
              )}
            </div>
            
            {/* Title and meta */}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition line-clamp-2">
                {doc.name}
              </h4>
              {doc.sourceAgency && (
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {doc.sourceAgency}
                </p>
              )}
              {doc.categories && doc.categories.length > 0 && (
                <p className="text-xs text-blue-600 mt-1 truncate">
                  {doc.categories.slice(0, 2).join(', ')}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
      
      {/* View More link */}
      <Link
        to="/"
        className="block mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium text-center"
      >
        Browse All Documents →
      </Link>
    </div>
  )
}
