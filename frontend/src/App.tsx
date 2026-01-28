import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Viewer from './pages/Viewer'
import Admin from './pages/Admin'
import Login from './pages/Login'
import DocumentPage from './pages/DocumentPage'
import './App.css'

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/view/:docId" element={<Viewer />} />
        <Route path="/d/:slug" element={<DocumentPage />} />
        <Route path="/embed/:slug" element={<DocumentPage embedded />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/embed-legacy/:docId" element={<Viewer embedded />} />
      </Routes>
    </div>
  )
}

export default App
