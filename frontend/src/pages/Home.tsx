import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { 
  FileText, 
  Search, 
  Menu, 
  X, 
  Star, 
  TrendingUp, 
  Clock, 
  ChevronRight,
  FileCheck,
  Briefcase,
  Award,
  BookOpen,
  Building2,
  Newspaper,
  Eye
} from 'lucide-react'
import { api } from '../utils/api'
import type { Document, Category } from '../types'

// Category icons mapping
const categoryIcons: Record<string, React.ReactNode> = {
  'government-forms': <FileCheck className="h-8 w-8" />,
  'job-hiring': <Briefcase className="h-8 w-8" />,
  'list-of-passers': <Award className="h-8 w-8" />,
  'scholarship': <BookOpen className="h-8 w-8" />,
  'memos-circulars': <Newspaper className="h-8 w-8" />,
  'agencies': <Building2 className="h-8 w-8" />,
  'default': <FileText className="h-8 w-8" />
}

// Get icon for category
function getCategoryIcon(categoryId: string, categoryName: string): React.ReactNode {
  const normalizedId = categoryId.toLowerCase().replace(/\s+/g, '-')
  const normalizedName = categoryName.toLowerCase().replace(/\s+/g, '-')
  return categoryIcons[normalizedId] || categoryIcons[normalizedName] || categoryIcons['default']
}

