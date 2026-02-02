export interface Document {
  id: string
  name: string
  slug: string
  description?: string
  tags?: string[]
  // Legacy file uploads (for backward compatibility)
  files?: DocumentFile[]
  // R2 URL-based storage
  fileUrl?: string
  fileType?: 'pdf' | 'image' | 'text' | 'other'
  thumbnailUrl?: string
  categories: string[]
  featured: boolean
  createdAt: string
  releaseDate?: string
  deadline?: string
  totalPages: number
  thumbnail?: string
  views?: number
  downloads?: number
  sourceAgency?: string
}

export interface DocumentFile {
  id: string
  filename: string
  originalName: string
  path: string
  type: 'pdf' | 'image' | 'text'
  mimeType: string
  size: number
  pageCount?: number
}

export interface Category {
  id: string
  name: string
  description?: string
  documentCount: number
}

export interface ViewerState {
  zoom: number
  currentPage: number
  totalPages: number
  fitMode: 'width' | 'page' | 'auto'
}
