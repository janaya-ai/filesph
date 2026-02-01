import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { FileText, ArrowLeft } from 'lucide-react'

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Helmet>
        <title>Terms of Service - FilesPH</title>
        <meta name="description" content="Terms of Service for FilesPH - Independent platform for accessing public documents" />
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-gray-500 mb-8">Last updated: February 2026</p>

          <div className="prose prose-gray max-w-none">
            <p className="text-gray-700 mb-6">
              Welcome to FilesPH. By accessing or using this website, you agree to be bound by the following Terms of Service. If you do not agree with any part of these terms, please discontinue use of the website.
            </p>
            <p className="text-gray-700 mb-8">
              FilesPH is an independent platform that indexes and displays publicly available documents, job postings, and announcements for informational purposes only.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">1. Use of the Website</h2>
            <p className="text-gray-700 mb-4">
              You agree to use FilesPH only for lawful purposes and in a manner that does not violate applicable laws or regulations.
            </p>
            <p className="text-gray-700 mb-2">You must not:</p>
            <ul className="list-disc list-inside text-gray-700 mb-4 ml-4">
              <li>Use the site for fraudulent, harmful, or illegal activities</li>
              <li>Attempt to gain unauthorized access to the system or admin areas</li>
              <li>Upload or distribute malicious software or content</li>
              <li>Misrepresent the source or authenticity of documents</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">2. Content and Documents</h2>
            <p className="text-gray-700 mb-2">FilesPH may display documents that are:</p>
            <ul className="list-disc list-inside text-gray-700 mb-4 ml-4">
              <li>Publicly available</li>
              <li>Submitted by users or administrators</li>
              <li>Sourced from official announcements or agencies</li>
            </ul>
            <p className="text-gray-700 mb-4">
              FilesPH does not guarantee that documents are complete, current, or error-free.
            </p>
            <p className="text-gray-700 mb-2">Unless otherwise stated:</p>
            <ul className="list-disc list-inside text-gray-700 mb-4 ml-4">
              <li>FilesPH does not claim ownership of third-party documents</li>
              <li>All trademarks, logos, and document ownership remain with their respective owners</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">3. User Submissions (If Applicable)</h2>
            <p className="text-gray-700 mb-2">If users are allowed to submit documents:</p>
            <ul className="list-disc list-inside text-gray-700 mb-4 ml-4">
              <li>You confirm that you have the right to share the content</li>
              <li>You grant FilesPH a non-exclusive right to display and distribute the content on the platform</li>
            </ul>
            <p className="text-gray-700 mb-4">FilesPH reserves the right to remove content at its discretion.</p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">4. Intellectual Property</h2>
            <p className="text-gray-700 mb-2">All original content on FilesPH, including:</p>
            <ul className="list-disc list-inside text-gray-700 mb-4 ml-4">
              <li>Website design</li>
              <li>Layout</li>
              <li>Branding</li>
              <li>Original text and features</li>
            </ul>
            <p className="text-gray-700 mb-4">
              is the property of FilesPH unless otherwise stated and may not be copied or reused without permission.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">5. Disclaimer of Liability</h2>
            <p className="text-gray-700 mb-4">FilesPH is provided on an "as is" basis.</p>
            <p className="text-gray-700 mb-2">We are not responsible for:</p>
            <ul className="list-disc list-inside text-gray-700 mb-4 ml-4">
              <li>Decisions made based on documents found on the site</li>
              <li>Errors, delays, or omissions in content</li>
              <li>Losses resulting from reliance on posted information</li>
            </ul>
            <p className="text-gray-700 mb-4">Users are encouraged to verify information with official sources.</p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">6. Third-Party Links</h2>
            <p className="text-gray-700 mb-4">
              FilesPH may contain links to third-party websites. We do not control or endorse these sites and are not responsible for their content or policies.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">7. Termination of Access</h2>
            <p className="text-gray-700 mb-4">
              We reserve the right to restrict or terminate access to the website for users who violate these Terms of Service.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">8. Changes to the Terms</h2>
            <p className="text-gray-700 mb-4">
              FilesPH may update these Terms of Service at any time. Changes will be effective immediately upon posting on this page.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">9. Governing Law</h2>
            <p className="text-gray-700 mb-4">
              These Terms shall be governed by and interpreted in accordance with applicable laws.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">10. Contact Information</h2>
            <p className="text-gray-700 mb-2">For questions regarding these Terms, contact:</p>
            <ul className="list-none text-gray-700 mb-4 ml-4">
              <li><strong>Email:</strong> contact@filesph.com</li>
              <li><strong>Website:</strong> FilesPH</li>
            </ul>
          </div>

          {/* Disclaimer */}
          <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm">
              <strong>⚠️ Disclaimer:</strong> FilesPH is an independent platform and is not affiliated with or operated by any government agency.
            </p>
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
