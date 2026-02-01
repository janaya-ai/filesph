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
  AlertTriangle
} from 'lucide-react'
import { api } from '../utils/api'
import type { Document, Category } from '../types'

export default function Admin() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'documents' | 'categories'>('documents')
  const [documents, setDocuments] = useState<Document[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [storageWarning, setStorageWarning] = useState<string | null>(null)

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
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadName, setUploadName] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [uploadTags, setUploadTags] = useState('')
  const [uploadReleaseDate, setUploadReleaseDate] = useState('')
  const [uploadDeadline, setUploadDeadline] = useState('')
  const [uploadSourceAgency, setUploadSourceAgency] = useState('')
  const [uploadThumbnail, setUploadThumbnail] = useState<File | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [isFeatured, setIsFeatured] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Edit document modal state
  const [editDocumentModalOpen, setEditDocumentModalOpen] = useState(false)
  const [editingDocument, setEditingDocument] = useState<Document | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editReleaseDate, setEditReleaseDate] = useState('')
  const [editDeadline, setEditDeadline] = useState('')
  const [editSourceAgency, setEditSourceAgency] = useState('')
  const [editCategories, setEditCategories] = useState<string[]>([])
  const [editFeatured, setEditFeatured] = useState(false)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false)

  // Category modal state
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryName, setCategoryName] = useState('')
  const [categoryDescription, setCategoryDescription] = useState('')

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadFiles(Array.from(e.target.files))
      if (!uploadName && e.target.files.length > 0) {
        setUploadName(e.target.files[0].name.replace(/\.[^/.]+$/, ''))
      }
    }
  }

  const handleUpload = async () => {
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
    setEditDescription(doc.description || '')
    setEditTags(doc.tags?.join(', ') || '')
    setEditReleaseDate(doc.releaseDate || '')
    setEditDeadline(doc.deadline || '')
    setEditSourceAgency(doc.sourceAgency || '')
    setEditCategories(doc.categories)
    setEditFeatured(doc.featured)
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
      await api.updateDocument(editingDocument.id, {
        name: editName,
        description: editDescription,
        tags,
        releaseDate: editReleaseDate || undefined,
        deadline: editDeadline || undefined,
        sourceAgency: editSourceAgency || undefined,
        categories: editCategories,
        featured: editFeatured
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
        </div>

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="space-y-8">
            {/* Upload Section */}
            <section className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
                <Upload className="h-5 w-5" />
                <span>Upload Documents</span>
              </h2>
              
              <div className="space-y-4">
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

                {/* Thumbnail Upload */}
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
                  disabled={uploading || uploadFiles.length === 0}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Uploading...' : 'Upload Document'}
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
                          {doc.totalPages} pages • {doc.files.length} file(s)
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
      </main>

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
                  Source Agency (optional)
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

              {/* Thumbnail Upload Section */}
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Thumbnail
                </label>
                <div className="flex items-start space-x-4">
                  <div className="w-24 h-32 bg-gradient-to-br from-blue-50 to-blue-100 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {editingDocument?.thumbnail ? (
                      <img 
                        src={api.getFileUrl(editingDocument.thumbnail)} 
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
