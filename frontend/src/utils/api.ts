import axios from 'axios'
import type { Document, Category, RelatedArticle } from '../types'

const API_BASE = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api'

export interface CreateDocumentData {
  name: string
  description?: string
  // Single file URL (legacy)
  fileUrl?: string
  // Multiple file URLs (new)
  fileUrls?: string[]
  thumbnailUrl?: string
  categories: string[]
  featured: boolean
  releaseDate?: string
  deadline?: string
  sourceAgency?: string
  tags?: string[]
  // Related blog articles/guides
  relatedArticles?: RelatedArticle[]
}

export const api = {
  // Authentication
  async login(password: string): Promise<{ token: string; success: boolean }> {
    const response = await axios.post(`${API_BASE}/auth/login`, { password })
    return response.data
  },

  // Documents
  async getDocuments(): Promise<Document[]> {
    const response = await axios.get(`${API_BASE}/documents`)
    return response.data
  },

  async getDocument(id: string): Promise<Document> {
    const response = await axios.get(`${API_BASE}/documents/${id}`)
    return response.data
  },

  async getPopularDocuments(limit: number = 5): Promise<Document[]> {
    const response = await axios.get(`${API_BASE}/documents/stats/popular?limit=${limit}`)
    return response.data
  },

  async getRecentDocuments(limit: number = 5): Promise<Document[]> {
    const response = await axios.get(`${API_BASE}/documents/stats/recent?limit=${limit}`)
    return response.data
  },

  async getRelatedDocuments(id: string, limit: number = 6): Promise<Document[]> {
    const response = await axios.get(`${API_BASE}/documents/${id}/related?limit=${limit}`)
    return response.data
  },

  async trackView(id: string): Promise<{ views: number }> {
    const response = await axios.post(`${API_BASE}/documents/${id}/view`)
    return response.data
  },

  async trackDownload(id: string): Promise<{ downloads: number }> {
    const response = await axios.post(`${API_BASE}/documents/${id}/download`)
    return response.data
  },

  // Create document with R2 URL
  async createDocument(data: CreateDocumentData): Promise<Document> {
    const response = await axios.post(`${API_BASE}/documents`, data)
    return response.data
  },

  // Legacy file upload (kept for backward compatibility)
  async uploadDocument(files: File[], name: string, categories: string[], featured: boolean, description?: string, tags?: string[], releaseDate?: string, deadline?: string, sourceAgency?: string): Promise<Document> {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    formData.append('name', name)
    formData.append('categories', JSON.stringify(categories))
    formData.append('featured', String(featured))
    if (description) formData.append('description', description)
    if (tags && tags.length > 0) formData.append('tags', JSON.stringify(tags))
    if (releaseDate) formData.append('releaseDate', releaseDate)
    if (deadline) formData.append('deadline', deadline)
    if (sourceAgency) formData.append('sourceAgency', sourceAgency)

    const response = await axios.post(`${API_BASE}/documents/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  },

  // Upload files directly to R2 storage
  async uploadDocumentToR2(
    files: File[], 
    name: string, 
    categories: string[], 
    featured: boolean, 
    description?: string, 
    tags?: string[], 
    releaseDate?: string, 
    deadline?: string, 
    sourceAgency?: string,
    relatedArticles?: { title: string; url: string }[]
  ): Promise<Document> {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    formData.append('name', name)
    formData.append('categories', JSON.stringify(categories))
    formData.append('featured', String(featured))
    if (description) formData.append('description', description)
    if (tags && tags.length > 0) formData.append('tags', JSON.stringify(tags))
    if (releaseDate) formData.append('releaseDate', releaseDate)
    if (deadline) formData.append('deadline', deadline)
    if (sourceAgency) formData.append('sourceAgency', sourceAgency)
    if (relatedArticles && relatedArticles.length > 0) {
      formData.append('relatedArticles', JSON.stringify(relatedArticles))
    }

    const response = await axios.post(`${API_BASE}/documents/upload-r2`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  },

  // Upload thumbnail to R2
  async uploadThumbnailToR2(documentId: string, file: File): Promise<{ thumbnailUrl: string }> {
    const formData = new FormData()
    formData.append('thumbnail', file)
    const response = await axios.post(`${API_BASE}/documents/${documentId}/thumbnail-r2`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  },

  // Check R2 configuration status
  async getR2Status(): Promise<{ configured: boolean; bucketName: string | null; publicUrl: string | null }> {
    const response = await axios.get(`${API_BASE}/r2-status`)
    return response.data
  },

  async updateDocument(id: string, data: Partial<Document>): Promise<Document> {
    const response = await axios.patch(`${API_BASE}/documents/${id}`, data)
    return response.data
  },

  async deleteDocument(id: string): Promise<void> {
    await axios.delete(`${API_BASE}/documents/${id}`)
  },

  // Categories
  async getCategories(): Promise<Category[]> {
    const response = await axios.get(`${API_BASE}/categories`)
    return response.data
  },

  async createCategory(name: string, description?: string): Promise<Category> {
    const response = await axios.post(`${API_BASE}/categories`, { name, description })
    return response.data
  },

  async updateCategory(id: string, data: Partial<Category>): Promise<Category> {
    const response = await axios.patch(`${API_BASE}/categories/${id}`, data)
    return response.data
  },

  async deleteCategory(id: string): Promise<void> {
    await axios.delete(`${API_BASE}/categories/${id}`)
  },

  // Thumbnails
  async uploadThumbnail(documentId: string, file: File): Promise<{ thumbnail: string }> {
    const formData = new FormData()
    formData.append('thumbnail', file)
    const response = await axios.post(`${API_BASE}/documents/${documentId}/thumbnail`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  },

  // Files
  getFileUrl(filename: string): string {
    // If it's already a full URL (R2), return as-is
    if (filename.startsWith('http://') || filename.startsWith('https://')) {
      return filename
    }
    return `${API_BASE}/files/${filename}`
  },

  // Storage status
  async getStorageStatus(): Promise<{ persistent: boolean; warning: string | null }> {
    const response = await axios.get(`${API_BASE}/storage-status`)
    return response.data
  }
}
