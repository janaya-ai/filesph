import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { FileText, Search, Grid, List, X, ChevronLeft, Filter, Building2 } from 'lucide-react'
import { api } from '../utils/api'
import type { Document, Category } from '../types'

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [documents, setDocuments] = useState<Document[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showFilters, setShowFilters] = useState(false)
  
  // Get search parameters
  const query = searchParams.get('q') || ''
  const categoryId = searchParams.get('category') || ''
  const sortBy = searchParams.get('sort') || 'newest'
  const page = parseInt(searchParams.get('page') || '1')
  const perPage = 12

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [docs, cats] = await Promise.all([
        api.getDocuments(),
        api.getCategories()
      ])
      setDocuments(docs)
      setCategories(cats)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter and sort documents
  const filteredDocs = documents.filter(doc => {
    // Filter by category
    if (categoryId && !doc.categories.includes(categoryId)) {
      return false
    }
    
    // Filter by search query
    if (query) {
      const searchTerm = query.toLowerCase()
      const nameMatch = doc.name.toLowerCase().includes(searchTerm)
      const descMatch = doc.description?.toLowerCase().includes(searchTerm)
      const categoryMatch = doc.categories.some(catId => {
        const category = categories.find(c => c.id === catId)
        return category?.name.toLowerCase().includes(searchTerm)
      })
      const agencyMatch = doc.sourceAgency?.toLowerCase().includes(searchTerm)
      return nameMatch || descMatch || categoryMatch || agencyMatch
    }
    
    return true
  }).sort((a, b) => {
    switch (sortBy) {
      case 'oldest':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      case 'name':
        return a.name.localeCompare(b.name)
      case 'popular':
        return ((b.views || 0) + (b.downloads || 0)) - ((a.views || 0) + (a.downloads || 0))
      case 'newest':
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }
  })

  // Pagination
  const totalPages = Math.ceil(filteredDocs.length / perPage)
  const paginatedDocs = filteredDocs.slice((page - 1) * perPage, page * perPage)

  const updateParams = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams)
    if (value) {
      newParams.set(key, value)
    } else {
      newParams.delete(key)
    }
    if (key !== 'page') {
      newParams.delete('page') // Reset to page 1 on filter change
    }
    setSearchParams(newParams)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const selectedCategory = categories.find(c => c.id === categoryId)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Helmet>
        <title>{query ? `Search: ${query}` : selectedCategory ? selectedCategory.name : 'All Documents'} - FilesPH</title>
        <meta name="description" content={`Browse ${query ? `documents matching "${query}"` : selectedCategory ? `${selectedCategory.name} documents` : 'all documents'} on FilesPH`} />
      </Helmet>
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center space-x-4">
            <Link to="/" className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition">
              <ChevronLeft className="h-5 w-5" />
              <span className="hidden sm:inline">Back</span>
            </Link>
            
            <Link to="/" className="flex items-center space-x-2">
              <FileText className="h-6 w-6 text-blue-600" />
              <span className="text-lg font-bold text-gray-900">FilesPH</span>
            </Link>
            
            {/* Search Bar */}
            <div className="flex-1 max-w-2xl">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => updateParams('q', e.target.value)}
                  className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Search documents..."
                />
                {query && (
                  <button
                    onClick={() => updateParams('q', '')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page Title and Filters */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {query ? `Search: "${query}"` : selectedCategory ? selectedCategory.name : 'All Documents'}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {filteredDocs.length} document{filteredDocs.length !== 1 ? 's' : ''} found
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Mobile Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="sm:hidden px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm flex items-center space-x-2"
              >
                <Filter className="h-4 w-4" />
                <span>Filters</span>
              </button>
              
              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => updateParams('sort', e.target.value)}
                className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="name">Name A-Z</option>
                <option value="popular">Most Popular</option>
              </select>
              
              {/* View Mode Toggle */}
              <div className="flex items-center bg-white border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          
          {/* Category Filters - Desktop always visible, mobile toggleable */}
          <div className={`mt-4 ${showFilters ? 'block' : 'hidden sm:block'}`}>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => updateParams('category', '')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  !categoryId
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => updateParams('category', cat.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                    categoryId === cat.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat.name} ({cat.documentCount})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        {paginatedDocs.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No documents found</h2>
            <p className="text-gray-500 mb-6">
              {query 
                ? `No documents match "${query}"`
                : 'No documents in this category yet'}
            </p>
            <Link
              to="/search"
              onClick={() => {
                setSearchParams(new URLSearchParams())
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Clear Filters
            </Link>
          </div>
        ) : (
          <>
            <div
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                  : 'space-y-4'
              }
            >
              {paginatedDocs.map(doc => (
                <DocumentCard 
                  key={doc.id} 
                  document={doc} 
                  categories={categories} 
                  listView={viewMode === 'list'}
                  formatDate={formatDate}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center space-x-2">
                <button
                  onClick={() => updateParams('page', String(page - 1))}
                  disabled={page === 1}
                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (page <= 3) {
                      pageNum = i + 1
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = page - 2 + i
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => updateParams('page', String(pageNum))}
                        className={`w-10 h-10 rounded-lg text-sm font-medium ${
                          page === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>
                
                <button
                  onClick={() => updateParams('page', String(page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-2">
              FilesPH - Independent platform for accessing public documents
            </p>
            <div className="flex items-center justify-center space-x-4 text-sm">
              <Link to="/about" className="text-gray-400 hover:text-white transition">About</Link>
              <Link to="/privacy-policy" className="text-gray-400 hover:text-white transition">Privacy</Link>
              <Link to="/terms-of-service" className="text-gray-400 hover:text-white transition">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

interface DocumentCardProps {
  document: Document
  categories: Category[]
  listView?: boolean
  formatDate: (date: string) => string
}

function DocumentCard({ document, categories, listView, formatDate }: DocumentCardProps) {
  const categoryNames = document.categories
    .map(catId => categories.find(c => c.id === catId)?.name)
    .filter(Boolean)
    .join(', ')

  const documentUrl = document.slug ? `/d/${document.slug}` : `/view/${document.id}`

  if (listView) {
    return (
      <Link
        to={documentUrl}
        className="flex items-center space-x-4 p-4 bg-white rounded-xl border border-gray-100 hover:shadow-md transition-all duration-200 group"
      >
        <div className="h-16 w-16 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
          {document.thumbnailUrl || document.thumbnail ? (
            <img 
              src={document.thumbnailUrl || api.getFileUrl(document.thumbnail!)} 
              alt="" 
              className="w-full h-full object-cover rounded-lg"
              loading="lazy"
            />
          ) : (
            <FileText className="h-6 w-6 text-blue-300" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 transition line-clamp-1">
            {document.name}
          </h3>
          <p className="text-sm text-blue-600 font-medium">{categoryNames || 'Uncategorized'}</p>
          <div className="flex items-center space-x-3 text-xs text-gray-500 mt-1">
            {document.sourceAgency && (
              <span className="flex items-center space-x-1">
                <Building2 className="h-3 w-3" />
                <span>{document.sourceAgency}</span>
              </span>
            )}
            <span>{formatDate(document.createdAt)}</span>
          </div>
        </div>
        
        <div className="text-blue-600 group-hover:translate-x-1 transition-transform">
          <ChevronLeft className="h-5 w-5 rotate-180" />
        </div>
      </Link>
    )
  }

  return (
    <Link
      to={documentUrl}
      className="block bg-white rounded-xl border border-gray-100 hover:shadow-lg transition-all duration-200 overflow-hidden group"
    >
      <div className="aspect-[16/10] bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center overflow-hidden">
        {document.thumbnailUrl || document.thumbnail ? (
          <img 
            src={document.thumbnailUrl || api.getFileUrl(document.thumbnail!)} 
            alt="" 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <FileText className="h-12 w-12 text-blue-300" />
        )}
      </div>
      
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 transition line-clamp-2 mb-2">
          {document.name}
        </h3>
        
        <p className="text-sm text-blue-600 font-medium mb-2">
          {categoryNames || 'Uncategorized'}
        </p>
        
        {document.sourceAgency && (
          <p className="text-xs text-gray-500 flex items-center space-x-1 mb-2">
            <Building2 className="h-3 w-3" />
            <span>{document.sourceAgency}</span>
          </p>
        )}
        
        <p className="text-xs text-gray-400">
          {formatDate(document.createdAt)}
        </p>
      </div>
    </Link>
  )
}
