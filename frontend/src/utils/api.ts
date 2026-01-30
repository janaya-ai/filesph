import axios from 'axios'
import type { Document, Category } from '../types'

const API_BASE = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

export const api = {
  // Documents
  async getDocuments(): Promise<Document[]> {
    const response = await axios.get(`${API_BASE}/documents`)
    return response.data
  },

  async getDocument(id: string): Promise<Document> {
    const response = await axios.get(`${API_BASE}/documents/${id}`)
    return response.data
  },

  async uploadDocument(files: File[], categories: string[], featured: boolean, description?: string, tags?: string[]): Promise<Document> {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    formData.append('categories', JSON.stringify(categories))
    formData.append('featured', String(featured))
    if (description) formData.append('description', description)
    if (tags && tags.length > 0) formData.append('tags', JSON.stringify(tags))

    const response = await axios.post(`${API_BASE}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
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

  // Files
  getFileUrl(filename: string): string {
    return `${API_BASE}/files/${filename}`
  }
}
