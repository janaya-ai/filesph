# SEO Features - Quick Test Guide

## Quick Testing Steps

### 1. Upload a Test Document
1. Go to http://localhost:5173/admin
2. Upload a document with:
   - Title: "Annual Report 2024"
   - Description: "Company annual financial report for fiscal year 2024"
   - Tags: "finance, annual, report, 2024"
   - Category: Select any
3. Click "Upload Documents"

### 2. Check Slug Generation
The document should now be accessible at:
```
http://localhost:5173/d/annual-report-2024
```

### 3. Verify SEO Meta Tags
1. Open the document page
2. Right-click → "View Page Source"
3. Look for:
   ```html
   <title>Annual Report 2024 | filesph.com</title>
   <meta name="description" content="Company annual financial report for fiscal year 2024">
   <meta property="og:title" content="Annual Report 2024">
   <script type="application/ld+json">...</script>
   ```

### 4. Test Sitemap
Visit: http://localhost:3001/sitemap.xml

You should see XML like:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>http://localhost:5173/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>http://localhost:5173/d/annual-report-2024</loc>
    <lastmod>2026-01-27</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
```

### 5. Test Robots.txt
Visit: http://localhost:3001/robots.txt

Should show:
```
User-agent: *
Allow: /
Sitemap: http://localhost:5173/sitemap.xml
```

### 6. Test Social Media Preview
Use these tools to test:

**Facebook Sharing Debugger:**
1. Go to: https://developers.facebook.com/tools/debug/
2. Enter: http://localhost:5173/d/annual-report-2024 (or use ngrok/tunnel)
3. Check Open Graph tags

**Twitter Card Validator:**
1. Go to: https://cards-dev.twitter.com/validator
2. Enter your document URL
3. Check Twitter Card rendering

**Google Rich Results Test:**
1. Go to: https://search.google.com/test/rich-results
2. Enter your document URL or paste HTML
3. Check structured data validation

### 7. Test Different Document Types

**PDF Document:**
```
Title: User Guide
Description: Complete user manual for our product
Tags: guide, manual, documentation
```
Expected URL: `/d/user-guide`

**Multi-word with Special Characters:**
```
Title: Q&A: Product Specifications (2024)
Description: Frequently asked questions about product specs
Tags: faq, specifications
```
Expected URL: `/d/qa-product-specifications-2024`

**Duplicate Names:**
```
Upload 1: Title: "Report"
Upload 2: Title: "Report"
Upload 3: Title: "Report"
```
Expected URLs:
- `/d/report`
- `/d/report-1`
- `/d/report-2`

### 8. Test Search Engine Behavior

**Homepage SEO:**
1. Visit http://localhost:5173/
2. View source
3. Should see:
   - Title: "filesph.com - A comprehensive platform..."
   - Meta description
   - Open Graph tags

**Category Filter:**
1. Filter by category on homepage
2. Documents should still link to `/d/slug` URLs

**Search Functionality:**
1. Search for a document
2. Click result
3. Should navigate to `/d/slug` URL

## Expected Behaviors

### ✅ Slug Generation Rules
- Lowercase conversion: "My Document" → "my-document"
- Special char removal: "Q&A: Guide" → "qa-guide"
- Space to hyphen: "Annual Report" → "annual-report"
- Multiple hyphens: "Report  2024" → "report-2024"
- Max length: 100 characters
- Uniqueness: Appends -1, -2, etc.

### ✅ Meta Tag Priority
1. Document-specific (DocumentPage) overrides global (index.html)
2. Helmet updates <head> dynamically
3. Each document has unique meta tags

### ✅ Structured Data
- Type: DigitalDocument (Schema.org)
- Fields: name, description, url, datePublished, thumbnailUrl, keywords, numberOfPages
- Format: JSON-LD in <script> tag

### ✅ Link Behavior
- Homepage cards → `/d/slug`
- Featured docs → `/d/slug`
- Search results → `/d/slug`
- Old `/view/:id` routes still work (backward compatible)

## Common Issues & Solutions

### Issue: Slug not generating
**Solution:** Check backend logs, ensure document has a name

### Issue: Meta tags not updating
**Solution:** Verify HelmetProvider wraps app in main.tsx

### Issue: 404 on document page
**Solution:** Check slug matches exactly (case-sensitive in database)

### Issue: Sitemap empty
**Solution:** Upload at least one document, check data.json

### Issue: Images not showing in social preview
**Solution:** Ensure thumbnail generation is working, check CORS

## Browser DevTools Checks

### Chrome DevTools
```
1. F12 → Elements → <head>
2. Verify <meta> tags are present
3. Check <script type="application/ld+json">
4. Network tab → Check thumbnail loads
```

### SEO Extension
Install "META SEO inspector" Chrome extension:
1. Click extension icon
2. View all meta tags
3. Check Open Graph
4. Verify structured data

## Production Checklist

Before deploying to production:
- [ ] Set BASE_URL environment variable
- [ ] Test all document URLs load correctly
- [ ] Verify sitemap.xml is accessible
- [ ] Check robots.txt points to correct sitemap
- [ ] Test social media previews
- [ ] Validate structured data
- [ ] Enable HTTPS
- [ ] Submit sitemap to Google Search Console
- [ ] Set up analytics tracking
- [ ] Monitor Core Web Vitals

## Success Criteria

✅ All documents accessible via clean URLs
✅ Unique meta tags for each document
✅ Structured data validates without errors
✅ Sitemap includes all documents
✅ Social media previews show correctly
✅ No console errors
✅ Fast page loads (< 3s)
✅ Mobile responsive

## Next Steps After Testing

1. **Monitor Performance:**
   - Use Google Search Console
   - Track indexing status
   - Monitor search queries

2. **Optimize Content:**
   - Write better descriptions
   - Choose relevant tags
   - Use descriptive document names

3. **Build Backlinks:**
   - Share documents on social media
   - Submit to relevant directories
   - Engage with community

4. **Track Results:**
   - Set up Google Analytics
   - Monitor organic traffic
   - Analyze user behavior
   - A/B test meta descriptions