export default function Home() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<Category[]>([])
  const [featuredDocs, setFeaturedDocs] = useState<Document[]>([])
  const [popularDocs, setPopularDocs] = useState<Document[]>([])
  const [recentDocs, setRecentDocs] = useState<Document[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [allDocs, cats, popular, recent] = await Promise.all([
        api.getDocuments(),
        api.getCategories(),
        api.getPopularDocuments(5).catch(() => []),
        api.getRecentDocuments(5).catch(() => [])
      ])
      
      // Get featured documents (max 6)
      const featured = allDocs.filter(doc => doc.featured).slice(0, 6)
      
      // If popular/recent APIs fail, fall back to computing from allDocs
      const popularFallback = popular.length > 0 ? popular : [...allDocs]
        .sort((a, b) => ((b.views || 0) + (b.downloads || 0)) - ((a.views || 0) + (a.downloads || 0)))
        .slice(0, 5)
      
      const recentFallback = recent.length > 0 ? recent : [...allDocs]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
      
      setCategories(cats)
      setFeaturedDocs(featured)
      setPopularDocs(popularFallback)
      setRecentDocs(recentFallback)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

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
        <title>FilesPH – Philippine Public Documents & Forms</title>
        <meta name="description" content="Search, view, and download official government documents, job notices, and public records. Your trusted source for Philippine public documents." />
        <meta name="keywords" content="Philippine documents, government forms, job hiring, civil service, public records, FilesPH" />
      </Helmet>
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex justify-between items-center">
            <Link to="/" className="flex items-center space-x-2">
              <FileText className="h-7 w-7 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">FilesPH</span>
            </Link>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-6">
              <Link to="/" className="text-gray-700 hover:text-blue-600 transition font-medium">Home</Link>
              <a href="#categories" className="text-gray-700 hover:text-blue-600 transition font-medium">Categories</a>
              <Link to="/about" className="text-gray-700 hover:text-blue-600 transition font-medium">About</Link>
              <Link to="/login" className="text-gray-600 hover:text-blue-600 transition text-sm">Admin</Link>
            </nav>
            
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition"
              aria-label="Menu"
            >
              {menuOpen ? <X className="h-6 w-6 text-gray-700" /> : <Menu className="h-6 w-6 text-gray-700" />}
            </button>
          </div>
        </div>
        
        {/* Mobile Dropdown Menu */}
        {menuOpen && (
          <div className="md:hidden bg-white border-t shadow-lg">
            <nav className="max-w-7xl mx-auto px-4 py-2 flex flex-col space-y-1">
              <Link to="/" onClick={() => setMenuOpen(false)} className="px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition font-medium">Home</Link>
              <a href="#categories" onClick={() => setMenuOpen(false)} className="px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition font-medium">Categories</a>
              <Link to="/about" onClick={() => setMenuOpen(false)} className="px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition font-medium">About</Link>
              <Link to="/login" onClick={() => setMenuOpen(false)} className="px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition font-medium">Admin Login</Link>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white py-16 md:py-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-3xl md:text-5xl font-bold mb-4">
              FilesPH – Philippine Public Documents & Forms
            </h1>
            <p className="text-lg md:text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Search, view, and download official government documents, job notices, and public records.
            </p>
            
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-12 pr-28 py-4 border-0 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-blue-300 shadow-lg text-lg"
                  placeholder="Search documents, agencies, or keywords…"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  Search
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Categories Section */}
        <section id="categories" className="py-12 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Browse by Category</h2>
            </div>
            
            {categories.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No categories available yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {categories.slice(0, 8).map(category => (
                  <Link
                    key={category.id}
                    to={`/search?category=${category.id}`}
                    className="group bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-xl p-6 transition-all duration-200 hover:shadow-md"
                  >
                    <div className="text-blue-600 mb-3 group-hover:scale-110 transition-transform">
                      {getCategoryIcon(category.id, category.name)}
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-700 transition">
                      {category.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {category.documentCount} document{category.documentCount !== 1 ? 's' : ''}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Featured Documents Section */}
        {featuredDocs.length > 0 && (
          <section className="py-12 md:py-16 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center space-x-2 mb-8">
                <Star className="h-6 w-6 text-yellow-500 fill-current" />
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Featured Documents</h2>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {featuredDocs.map(doc => (
                  <DocumentCard key={doc.id} document={doc} categories={categories} featured />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Two Column Section: Popular + Recent */}
        <section className="py-12 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
              
              {/* Popular Documents */}
              <div>
                <div className="flex items-center space-x-2 mb-6">
                  <TrendingUp className="h-5 w-5 text-orange-500" />
                  <h2 className="text-xl font-bold text-gray-900">Popular Documents</h2>
                </div>
                
                {popularDocs.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-xl">
                    <p className="text-gray-500 text-sm">No popular documents yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {popularDocs.slice(0, 5).map((doc, index) => (
                      <CompactDocumentCard key={doc.id} document={doc} categories={categories} rank={index + 1} />
                    ))}
                  </div>
                )}
              </div>

              {/* Recently Added */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-5 w-5 text-green-500" />
                    <h2 className="text-xl font-bold text-gray-900">Recently Added</h2>
                  </div>
                  <Link to="/search" className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center space-x-1">
                    <span>View all</span>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
                
                {recentDocs.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-xl">
                    <p className="text-gray-500 text-sm">No documents yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentDocs.slice(0, 5).map(doc => (
                      <CompactDocumentCard key={doc.id} document={doc} categories={categories} showDate />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12 bg-blue-600">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Can't find what you're looking for?
            </h2>
            <p className="text-blue-100 mb-6">
              Browse all documents or use our search to find exactly what you need.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/search"
                className="px-6 py-3 bg-white text-blue-600 rounded-lg hover:bg-gray-100 transition font-medium"
              >
                Browse All Documents
              </Link>
              <a
                href="#categories"
                className="px-6 py-3 border-2 border-white text-white rounded-lg hover:bg-white/10 transition font-medium"
              >
                Explore Categories
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <FileText className="h-8 w-8 text-blue-400" />
              <h2 className="text-2xl font-bold">FilesPH</h2>
            </div>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              Independent platform for accessing public documents
            </p>
            <div className="flex items-center justify-center space-x-6 mb-8">
              <Link to="/about" className="text-gray-400 hover:text-white transition">About</Link>
              <span className="text-gray-600">|</span>
              <Link to="/privacy-policy" className="text-gray-400 hover:text-white transition">Privacy Policy</Link>
              <span className="text-gray-600">|</span>
              <Link to="/terms-of-service" className="text-gray-400 hover:text-white transition">Terms</Link>
            </div>
            <p className="text-gray-500 text-sm">
              © 2026 FilesPH
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

// Featured Document Card Component
interface DocumentCardProps {
  document: Document
  categories: Category[]
  featured?: boolean
}

function DocumentCard({ document, categories, featured }: DocumentCardProps) {
  const categoryNames = document.categories
    .map(catId => categories.find(c => c.id === catId)?.name)
    .filter(Boolean)
    .join(', ')

  const documentUrl = document.slug ? `/d/${document.slug}` : `/view/${document.id}`

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden border border-gray-100">
      {/* Thumbnail */}
      <div className="aspect-[16/10] bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center relative overflow-hidden">
        {document.thumbnail ? (
          <img 
            src={api.getFileUrl(document.thumbnail)} 
            alt={document.name} 
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <FileText className="h-12 w-12 text-blue-300" />
        )}
        {featured && (
          <div className="absolute top-3 left-3 bg-yellow-500 text-white px-2.5 py-1 rounded-full text-xs font-semibold flex items-center space-x-1">
            <Star className="h-3 w-3 fill-current" />
            <span>Featured</span>
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 leading-snug">
          {document.name}
        </h3>
        
        {document.sourceAgency && (
          <p className="text-sm text-gray-500 mb-2 flex items-center space-x-1">
            <Building2 className="h-3.5 w-3.5" />
            <span>{document.sourceAgency}</span>
          </p>
        )}
        
        {categoryNames && (
          <p className="text-sm text-blue-600 font-medium mb-2">
            {categoryNames}
          </p>
        )}
        
        <p className="text-xs text-gray-400 mb-3">
          {formatDate(document.createdAt)}
        </p>
        
        <div className="flex items-center space-x-2">
          <Link
            to={documentUrl}
            className="flex-1 px-4 py-2 bg-blue-600 text-white text-center text-sm rounded-lg hover:bg-blue-700 transition font-medium"
          >
            View Document
          </Link>
        </div>
      </div>
    </div>
  )
}

// Compact Document Card for Lists
interface CompactDocumentCardProps {
  document: Document
  categories: Category[]
  rank?: number
  showDate?: boolean
}

function CompactDocumentCard({ document, categories, rank, showDate }: CompactDocumentCardProps) {
  const categoryName = document.categories
    .map(catId => categories.find(c => c.id === catId)?.name)
    .filter(Boolean)[0] || 'Uncategorized'

  const documentUrl = document.slug ? `/d/${document.slug}` : `/view/${document.id}`

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <Link
      to={documentUrl}
      className="flex items-start space-x-4 p-4 bg-gray-50 hover:bg-blue-50 rounded-xl transition-all duration-200 group"
    >
      {/* Rank or Thumbnail */}
      {rank ? (
        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">
          {rank}
        </div>
      ) : (
        <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex items-center justify-center overflow-hidden">
          {document.thumbnail ? (
            <img 
              src={api.getFileUrl(document.thumbnail)} 
              alt="" 
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <FileText className="h-5 w-5 text-blue-300" />
          )}
        </div>
      )}
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-gray-900 group-hover:text-blue-700 transition line-clamp-1 mb-1">
          {document.name}
        </h3>
        <div className="flex items-center space-x-3 text-xs text-gray-500">
          <span className="text-blue-600 font-medium">{categoryName}</span>
          {showDate && (
            <>
              <span>•</span>
              <span>{formatDate(document.createdAt)}</span>
            </>
          )}
          {!showDate && document.views !== undefined && document.views > 0 && (
            <>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <Eye className="h-3 w-3" />
                <span>{document.views} views</span>
              </span>
            </>
          )}
        </div>
      </div>
      
      {/* Arrow */}
      <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition flex-shrink-0" />
    </Link>
  )
}
