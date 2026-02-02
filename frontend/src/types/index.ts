export interface RelatedArticle {
  title: string
  url: string
}

export interface Document {
  id: string
  name: string
  slug: string
  description?: string
  tags?: string[]
  // Legacy file uploads (for backward compatibility)
  files?: DocumentFile[]
  // R2 URL-based storage (single file - legacy)
  fileUrl?: string
  fileType?: 'pdf' | 'image' | 'text' | 'other'
  // R2 URL-based storage (multiple files)
  fileUrls?: string[]
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
  // Related blog articles/guides
  relatedArticles?: RelatedArticle[]
}

// Helper to get file type from URL
export function getFileTypeFromUrl(url: string): 'pdf' | 'image' | 'text' | 'other' {
  const urlLower = url.toLowerCase()
  if (urlLower.includes('.pdf')) return 'pdf'
  if (urlLower.includes('.jpg') || urlLower.includes('.jpeg') || urlLower.includes('.png') || urlLower.includes('.gif') || urlLower.includes('.webp')) return 'image'
  if (urlLower.includes('.txt') || urlLower.includes('.csv')) return 'text'
  return 'other'
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
