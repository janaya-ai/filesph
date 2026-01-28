import type { ViewerState } from '../types'

interface ImageRendererProps {
  fileUrl: string
  viewerState: ViewerState
}

export default function ImageRenderer({ fileUrl, viewerState }: ImageRendererProps) {
  const getImageStyle = () => {
    let width = '100%'
    let transform = `scale(${viewerState.zoom})`

    if (viewerState.fitMode === 'width') {
      width = '100%'
    } else if (viewerState.fitMode === 'page') {
      width = 'auto'
      transform = 'none'
    }

    return { width, transform }
  }

  return (
    <div className="bg-white shadow-lg overflow-hidden">
      <div className="flex items-center justify-center p-4">
        <img
          src={fileUrl}
          alt="Document"
          style={getImageStyle()}
          className="transition-transform duration-200"
        />
      </div>
    </div>
  )
}
