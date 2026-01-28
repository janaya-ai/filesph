import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { FileText, Star, Grid, List, Search } from 'lucide-react'
import { api } from '../utils/api'
import type { Document, Category } from '../types'

export default function Home() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [loading, setLoading] = useState(true)

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

  const featuredDocs = documents.filter(doc => doc.featured)
  
  // Filter documents by category and search query
  const filteredDocs = documents.filter(doc => {
    // Filter by category
    if (selectedCategory && !doc.categories.includes(selectedCategory)) {
      return false
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const titleMatch = doc.name.toLowerCase().includes(query)
      const categoryMatch = doc.categories.some(catId => {
        const category = categories.find(c => c.id === catId)
        return category?.name.toLowerCase().includes(query)
      })
      return titleMatch || categoryMatch
    }
    
    return true
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading documents...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet>
        <title>filesph.com - A comprehensive platform for accessing and managing documents</title>
        <meta name="description" content="Browse and access documents online. View PDFs, images, and text files with our easy-to-use document viewer." />
      </Helmet>
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <div className="flex items-center space-x-2">
                <FileText className="h-8 w-8 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">filesph.com</h1>
              </div>
              <p className="text-sm text-gray-600 mt-1 ml-10">A comprehensive platform for accessing and managing documents.</p>
            </div>
            <Link
              to="/login"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Admin Login
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative max-w-2xl mx-auto">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              placeholder="Search documents by title or category..."
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <span className="text-lg">&times;</span>
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-center text-sm text-gray-600 mt-2">
              Found {filteredDocs.length} document{filteredDocs.length !== 1 ? 's' : ''} matching "{searchQuery}"
            </p>
          )}
        </div>

        {/* Featured Documents */}
        {featuredDocs.length > 0 && !searchQuery && (
          <section className="mb-12">
            <div className="flex items-center space-x-2 mb-6">
              <Star className="h-6 w-6 text-yellow-500 fill-current" />
              <h2 className="text-2xl font-bold text-gray-900">Featured Documents</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredDocs.map(doc => (
                <DocumentCard key={doc.id} document={doc} featured />
              ))}
            </div>
          </section>
        )}

        {/* Category Filter */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-2 overflow-x-auto">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-lg transition whitespace-nowrap ${
                !selectedCategory
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              All Documents
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-lg transition whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {cat.name} ({cat.documentCount})
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Grid className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <List className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Document Grid */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {searchQuery
              ? 'Search Results'
              : selectedCategory
              ? categories.find(c => c.id === selectedCategory)?.name
              : 'All Documents'}
          </h2>
          {filteredDocs.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg">
              <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchQuery 
                  ? `No documents found matching "${searchQuery}"`
                  : 'No documents found'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <div
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                  : 'space-y-4'
              }
            >
              {filteredDocs.map(doc => (
                <DocumentCard key={doc.id} document={doc} listView={viewMode === 'list'} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

interface DocumentCardProps {
  document: Document
  featured?: boolean
  listView?: boolean
}

function DocumentCard({ document, featured, listView }: DocumentCardProps) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Fallback to ID if slug is not available (for backward compatibility)
  const documentUrl = document.slug ? `/d/${document.slug}` : `/view/${document.id}`

  if (listView) {
    return (
      <Link
        to={documentUrl}
        className="block bg-white rounded-lg shadow-sm hover:shadow-md transition p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1">
            <FileText className="h-10 w-10 text-blue-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {document.name}
              </h3>
              <p className="text-sm text-gray-500">
                {document.totalPages} pages • {document.files.length} file(s) • {formatDate(document.createdAt)}
              </p>
            </div>
          </div>
          {featured && (
            <Star className="h-5 w-5 text-yellow-500 fill-current flex-shrink-0 ml-4" />
          )}
        </div>
      </Link>
    )
  }

  return (
    <Link
      to={documentUrl}
      className="block bg-white rounded-lg shadow-sm hover:shadow-lg transition overflow-hidden"
    >
      <div className="aspect-[3/4] bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center relative">
        {document.thumbnail ? (
          <img src={api.getFileUrl(document.thumbnail)} alt={document.name} className="object-cover w-full h-full" />
        ) : (
          <FileText className="h-24 w-24 text-blue-300" />
        )}
        {featured && (
          <div className="absolute top-2 right-2 bg-yellow-500 text-white px-2 py-1 rounded-full text-xs font-semibold flex items-center space-x-1">
            <Star className="h-3 w-3 fill-current" />
            <span>Featured</span>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 truncate">
          {document.name}
        </h3>
        <p className="text-sm text-gray-500 mb-2">
          {document.totalPages} pages • {document.files.length} file(s)
        </p>
        <p className="text-xs text-gray-400">{formatDate(document.createdAt)}</p>
      </div>
    </Link>
  )
}
