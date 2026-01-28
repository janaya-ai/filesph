import { useEffect, useState } from 'react'
import type { ViewerState } from '../types'

interface TextRendererProps {
  fileUrl: string
  viewerState: ViewerState
}

export default function TextRenderer({ fileUrl, viewerState }: TextRendererProps) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadText()
  }, [fileUrl])

  const loadText = async () => {
    try {
      setLoading(true)
      const response = await fetch(fileUrl)
      const text = await response.text()
      setContent(text)
    } catch (err) {
      setError('Failed to load text file')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const getFontSize = () => {
    return `${viewerState.zoom}rem`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 bg-white shadow-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading text...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 bg-white shadow-lg">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="bg-white shadow-lg p-8">
      <pre
        className="whitespace-pre-wrap font-mono text-gray-900 overflow-x-auto"
        style={{ fontSize: getFontSize() }}
      >
        {content}
      </pre>
    </div>
  )
}
