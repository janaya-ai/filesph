import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload,
  Home,
  FileText,
  Folder,
  Star,
  Trash2,
  Edit,
  Plus,
  X,
  LogOut,
  AlertTriangle,
  Building2
} from 'lucide-react'
import { api } from '../utils/api'
import type { Document, Category, Agency } from '../types'

export default function Admin() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'documents' | 'categories' | 'agencies'>('documents')
  const [documents, setDocuments] = useState<Document[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [loading, setLoading] = useState(true)
  const [storageWarning, setStorageWarning] = useState<string | null>(null)

  // Disable AdSense on admin pages
  useEffect(() => {
    // Add data attribute to disable auto-ads on this page
    document.body.setAttribute('data-ad-client', '')
    
    // Also try to remove any existing ad elements
    const adElements = document.querySelectorAll('.adsbygoogle')
    adElements.forEach(el => el.remove())
    
    return () => {
      // Restore when leaving admin
      document.body.removeAttribute('data-ad-client')
    }
  }, [])

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('adminToken')
    if (!token) {
      navigate('/login')
      return
    }
    loadData()
    checkStorageStatus()
  }, [])

  const checkStorageStatus = async () => {
    try {
      const status = await api.getStorageStatus()
      if (status.warning) {
        setStorageWarning(status.warning)
      }
    } catch (error) {
      // Silently fail - don't block the admin UI for this check
      console.error('Failed to check storage status:', error)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    navigate('/login')
  }

  // Upload state
  const [uploadMode, setUploadMode] = useState<'file' | 'r2'>('r2') // Default to R2 mode
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadName, setUploadName] = useState('')
  const [uploadSlug, setUploadSlug] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [uploadTags, setUploadTags] = useState('')
  const [uploadReleaseDate, setUploadReleaseDate] = useState('')
  const [uploadDeadline, setUploadDeadline] = useState('')
  const [uploadSourceAgency, setUploadSourceAgency] = useState('')
  const [uploadAgencyId, setUploadAgencyId] = useState('')
  const [uploadThumbnail, setUploadThumbnail] = useState<File | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [isFeatured, setIsFeatured] = useState(false)
  const [uploading, setUploading] = useState(false)
  // R2 URL mode state (multiple URLs)
  const [r2FileUrls, setR2FileUrls] = useState<string[]>([''])
  const [r2ThumbnailUrl, setR2ThumbnailUrl] = useState('')
  // Related articles state
  const [relatedArticles, setRelatedArticles] = useState<{title: string, url: string}[]>([])

  // Edit document modal state
  const [editDocumentModalOpen, setEditDocumentModalOpen] = useState(false)
  const [editingDocument, setEditingDocument] = useState<Document | null>(null)
  const [editName, setEditName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editReleaseDate, setEditReleaseDate] = useState('')
  const [editDeadline, setEditDeadline] = useState('')
  const [editSourceAgency, setEditSourceAgency] = useState('')
  const [editAgencyId, setEditAgencyId] = useState('')
  const [editCategories, setEditCategories] = useState<string[]>([])
  const [editFeatured, setEditFeatured] = useState(false)
  const [editRelatedArticles, setEditRelatedArticles] = useState<{title: string, url: string}[]>([])
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false)

  // Category modal state
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryName, setCategoryName] = useState('')
  const [categoryDescription, setCategoryDescription] = useState('')

  // Agency modal state
  const [agencyModalOpen, setAgencyModalOpen] = useState(false)
  const [editingAgency, setEditingAgency] = useState<Agency | null>(null)
  const [agencyName, setAgencyName] = useState('')
  const [agencyShortName, setAgencyShortName] = useState('')
  const [agencyDescription, setAgencyDescription] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [docs, cats, agenciesList] = await Promise.all([
        api.getDocuments(),
        api.getCategories(),
        api.getAgencies().catch(() => [])
      ])
      setDocuments(docs)
      setCategories(cats)
      setAgencies(agenciesList)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadFiles(Array.from(e.target.files))
      if (!uploadName && e.target.files.length > 0) {
        setUploadName(e.target.files[0].name.replace(/\.[^/.]+$/, ''))
      }
    }
  }

  const handleUpload = async () => {
    if (uploadMode === 'r2') {
      // Check if files are selected for direct R2 upload
      if (uploadFiles.length > 0) {
        // Direct file upload to R2
        if (!uploadName) {
          alert('Please provide a document name')
          return
        }
        
        if (!uploadAgencyId) {
          alert('Please select an agency')
          return
        }

        try {
          setUploading(true)
          const tags = uploadTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
          const validArticles = relatedArticles.filter(a => a.title.trim() && a.url.trim())
          
          const newDoc = await api.uploadDocumentToR2(
            uploadFiles,
            uploadName,
            selectedCategories,
            isFeatured,
            uploadDescription,
            tags,
            uploadReleaseDate || undefined,
            uploadDeadline || undefined,
            uploadSourceAgency || undefined,
            validArticles.length > 0 ? validArticles : undefined,
            uploadSlug || undefined,
            uploadAgencyId
          )
          
          // Upload custom thumbnail if provided
          if (uploadThumbnail) {
            await api.uploadThumbnailToR2(newDoc.id, uploadThumbnail)
          }
          
          // Reset form
          setUploadFiles([])
          setUploadName('')
          setUploadSlug('')
          setUploadDescription('')
          setUploadTags('')
          setUploadReleaseDate('')
          setUploadDeadline('')
          setUploadSourceAgency('')
          setUploadAgencyId('')
          setUploadThumbnail(null)
          setSelectedCategories([])
          setIsFeatured(false)
          setRelatedArticles([])
          setR2FileUrls([''])
          setR2ThumbnailUrl('')
          await loadData()
          alert('Document uploaded to R2 successfully!')
        } catch (error: any) {
          console.error('Upload failed:', error)
          alert(error.response?.data?.error || 'Failed to upload document')
        } finally {
          setUploading(false)
        }
      } else {
        // R2 URL mode (manual URL entry - fallback)
        const validUrls = r2FileUrls.filter(url => url.trim())
        if (validUrls.length === 0 || !uploadName) {
          alert('Please select files to upload OR provide at least one file URL')
          return
        }

        try {
          setUploading(true)
          const tags = uploadTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
          const validArticles = relatedArticles.filter(a => a.title.trim() && a.url.trim())
          await api.createDocument({
            name: uploadName,
            description: uploadDescription,
            fileUrls: validUrls,
            thumbnailUrl: r2ThumbnailUrl || undefined,
            categories: selectedCategories,
            featured: isFeatured,
            releaseDate: uploadReleaseDate || undefined,
            deadline: uploadDeadline || undefined,
            sourceAgency: uploadSourceAgency || undefined,
            tags,
            relatedArticles: validArticles.length > 0 ? validArticles : undefined
          })
          
          // Reset form
          setR2FileUrls([''])
          setR2ThumbnailUrl('')
          setRelatedArticles([])
          setUploadName('')
          setUploadDescription('')
          setUploadTags('')
          setUploadReleaseDate('')
          setUploadDeadline('')
          setUploadSourceAgency('')
          setSelectedCategories([])
          setIsFeatured(false)
          await loadData()
          alert('Document created successfully!')
        } catch (error) {
          console.error('Create failed:', error)
          alert('Failed to create document')
        } finally {
          setUploading(false)
        }
      }
    } else {
      // Legacy file upload mode
      if (uploadFiles.length === 0 || !uploadName) {
        alert('Please select files and provide a name')
        return
      }

      try {
        setUploading(true)
        const tags = uploadTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
        const newDoc = await api.uploadDocument(uploadFiles, uploadName, selectedCategories, isFeatured, uploadDescription, tags, uploadReleaseDate, uploadDeadline, uploadSourceAgency)
        
        // Upload thumbnail if provided
        if (uploadThumbnail) {
          await api.uploadThumbnail(newDoc.id, uploadThumbnail)
        }
        
        setUploadFiles([])
        setUploadName('')
        setUploadDescription('')
        setUploadTags('')
        setUploadReleaseDate('')
        setUploadDeadline('')
        setUploadSourceAgency('')
        setUploadThumbnail(null)
        setSelectedCategories([])
        setIsFeatured(false)
        await loadData()
        alert('Document uploaded successfully!')
      } catch (error) {
        console.error('Upload failed:', error)
        alert('Failed to upload document')
      } finally {
        setUploading(false)
      }
    }
  }

  const handleDeleteDocument = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return

    try {
      await api.deleteDocument(id)
      await loadData()
    } catch (error) {
      console.error('Delete failed:', error)
      alert('Failed to delete document')
    }
  }

  const handleToggleFeatured = async (doc: Document) => {
    try {
      await api.updateDocument(doc.id, { featured: !doc.featured })
      await loadData()
    } catch (error) {
      console.error('Update failed:', error)
    }
  }

  const openEditDocument = (doc: Document) => {
    setEditingDocument(doc)
    setEditName(doc.name)
    setEditSlug(doc.slug || '')
    setEditDescription(doc.description || '')
    setEditTags(doc.tags?.join(', ') || '')
    setEditReleaseDate(doc.releaseDate || '')
    setEditDeadline(doc.deadline || '')
    setEditSourceAgency(doc.sourceAgency || '')
    setEditAgencyId(doc.agencyId || '')
    setEditCategories(doc.categories)
    setEditFeatured(doc.featured)
    setEditRelatedArticles(doc.relatedArticles || [])
    setThumbnailFile(null)
    setEditDocumentModalOpen(true)
  }

  const handleUploadThumbnail = async () => {
    if (!editingDocument || !thumbnailFile) return

    try {
      setUploadingThumbnail(true)
      await api.uploadThumbnail(editingDocument.id, thumbnailFile)
      setThumbnailFile(null)
      await loadData()
      // Update the editing document with new data
      const updatedDocs = await api.getDocuments()
      const updatedDoc = updatedDocs.find(d => d.id === editingDocument.id)
      if (updatedDoc) {
        setEditingDocument(updatedDoc)
      }
      alert('Thumbnail updated successfully!')
    } catch (error) {
      console.error('Thumbnail upload failed:', error)
      alert('Failed to upload thumbnail')
    } finally {
      setUploadingThumbnail(false)
    }
  }

  const handleSaveDocument = async () => {
    if (!editingDocument || !editName) {
      alert('Please provide a document name')
      return
    }

    try {
      const tags = editTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
      const validArticles = editRelatedArticles.filter(a => a.title.trim() && a.url.trim())
      await api.updateDocument(editingDocument.id, {
        name: editName,
        slug: editSlug || undefined,
        description: editDescription,
        tags,
        releaseDate: editReleaseDate || undefined,
        deadline: editDeadline || undefined,
        sourceAgency: editSourceAgency || undefined,
        agencyId: editAgencyId || undefined,
        categories: editCategories,
        featured: editFeatured,
        relatedArticles: validArticles.length > 0 ? validArticles : undefined
      })
      setEditDocumentModalOpen(false)
      setEditingDocument(null)
      await loadData()
      alert('Document updated successfully!')
    } catch (error) {
      console.error('Update failed:', error)
      alert('Failed to update document')
    }
  }

  const handleSaveCategory = async () => {
    if (!categoryName) {
      alert('Please provide a category name')
      return
    }

    try {
      if (editingCategory) {
        await api.updateCategory(editingCategory.id, {
          name: categoryName,
          description: categoryDescription
        })
      } else {
        await api.createCategory(categoryName, categoryDescription)
      }
      setCategoryModalOpen(false)
      setEditingCategory(null)
      setCategoryName('')
      setCategoryDescription('')
      await loadData()
    } catch (error) {
      console.error('Save failed:', error)
      alert('Failed to save category')
    }
  }

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return

    try {
      await api.deleteCategory(id)
      await loadData()
    } catch (error) {
      console.error('Delete failed:', error)
      alert('Failed to delete category')
    }
  }

  const openEditCategory = (category: Category) => {
    setEditingCategory(category)
    setCategoryName(category.name)
    setCategoryDescription(category.description || '')
    setCategoryModalOpen(true)
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigate('/')}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                <Home className="h-4 w-4" />
                <span>Back to Home</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Storage Warning Banner */}
      {storageWarning && (
        <div className="bg-amber-50 border-l-4 border-amber-400">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-amber-800">
                  Warning: Ephemeral Storage Detected
                </h3>
                <p className="mt-1 text-sm text-amber-700">
                  {storageWarning}
                </p>
                <p className="mt-2 text-sm text-amber-700">
                  <a 
                    href="https://github.com/janaya-ai/filesph/blob/main/DEPLOYMENT.md#persistent-storage-configuration" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="font-medium underline hover:text-amber-800"
                  >
                    Learn how to configure persistent storage →
                  </a>
                </p>
              </div>
              <button
                onClick={() => setStorageWarning(null)}
                className="ml-auto flex-shrink-0"
                aria-label="Dismiss storage warning"
              >
                <X className="h-5 w-5 text-amber-400 hover:text-amber-500" />
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex space-x-4 mb-8 border-b">
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-2 font-semibold transition ${
              activeTab === 'documents'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>Documents</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2 font-semibold transition ${
              activeTab === 'categories'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Folder className="h-4 w-4" />
              <span>Categories</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('agencies')}
            className={`px-4 py-2 font-semibold transition ${
              activeTab === 'agencies'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Building2 className="h-4 w-4" />
              <span>Agencies</span>
            </div>
          </button>
        </div>

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="space-y-8">
            {/* Upload Section */}
            <section className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
                <Upload className="h-5 w-5" />
                <span>Add Document</span>
              </h2>

              {/* Mode Toggle */}
              <div className="mb-6">
                <div className="flex rounded-lg overflow-hidden border border-gray-300 w-fit">
                  <button
                    type="button"
                    onClick={() => setUploadMode('r2')}
                    className={`px-4 py-2 text-sm font-medium transition ${
                      uploadMode === 'r2'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Upload to R2
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode('file')}
                    className={`px-4 py-2 text-sm font-medium transition ${
                      uploadMode === 'file'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Local Storage (Legacy)
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {uploadMode === 'r2' 
                    ? 'Upload files directly to Cloudflare R2 storage - recommended'
                    : 'Upload files to local server storage (legacy mode)'}
                </p>
              </div>
              
              <div className="space-y-4">
                {/* R2 Upload Section */}
                {uploadMode === 'r2' && (
                  <>
                    {/* Direct File Upload */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Files <span className="text-red-500">*</span>
                      </label>
                      <p className="mb-2 text-xs text-gray-500">
                        Files will be uploaded directly to R2 storage. Supports: PDF, DOCX, JPG, PNG, GIF, WebP
                      </p>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.gif,.webp"
                        onChange={handleFileSelect}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      {uploadFiles.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm text-green-600 font-medium">
                            {uploadFiles.length} file(s) selected:
                          </p>
                          <ul className="mt-1 text-xs text-gray-600 list-disc list-inside">
                            {uploadFiles.map((f, i) => (
                              <li key={i}>{f.name} ({(f.size / 1024 / 1024).toFixed(2)} MB)</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* OR divider */}
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="bg-white px-2 text-gray-500">OR paste URLs manually</span>
                      </div>
                    </div>

                    {/* Manual URL Input (fallback) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        File URLs (if already uploaded to R2)
                      </label>
                      <div className="space-y-2">
                        {r2FileUrls.map((url, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="url"
                              value={url}
                              onChange={(e) => {
                                const newUrls = [...r2FileUrls]
                                newUrls[index] = e.target.value
                                setR2FileUrls(newUrls)
                              }}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder={`https://pub-xxxx.r2.dev/file${index + 1}.pdf`}
                              disabled={uploadFiles.length > 0}
                            />
                            {r2FileUrls.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newUrls = r2FileUrls.filter((_, i) => i !== index)
                                  setR2FileUrls(newUrls)
                                }}
                                className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Remove URL"
                                disabled={uploadFiles.length > 0}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {uploadFiles.length === 0 && (
                        <button
                          type="button"
                          onClick={() => setR2FileUrls([...r2FileUrls, ''])}
                          className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <span>+</span> Add another file URL
                        </button>
                      )}
                      {uploadFiles.length > 0 && (
                        <p className="mt-2 text-xs text-gray-400">
                          URL input disabled when files are selected
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Thumbnail (optional)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setUploadThumbnail(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
                      />
                      {uploadThumbnail && (
                        <p className="mt-1 text-xs text-green-600">Thumbnail: {uploadThumbnail.name}</p>
                      )}
                      <p className="mt-1 text-xs text-gray-400">
                        Or paste URL below (if already uploaded):
                      </p>
                      <input
                        type="url"
                        value={r2ThumbnailUrl}
                        onChange={(e) => setR2ThumbnailUrl(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="https://pub-xxxx.r2.dev/thumbnail.jpg"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Leave empty to use first image as thumbnail, or placeholder for PDFs/docs
                      </p>
                    </div>

                    {/* Related Articles Section */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Related Guides / Articles (optional)
                      </label>
                      <p className="text-xs text-gray-500 mb-2">
                        Link to blog posts or guides related to this document
                      </p>
                      {relatedArticles.map((article, index) => (
                        <div key={index} className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={article.title}
                            onChange={(e) => {
                              const updated = [...relatedArticles]
                              updated[index] = { ...updated[index], title: e.target.value }
                              setRelatedArticles(updated)
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Link title (e.g., How to Fill Out PDS)"
                          />
                          <input
                            type="url"
                            value={article.url}
                            onChange={(e) => {
                              const updated = [...relatedArticles]
                              updated[index] = { ...updated[index], url: e.target.value }
                              setRelatedArticles(updated)
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="https://example.com/article"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setRelatedArticles(relatedArticles.filter((_, i) => i !== index))
                            }}
                            className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setRelatedArticles([...relatedArticles, { title: '', url: '' }])}
                        className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <span>+</span> Add related article
                      </button>
                    </div>
                  </>
                )}

                {/* File Upload Input (when in file mode) */}
                {uploadMode === 'file' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Files (PDF, JPG, PNG, TXT)
                    </label>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.txt"
                      onChange={handleFileSelect}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {uploadFiles.length > 0 && (
                      <p className="mt-2 text-sm text-gray-600">
                        {uploadFiles.length} file(s) selected
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document Name
                  </label>
                  <input
                    type="text"
                    value={uploadName}
                    onChange={(e) => setUploadName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter document name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Custom URL Slug (optional)
                  </label>
                  <div className="flex items-center">
                    <span className="text-gray-500 text-sm mr-1">filesph.com/d/</span>
                    <input
                      type="text"
                      value={uploadSlug}
                      onChange={(e) => setUploadSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="leave-blank-to-auto-generate"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Leave blank to auto-generate from document name</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter document description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags (optional, comma-separated)
                  </label>
                  <input
                    type="text"
                    value={uploadTags}
                    onChange={(e) => setUploadTags(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., report, 2024, finance"
                  />
                  {uploadTags && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {uploadTags.split(',').map((tag, index) => {
                        const trimmedTag = tag.trim()
                        if (!trimmedTag) return null
                        return (
                          <span key={index} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                            {trimmedTag}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Release Date (optional)
                    </label>
                    <input
                      type="date"
                      value={uploadReleaseDate}
                      onChange={(e) => setUploadReleaseDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Deadline (optional)
                    </label>
                    <input
                      type="date"
                      value={uploadDeadline}
                      onChange={(e) => setUploadDeadline(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Agency Selection (Required) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Agency <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={uploadAgencyId}
                    onChange={(e) => setUploadAgencyId(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      !uploadAgencyId ? 'border-gray-300' : 'border-green-300 bg-green-50'
                    }`}
                  >
                    <option value="">-- Select Agency --</option>
                    {agencies.map(agency => (
                      <option key={agency.id} value={agency.id}>
                        {agency.shortName} - {agency.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Select the government agency that issued this document
                  </p>
                </div>

                {/* Source Agency */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Source Agency (optional)
                  </label>
                  <input
                    type="text"
                    value={uploadSourceAgency}
                    onChange={(e) => setUploadSourceAgency(e.target.value)}
                    placeholder="e.g., Civil Service Commission, DOLE, DepEd"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Thumbnail Upload (only for file mode) */}
                {uploadMode === 'file' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Thumbnail Image (optional)
                  </label>
                  <div className="flex items-start space-x-4">
                    <div className="w-20 h-28 bg-gradient-to-br from-blue-50 to-blue-100 rounded flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-200">
                      {uploadThumbnail ? (
                        <img 
                          src={URL.createObjectURL(uploadThumbnail)} 
                          alt="Thumbnail preview" 
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <FileText className="h-6 w-6 text-blue-300" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png"
                        onChange={(e) => setUploadThumbnail(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      <p className="text-xs text-gray-500">
                        Recommended size: <strong>400×600 pixels</strong> (2:3 ratio). Will be resized automatically.
                      </p>
                      {uploadThumbnail && (
                        <button
                          type="button"
                          onClick={() => setUploadThumbnail(null)}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          Remove thumbnail
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Categories
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => (
                      <label key={cat.id} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(cat.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCategories([...selectedCategories, cat.id])
                            } else {
                              setSelectedCategories(selectedCategories.filter(id => id !== cat.id))
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{cat.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isFeatured}
                      onChange={(e) => setIsFeatured(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-medium text-gray-700">Mark as Featured</span>
                  </label>
                </div>

                <button
                  onClick={handleUpload}
                  disabled={uploading || (uploadMode === 'file' ? uploadFiles.length === 0 : (uploadFiles.length === 0 && r2FileUrls.filter(u => u.trim()).length === 0)) || !uploadName}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Uploading to R2...' : (uploadMode === 'r2' ? (uploadFiles.length > 0 ? 'Upload to R2' : 'Create Document') : 'Upload Document')}
                </button>
              </div>
            </section>

            {/* Documents List */}
            <section className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">All Documents</h2>
              <div className="space-y-4">
                {documents.map(doc => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center space-x-4 flex-1">
                      <FileText className="h-8 w-8 text-blue-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                          {doc.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {doc.fileUrls && doc.fileUrls.length > 0 ? (
                            <span className="inline-flex items-center">
                              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded mr-2">R2</span>
                              {doc.fileUrls.length} file(s)
                            </span>
                          ) : doc.fileUrl ? (
                            <span className="inline-flex items-center">
                              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded mr-2">R2</span>
                              1 file
                            </span>
                          ) : (
                            <span>{doc.totalPages} pages • {doc.files?.length || 0} file(s)</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleToggleFeatured(doc)}
                        className={`p-2 rounded-lg transition ${
                          doc.featured
                            ? 'bg-yellow-100 text-yellow-600'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                        title={doc.featured ? 'Remove from featured' : 'Mark as featured'}
                      >
                        <Star className={`h-5 w-5 ${doc.featured ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        onClick={() => openEditDocument(doc)}
                        className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition"
                        title="Edit document"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => navigate(`/view/${doc.id}`)}
                        className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition"
                        title="View document"
                      >
                        <FileText className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                        title="Delete document"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div className="space-y-8">
            <section className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Categories</h2>
                <button
                  onClick={() => {
                    setEditingCategory(null)
                    setCategoryName('')
                    setCategoryDescription('')
                    setCategoryModalOpen(true)
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <Plus className="h-4 w-4" />
                  <span>New Category</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map(cat => (
                  <div
                    key={cat.id}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">{cat.name}</h3>
                        <p className="text-sm text-gray-500">{cat.documentCount} documents</p>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => openEditCategory(cat)}
                          className="p-1 text-gray-400 hover:text-blue-600 transition"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="p-1 text-gray-400 hover:text-red-600 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {cat.description && (
                      <p className="text-sm text-gray-600">{cat.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Agencies Tab */}
        {activeTab === 'agencies' && (
          <div className="space-y-8">
            <section className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                  <Building2 className="h-5 w-5" />
                  <span>Government Agencies</span>
                </h2>
                <button
                  onClick={() => {
                    setEditingAgency(null)
                    setAgencyName('')
                    setAgencyShortName('')
                    setAgencyDescription('')
                    setAgencyModalOpen(true)
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <Plus className="h-4 w-4" />
                  <span>New Agency</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {agencies.map(agency => (
                  <div
                    key={agency.id}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">{agency.shortName}</h3>
                        <p className="text-sm text-gray-600">{agency.name}</p>
                        <p className="text-xs text-gray-500 mt-1">{agency.documentCount} documents</p>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => {
                            setEditingAgency(agency)
                            setAgencyName(agency.name)
                            setAgencyShortName(agency.shortName)
                            setAgencyDescription(agency.description || '')
                            setAgencyModalOpen(true)
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600 transition"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Delete "${agency.shortName}"? Documents will be unlinked.`)) return
                            try {
                              await api.deleteAgency(agency.id)
                              await loadData()
                            } catch (error) {
                              console.error('Delete failed:', error)
                              alert('Failed to delete agency')
                            }
                          }}
                          className="p-1 text-gray-400 hover:text-red-600 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {agency.description && (
                      <p className="text-sm text-gray-500 line-clamp-2">{agency.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Agency Modal */}
      {agencyModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                {editingAgency ? 'Edit Agency' : 'New Agency'}
              </h3>
              <button
                onClick={() => setAgencyModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Short Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={agencyShortName}
                  onChange={(e) => setAgencyShortName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., CSC, SSS, DFA"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Civil Service Commission"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={agencyDescription}
                  onChange={(e) => setAgencyDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Brief description of the agency"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={async () => {
                    if (!agencyShortName || !agencyName) {
                      alert('Please provide both short name and full name')
                      return
                    }
                    try {
                      if (editingAgency) {
                        await api.updateAgency(editingAgency.id, {
                          name: agencyName,
                          shortName: agencyShortName,
                          description: agencyDescription || undefined
                        })
                      } else {
                        await api.createAgency(agencyName, agencyShortName, agencyDescription || undefined)
                      }
                      setAgencyModalOpen(false)
                      setEditingAgency(null)
                      setAgencyName('')
                      setAgencyShortName('')
                      setAgencyDescription('')
                      await loadData()
                    } catch (error) {
                      console.error('Save failed:', error)
                      alert('Failed to save agency')
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Save
                </button>
                <button
                  onClick={() => setAgencyModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {categoryModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                {editingCategory ? 'Edit Category' : 'New Category'}
              </h3>
              <button
                onClick={() => setCategoryModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category Name
                </label>
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter category name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={categoryDescription}
                  onChange={(e) => setCategoryDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter description"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleSaveCategory}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Save
                </button>
                <button
                  onClick={() => setCategoryModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Document Modal */}
      {editDocumentModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Edit Document</h3>
              <button
                onClick={() => setEditDocumentModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter document name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL Slug
                </label>
                <div className="flex items-center">
                  <span className="text-gray-500 text-sm mr-1">filesph.com/d/</span>
                  <input
                    type="text"
                    value={editSlug}
                    onChange={(e) => setEditSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="document-slug"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter document description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags (optional, comma-separated)
                </label>
                <input
                  type="text"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., report, 2024, finance"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Release Date (optional)
                  </label>
                  <input
                    type="date"
                    value={editReleaseDate}
                    onChange={(e) => setEditReleaseDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Deadline (optional)
                  </label>
                  <input
                    type="date"
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Agency
                </label>
                <select
                  value={editAgencyId}
                  onChange={(e) => setEditAgencyId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Select Agency --</option>
                  {agencies.map(agency => (
                    <option key={agency.id} value={agency.id}>
                      {agency.shortName} - {agency.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Source Agency (optional - legacy text field)
                </label>
                <input
                  type="text"
                  value={editSourceAgency}
                  onChange={(e) => setEditSourceAgency(e.target.value)}
                  placeholder="e.g., Civil Service Commission, DOLE, DepEd"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categories
                </label>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <label key={cat.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editCategories.includes(cat.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditCategories([...editCategories, cat.id])
                          } else {
                            setEditCategories(editCategories.filter(id => id !== cat.id))
                          }
                        }}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{cat.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editFeatured}
                    onChange={(e) => setEditFeatured(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium text-gray-700">Mark as Featured</span>
                </label>
              </div>

              {/* Related Articles Section */}
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Related Guides / Articles (optional)
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Link to blog posts or guides related to this document
                </p>
                {editRelatedArticles.map((article, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={article.title}
                      onChange={(e) => {
                        const updated = [...editRelatedArticles]
                        updated[index] = { ...updated[index], title: e.target.value }
                        setEditRelatedArticles(updated)
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="Link title (e.g., How to Fill Out PDS)"
                    />
                    <input
                      type="url"
                      value={article.url}
                      onChange={(e) => {
                        const updated = [...editRelatedArticles]
                        updated[index] = { ...updated[index], url: e.target.value }
                        setEditRelatedArticles(updated)
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="https://example.com/article"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setEditRelatedArticles(editRelatedArticles.filter((_, i) => i !== index))
                      }}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setEditRelatedArticles([...editRelatedArticles, { title: '', url: '' }])}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <span>+</span> Add related article
                </button>
              </div>

              {/* Thumbnail Upload Section */}
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Thumbnail
                </label>
                <div className="flex items-start space-x-4">
                  <div className="w-24 h-32 bg-gradient-to-br from-blue-50 to-blue-100 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {editingDocument?.thumbnailUrl || editingDocument?.thumbnail ? (
                      <img 
                        src={editingDocument.thumbnailUrl || (editingDocument.thumbnail ? api.getFileUrl(editingDocument.thumbnail) : '')} 
                        alt="Current thumbnail" 
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <FileText className="h-8 w-8 text-blue-300" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png"
                      onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {thumbnailFile && (
                      <button
                        onClick={handleUploadThumbnail}
                        disabled={uploadingThumbnail}
                        className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition disabled:bg-gray-400"
                      >
                        {uploadingThumbnail ? 'Uploading...' : 'Upload Thumbnail'}
                      </button>
                    )}
                    <p className="text-xs text-gray-500">
                      Recommended size: <strong>400×600 pixels</strong> (2:3 ratio). Will be resized automatically.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleSaveDocument}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setEditDocumentModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
