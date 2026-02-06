import type { ViewerState } from '../types'
import { API_BASE_URL } from '../utils/api'

// API base URL for proxy
const API_BASE = API_BASE_URL || window.location.origin

interface ImageRendererProps {
  fileUrl: string
  viewerState: ViewerState
}

export default function ImageRenderer({ fileUrl, viewerState }: ImageRendererProps) {
  // For external URLs (R2, CDN), use proxy to avoid CORS and ensure full quality
  const isExternalUrl = fileUrl.startsWith('http://') || fileUrl.startsWith('https://')
  const imageSrc = isExternalUrl 
    ? `${API_BASE}/api/proxy?url=${encodeURIComponent(fileUrl)}`
    : fileUrl

  const getImageStyle = () => {
    let width = '100%'
    let maxWidth = '100%'
    let transform = `scale(${viewerState.zoom})`

    if (viewerState.fitMode === 'width') {
      width = '100%'
      maxWidth = '100%'
    } else if (viewerState.fitMode === 'page') {
      width = 'auto'
      maxWidth = '100%'
      transform = 'none'
    }

    return { width, maxWidth, transform }
  }

  return (
    <div className="bg-white shadow-lg overflow-hidden">
      <div className="flex items-center justify-center p-4">
        <img
          src={imageSrc}
          alt="Document"
          style={{
            ...getImageStyle(),
            imageRendering: 'auto', // Let browser choose best quality
          }}
          className="transition-transform duration-200"
          loading="eager"
          decoding="async"
        />
      </div>
    </div>
  )
}
