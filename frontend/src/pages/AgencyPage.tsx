import { useEffect, useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { ArrowLeft, FileText, Filter, ChevronDown, Building2 } from 'lucide-react'
import { api, AgencyWithDocuments } from '../utils/api'
import type { Document as DocumentType, Category } from '../types'

export default function AgencyPage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  
  const [data, setData] = useState<AgencyWithDocuments | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filter states from URL params
  const selectedCategory = searchParams.get('category') || ''
  const selectedYear = searchParams.get('year') || ''
  const selectedSort = searchParams.get('sort') || 'newest'
  
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    const fetchAgencyData = async () => {
      if (!slug) return
      
      try {
        setLoading(true)
        setError(null)
        
        const result = await api.getAgency(slug, {
          category: selectedCategory || undefined,
          year: selectedYear || undefined,
          sort: selectedSort
        })
        
        setData(result)
      } catch (err) {
        console.error('Error fetching agency:', err)
        setError('Agency not found')
      } finally {
        setLoading(false)
      }
    }

    fetchAgencyData()
  }, [slug, selectedCategory, selectedYear, selectedSort])

  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams)
    if (value) {
      newParams.set(key, value)
    } else {
      newParams.delete(key)
    }
    setSearchParams(newParams)
  }

  const clearFilters = () => {
    setSearchParams({})
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading agency...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Building2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Agency Not Found</h1>
          <p className="text-gray-600 mb-4">The agency you're looking for doesn't exist.</p>
          <Link
            to="/"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  const { agency, documents, filters } = data
  const pageUrl = `https://filesph.com/agency/${agency.slug}`
  const pageTitle = `${agency.shortName} Forms and Documents – FilesPH`
  const pageDescription = agency.description || `Browse and download ${agency.name} (${agency.shortName}) documents, forms, and official files on FilesPH.`

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta name="keywords" content={`${agency.shortName}, ${agency.name}, documents, forms, Philippines, government`} />
        
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:site_name" content="filesph.com" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        
        {/* Canonical URL */}
        <link rel="canonical" href={pageUrl} />
        
        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: pageTitle,
            description: pageDescription,
            url: pageUrl,
            publisher: {
              '@type': 'Organization',
              name: agency.name,
              alternateName: agency.shortName
            },
            numberOfItems: agency.documentCount
          })}
        </script>
      </Helmet>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <Link 
                  to="/" 
                  className="flex items-center text-gray-700 hover:text-blue-600 transition-colors"
                >
                  <ArrowLeft className="h-5 w-5 mr-2" />
                  <span className="font-medium hidden sm:inline">Back to Home</span>
                </Link>
              </div>
              
              {/* Mobile filter toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="sm:hidden flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <Filter className="h-4 w-4" />
                Filters
              </button>
            </div>
          </div>
        </header>

        {/* Agency Info */}
        <div className="bg-blue-600 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Building2 className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">{agency.shortName}</h1>
                <p className="text-blue-100">{agency.name}</p>
              </div>
            </div>
            {agency.description && (
              <p className="text-blue-100 max-w-3xl">{agency.description}</p>
            )}
            <div className="mt-4 flex items-center gap-4 text-sm">
              <span className="bg-white/20 px-3 py-1 rounded-full">
                {agency.documentCount} {agency.documentCount === 1 ? 'document' : 'documents'}
              </span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className={`bg-white border-b border-gray-200 ${showFilters ? 'block' : 'hidden sm:block'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Category Filter */}
              <div className="relative">
                <select
                  value={selectedCategory}
                  onChange={(e) => updateFilter('category', e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Categories</option>
                  {filters.categories.map((cat: Category) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>

              {/* Year Filter */}
              <div className="relative">
                <select
                  value={selectedYear}
                  onChange={(e) => updateFilter('year', e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Years</option>
                  {filters.years.map((year: number) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>

              {/* Sort */}
              <div className="relative">
                <select
                  value={selectedSort}
                  onChange={(e) => updateFilter('sort', e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="downloads">Most Downloaded</option>
                  <option value="views">Most Viewed</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>

              {/* Clear Filters */}
              {(selectedCategory || selectedYear || selectedSort !== 'newest') && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Documents List */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {documents.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-medium text-gray-900 mb-2">No documents found</h2>
              <p className="text-gray-600 mb-4">
                {selectedCategory || selectedYear 
                  ? 'Try adjusting your filters to see more documents.'
                  : `No documents have been uploaded for ${agency.shortName} yet.`
                }
              </p>
              {(selectedCategory || selectedYear) && (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {documents.map((doc: DocumentType) => (
                <Link
                  key={doc.id}
                  to={`/d/${doc.slug}`}
                  className="group bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md hover:border-blue-200 transition-all"
                >
                  {/* Thumbnail */}
                  <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                    {doc.thumbnailUrl ? (
                      <img
                        src={doc.thumbnailUrl}
                        alt={doc.name}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText className="h-12 w-12 text-gray-300" />
                      </div>
                    )}
                    {doc.featured && (
                      <span className="absolute top-2 right-2 px-2 py-1 bg-yellow-500 text-white text-xs font-medium rounded">
                        Featured
                      </span>
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="p-4">
                    <h3 className="font-medium text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {doc.name}
                    </h3>
                    {doc.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{doc.description}</p>
                    )}
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                      <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                      <span>{doc.totalPages} {doc.totalPages === 1 ? 'page' : 'pages'}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
