import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { FileText, ArrowLeft, Globe, FolderOpen, Scale, Shield, Mail } from 'lucide-react'

export default function About() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Helmet>
        <title>About Us - FilesPH</title>
        <meta name="description" content="About FilesPH - Independent platform for accessing public documents, government job postings, and official announcements" />
      </Helmet>

      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Link to="/" className="flex items-center space-x-2">
              <FileText className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">FilesPH</h1>
            </Link>
            <Link
              to="/"
              className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">About FilesPH</h1>

          <div className="prose prose-gray max-w-none">
            <p className="text-gray-700 mb-6 text-lg">
              FilesPH is an independent online platform created to make public documents, government job postings, and official announcements easier to access in one centralized place.
            </p>

            <p className="text-gray-700 mb-8">Our goal is to help:</p>
            <ul className="list-disc list-inside text-gray-700 mb-8 ml-4">
              <li>Job seekers</li>
              <li>Students</li>
              <li>Researchers</li>
              <li>Everyday citizens</li>
            </ul>
            <p className="text-gray-700 mb-8">
              find important public information quickly, clearly, and conveniently.
            </p>

            {/* Mission Section */}
            <div className="bg-blue-50 rounded-lg p-6 mb-8">
              <div className="flex items-center space-x-3 mb-4">
                <Globe className="h-6 w-6 text-blue-600" />
                <h2 className="text-xl font-bold text-gray-900">Our Mission</h2>
              </div>
              <p className="text-gray-700">
                To improve public access to information by organizing and presenting publicly available documents in a user-friendly and searchable format.
              </p>
            </div>

            {/* What We Offer Section */}
            <div className="bg-green-50 rounded-lg p-6 mb-8">
              <div className="flex items-center space-x-3 mb-4">
                <FolderOpen className="h-6 w-6 text-green-600" />
                <h2 className="text-xl font-bold text-gray-900">What We Offer</h2>
              </div>
              <ul className="list-disc list-inside text-gray-700 mb-4 ml-4">
                <li>Government job postings and hiring notices</li>
                <li>Public forms and announcements</li>
                <li>Board exam results and official releases</li>
                <li>Document viewing, downloading, and sharing tools</li>
              </ul>
              <p className="text-gray-700 mt-4">FilesPH is designed to be:</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">Simple</span>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">Mobile-friendly</span>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">Fast</span>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">Easy to use</span>
              </div>
            </div>

            {/* Independence & Transparency Section */}
            <div className="bg-purple-50 rounded-lg p-6 mb-8">
              <div className="flex items-center space-x-3 mb-4">
                <Scale className="h-6 w-6 text-purple-600" />
                <h2 className="text-xl font-bold text-gray-900">Independence & Transparency</h2>
              </div>
              <p className="text-gray-700 mb-4">
                <strong>FilesPH is not an official government website and is not affiliated with any government agency.</strong>
              </p>
              <p className="text-gray-700">
                We act solely as an information indexing and access platform. Users are encouraged to verify documents directly with official issuing agencies when needed.
              </p>
            </div>

            {/* Commitment Section */}
            <div className="bg-orange-50 rounded-lg p-6 mb-8">
              <div className="flex items-center space-x-3 mb-4">
                <Shield className="h-6 w-6 text-orange-600" />
                <h2 className="text-xl font-bold text-gray-900">Commitment to Responsible Use</h2>
              </div>
              <p className="text-gray-700">
                We respect privacy, intellectual property rights, and transparency. If content needs correction or removal, we are open to review and cooperation.
              </p>
            </div>

            {/* Contact Section */}
            <div className="bg-gray-100 rounded-lg p-6">
              <div className="flex items-center space-x-3 mb-4">
                <Mail className="h-6 w-6 text-gray-600" />
                <h2 className="text-xl font-bold text-gray-900">Contact Us</h2>
              </div>
              <p className="text-gray-700 mb-4">For inquiries, corrections, or concerns:</p>
              <ul className="list-none text-gray-700 ml-4">
                <li className="mb-2">
                  <strong>Email:</strong>{' '}
                  <a href="mailto:newstogovph@gmail.com" className="text-blue-600 hover:underline">
                    newstogovph@gmail.com
                  </a>
                </li>
                <li><strong>Website:</strong> FilesPH</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-2">
              FilesPH is an independent platform and is not affiliated with or operated by any government agency.
            </p>
            <p className="text-gray-500 text-sm">
              © 2026 FilesPH
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
