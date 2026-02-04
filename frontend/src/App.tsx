import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Viewer from './pages/Viewer'
import Admin from './pages/Admin'
import Login from './pages/Login'
import DocumentPage from './pages/DocumentPage'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsOfService from './pages/TermsOfService'
import About from './pages/About'
import SearchPage from './pages/SearchPage'
import AgencyPage from './pages/AgencyPage'
import './App.css'

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/view/:docId" element={<Viewer />} />
        <Route path="/d/:slug" element={<DocumentPage />} />
        <Route path="/embed/:slug" element={<DocumentPage embedded />} />
        <Route path="/agency/:slug" element={<AgencyPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/about" element={<About />} />
        <Route path="/embed-legacy/:docId" element={<Viewer embedded />} />
      </Routes>
    </div>
  )
}

export default App
