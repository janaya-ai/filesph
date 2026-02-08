import { Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home'
import Viewer from './pages/Viewer'
import Admin from './pages/Admin'
import Login from './pages/Login'
import DocumentPage from './pages/DocumentPage'
import EmbedViewer from './pages/EmbedViewer'
import EmbedPreview from './pages/EmbedPreview'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsOfService from './pages/TermsOfService'
import About from './pages/About'
import SearchPage from './pages/SearchPage'
import AgencyPage from './pages/AgencyPage'
import './App.css'

function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Page Not Found</h1>
        <p className="text-gray-600 mb-8">The page you're looking for doesn't exist.</p>
        <Link to="/" className="text-blue-600 hover:underline">
          Return to Home
        </Link>
      </div>
    </div>
  )
}

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/view/:docId" element={<Viewer />} />
        <Route path="/d/:slug" element={<DocumentPage />} />
        <Route path="/embed/:slug" element={<EmbedViewer />} />
        <Route path="/preview/:slug" element={<EmbedPreview />} />
        <Route path="/agency/:slug" element={<AgencyPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/about" element={<About />} />
        <Route path="/embed-legacy/:docId" element={<Viewer embedded />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  )
}

export default App
