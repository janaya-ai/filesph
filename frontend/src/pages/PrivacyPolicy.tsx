import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { FileText, ArrowLeft } from 'lucide-react'

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Helmet>
        <title>Privacy Policy - FilesPH</title>
        <meta name="description" content="Privacy Policy for FilesPH - Independent platform for accessing public documents" />
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy for FilesPH</h1>
          <p className="text-gray-500 mb-8">Last updated: February 2026</p>

          <div className="prose prose-gray max-w-none">
            <p className="text-gray-700 mb-6">
              FilesPH ("we", "our", or "us") values your privacy. This Privacy Policy explains how we collect, use, and protect information when you visit or use our website.
            </p>
            <p className="text-gray-700 mb-8">
              FilesPH is an independent platform that provides access to publicly available documents, job postings, and announcements.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">1. Information We Collect</h2>
            <p className="text-gray-700 mb-4">We may collect the following types of information:</p>
            
            <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-2">a. Personal Information</h3>
            <p className="text-gray-700 mb-2">We only collect personal information when you voluntarily provide it, such as:</p>
            <ul className="list-disc list-inside text-gray-700 mb-4 ml-4">
              <li>Name or email address (for admin access, contact forms, or inquiries)</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-2">b. Non-Personal Information</h3>
            <p className="text-gray-700 mb-2">Automatically collected information may include:</p>
            <ul className="list-disc list-inside text-gray-700 mb-4 ml-4">
              <li>IP address</li>
              <li>Browser type</li>
              <li>Device information</li>
              <li>Pages visited and time spent on the site</li>
            </ul>
            <p className="text-gray-700 mb-4">This data is used solely for analytics, security, and improving site performance.</p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">2. How We Use Your Information</h2>
            <p className="text-gray-700 mb-2">We use collected information to:</p>
            <ul className="list-disc list-inside text-gray-700 mb-4 ml-4">
              <li>Operate and maintain the website</li>
              <li>Improve user experience and content quality</li>
              <li>Respond to inquiries or support requests</li>
              <li>Monitor website usage and prevent abuse</li>
            </ul>
            <p className="text-gray-700 mb-4 font-medium">We do not sell, rent, or trade personal information to third parties.</p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">3. Cookies and Tracking Technologies</h2>
            <p className="text-gray-700 mb-2">FilesPH may use cookies or similar technologies to:</p>
            <ul className="list-disc list-inside text-gray-700 mb-4 ml-4">
              <li>Remember user preferences</li>
              <li>Analyze site traffic and usage trends</li>
              <li>Improve website functionality</li>
            </ul>
            <p className="text-gray-700 mb-4">You may disable cookies through your browser settings. Disabling cookies may affect some features of the site.</p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">4. Document Content Disclaimer</h2>
            <p className="text-gray-700 mb-4">
              FilesPH indexes and displays publicly available documents obtained from official sources, agencies, or user submissions.
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-4 ml-4">
              <li>We do not claim ownership of these documents unless explicitly stated.</li>
              <li>If you believe content violates copyright or privacy rights, please contact us for review and removal.</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">5. Data Security</h2>
            <p className="text-gray-700 mb-4">
              We implement reasonable security measures to protect your information. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">6. Third-Party Services</h2>
            <p className="text-gray-700 mb-2">FilesPH may use third-party services such as:</p>
            <ul className="list-disc list-inside text-gray-700 mb-4 ml-4">
              <li>Analytics tools</li>
              <li>Hosting providers</li>
              <li>Content delivery services</li>
            </ul>
            <p className="text-gray-700 mb-4">These third parties have their own privacy policies and are responsible for their data handling practices.</p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">7. Children's Information</h2>
            <p className="text-gray-700 mb-4">
              FilesPH does not knowingly collect personal information from children under the age of 13. If you believe a child has provided personal information, please contact us so we can remove it.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">8. External Links</h2>
            <p className="text-gray-700 mb-4">
              Our website may contain links to external websites. We are not responsible for the privacy practices or content of third-party sites.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">9. Changes to This Privacy Policy</h2>
            <p className="text-gray-700 mb-4">
              We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated "Last updated" date.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">10. Contact Us</h2>
            <p className="text-gray-700 mb-2">If you have questions or concerns about this Privacy Policy, you may contact us at:</p>
            <ul className="list-none text-gray-700 mb-4 ml-4">
              <li><strong>Email:</strong> newstogovph@gmail.com</li>
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
