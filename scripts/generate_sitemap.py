#!/usr/bin/env python3
"""
Automatic Sitemap Generator for filesph.com

This script crawls the filesph website starting from the BASE_URL,
discovers internal HTML pages and asset URLs (PDFs, images), and
generates a valid sitemap.xml file following the sitemaps.org schema.

Usage:
    python generate_sitemap.py [options]

Environment Variables / CLI Flags:
    BASE_URL    - Starting URL to crawl (default: https://filesph.com)
    MAX_PAGES   - Maximum number of pages to crawl (default: 5000)
    DELAY       - Crawl delay in seconds between requests (default: 0.5)
    OUTPUT      - Output file path (default: public/sitemap.xml)

Example:
    BASE_URL=https://filesph.com MAX_PAGES=1000 python generate_sitemap.py
    python generate_sitemap.py --base-url https://filesph.com --max-pages 1000

License: MIT
Author: filesph.com team
Contact: admin@filesph.com (update this with your contact email)
"""

import os
import sys
import time
import argparse
import logging
from urllib.parse import urljoin, urlparse, urlunparse
from datetime import datetime
from typing import Set, List, Dict, Optional
import requests
from bs4 import BeautifulSoup
import xml.etree.ElementTree as ET
from xml.dom import minidom

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Constants
SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9"
MAX_URLS_PER_SITEMAP = 50000
USER_AGENT = "filesph-sitemap-bot/1.0 (+https://filesph.com; contact: admin@filesph.com)"


class SitemapGenerator:
    """Crawls a website and generates sitemap.xml"""
    
    def __init__(self, base_url: str, max_pages: int = 5000, delay: float = 0.5, output: str = "public/sitemap.xml"):
        self.base_url = base_url.rstrip('/')
        self.max_pages = max_pages
        self.delay = delay
        self.output = output
        self.visited_urls: Set[str] = set()
        self.urls_to_crawl: List[str] = [self.base_url]
        self.sitemap_entries: List[Dict] = []
        self.session = requests.Session()
        self.session.headers.update({'User-Agent': USER_AGENT})
        
        # Parse base domain for same-origin check
        parsed = urlparse(self.base_url)
        self.base_domain = f"{parsed.scheme}://{parsed.netloc}"
        
        logger.info(f"Initialized SitemapGenerator for {self.base_url}")
        logger.info(f"Max pages: {self.max_pages}, Delay: {self.delay}s, Output: {self.output}")
    
    def is_same_origin(self, url: str) -> bool:
        """Check if URL is from the same origin as base_url"""
        parsed = urlparse(url)
        url_domain = f"{parsed.scheme}://{parsed.netloc}"
        return url_domain == self.base_domain
    
    def normalize_url(self, url: str) -> str:
        """Normalize URL by removing fragments and trailing slashes"""
        parsed = urlparse(url)
        # Remove fragment
        normalized = urlunparse((parsed.scheme, parsed.netloc, parsed.path, 
                                parsed.params, parsed.query, ''))
        # Remove trailing slash unless it's the root
        if normalized.endswith('/') and len(parsed.path) > 1:
            normalized = normalized.rstrip('/')
        return normalized
    
    def is_asset_url(self, url: str) -> bool:
        """Check if URL is an asset (PDF, image, etc.)"""
        parsed = urlparse(url)
        path = parsed.path.lower()
        asset_extensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
        return any(path.endswith(ext) for ext in asset_extensions)
    
    def get_lastmod(self, response: requests.Response) -> Optional[str]:
        """Extract lastmod from HTTP Last-Modified header"""
        last_modified = response.headers.get('Last-Modified')
        if last_modified:
            try:
                # Parse HTTP date format to ISO 8601
                dt = datetime.strptime(last_modified, '%a, %d %b %Y %H:%M:%S %Z')
                return dt.strftime('%Y-%m-%d')
            except (ValueError, TypeError):
                pass
        return None
    
    def fetch_page(self, url: str) -> Optional[requests.Response]:
        """Fetch a page with error handling"""
        try:
            logger.info(f"Fetching: {url}")
            response = self.session.get(url, timeout=30, allow_redirects=True)
            response.raise_for_status()
            return response
        except requests.exceptions.RequestException as e:
            logger.warning(f"Failed to fetch {url}: {e}")
            return None
    
    def extract_links(self, html: str, base_url: str) -> Set[str]:
        """Extract all links from HTML content"""
        links = set()
        try:
            soup = BeautifulSoup(html, 'html.parser')
            
            # Find all <a> tags with href
            for tag in soup.find_all('a', href=True):
                href = tag['href']
                absolute_url = urljoin(base_url, href)
                normalized = self.normalize_url(absolute_url)
                
                # Only include same-origin URLs
                if self.is_same_origin(normalized):
                    links.add(normalized)
            
            # Find image sources
            for tag in soup.find_all('img', src=True):
                src = tag['src']
                absolute_url = urljoin(base_url, src)
                normalized = self.normalize_url(absolute_url)
                
                if self.is_same_origin(normalized) and self.is_asset_url(normalized):
                    links.add(normalized)
            
        except Exception as e:
            logger.warning(f"Failed to parse HTML from {base_url}: {e}")
        
        return links
    
    def crawl(self):
        """Main crawl loop"""
        logger.info("Starting crawl...")
        
        while self.urls_to_crawl and len(self.visited_urls) < self.max_pages:
            url = self.urls_to_crawl.pop(0)
            
            # Skip if already visited
            if url in self.visited_urls:
                continue
            
            self.visited_urls.add(url)
            
            # Fetch the page
            response = self.fetch_page(url)
            if not response:
                continue
            
            # Get lastmod
            lastmod = self.get_lastmod(response)
            
            # Determine changefreq and priority based on URL pattern
            changefreq = "monthly"
            priority = 0.5
            
            if url == self.base_url or url == f"{self.base_url}/":
                changefreq = "daily"
                priority = 1.0
            elif '/d/' in url:  # Document pages
                changefreq = "monthly"
                priority = 0.8
            elif '/agency/' in url:  # Agency pages
                changefreq = "weekly"
                priority = 0.9
            
            # Add to sitemap entries
            entry = {
                'loc': url,
                'changefreq': changefreq,
                'priority': priority
            }
            if lastmod:
                entry['lastmod'] = lastmod
            
            self.sitemap_entries.append(entry)
            
            # If it's HTML, extract more links
            content_type = response.headers.get('Content-Type', '')
            if 'text/html' in content_type:
                links = self.extract_links(response.text, url)
                
                # Add new links to crawl queue
                for link in links:
                    if link not in self.visited_urls and link not in self.urls_to_crawl:
                        self.urls_to_crawl.append(link)
            
            # Be polite - delay between requests
            time.sleep(self.delay)
        
        logger.info(f"Crawl complete. Visited {len(self.visited_urls)} URLs, found {len(self.sitemap_entries)} entries")
    
    def generate_sitemap_xml(self, entries: List[Dict], filename: str):
        """Generate a single sitemap XML file"""
        urlset = ET.Element('urlset', xmlns=SITEMAP_NS)
        
        # Sort entries by URL for deterministic output
        sorted_entries = sorted(entries, key=lambda x: x['loc'])
        
        for entry in sorted_entries:
            url_elem = ET.SubElement(urlset, 'url')
            
            loc = ET.SubElement(url_elem, 'loc')
            loc.text = entry['loc']
            
            if 'lastmod' in entry:
                lastmod = ET.SubElement(url_elem, 'lastmod')
                lastmod.text = entry['lastmod']
            
            changefreq = ET.SubElement(url_elem, 'changefreq')
            changefreq.text = entry['changefreq']
            
            priority = ET.SubElement(url_elem, 'priority')
            priority.text = str(entry['priority'])
        
        # Pretty print XML
        xml_str = minidom.parseString(ET.tostring(urlset)).toprettyxml(indent='  ')
        
        # Write to file
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(xml_str)
        
        logger.info(f"Generated sitemap: {filename} with {len(sorted_entries)} URLs")
    
    def generate_sitemap_index(self, sitemap_files: List[str], index_filename: str):
        """Generate a sitemap index XML file"""
        sitemapindex = ET.Element('sitemapindex', xmlns=SITEMAP_NS)
        
        for sitemap_file in sitemap_files:
            sitemap_elem = ET.SubElement(sitemapindex, 'sitemap')
            
            loc = ET.SubElement(sitemap_elem, 'loc')
            # Convert relative path to URL
            filename = os.path.basename(sitemap_file)
            loc.text = f"{self.base_url}/{filename}"
            
            lastmod = ET.SubElement(sitemap_elem, 'lastmod')
            lastmod.text = datetime.utcnow().strftime('%Y-%m-%d')
        
        # Pretty print XML
        xml_str = minidom.parseString(ET.tostring(sitemapindex)).toprettyxml(indent='  ')
        
        # Write to file
        with open(index_filename, 'w', encoding='utf-8') as f:
            f.write(xml_str)
        
        logger.info(f"Generated sitemap index: {index_filename} with {len(sitemap_files)} sitemaps")
    
    def save_sitemap(self):
        """Save sitemap(s) to file"""
        # Ensure output directory exists
        output_dir = os.path.dirname(self.output)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir)
            logger.info(f"Created output directory: {output_dir}")
        
        # Check if we need multiple sitemap files
        if len(self.sitemap_entries) <= MAX_URLS_PER_SITEMAP:
            # Single sitemap file
            self.generate_sitemap_xml(self.sitemap_entries, self.output)
        else:
            # Multiple sitemap files with an index
            logger.info(f"Generating sitemap index for {len(self.sitemap_entries)} URLs")
            
            # Split entries into chunks
            sitemap_files = []
            for i in range(0, len(self.sitemap_entries), MAX_URLS_PER_SITEMAP):
                chunk = self.sitemap_entries[i:i + MAX_URLS_PER_SITEMAP]
                part_num = (i // MAX_URLS_PER_SITEMAP) + 1
                
                # Generate filename for this part
                base_name = os.path.splitext(self.output)[0]
                part_filename = f"{base_name}-part-{part_num}.xml"
                
                self.generate_sitemap_xml(chunk, part_filename)
                sitemap_files.append(part_filename)
            
            # Generate index file
            self.generate_sitemap_index(sitemap_files, self.output)
        
        logger.info(f"Sitemap generation complete. Output: {self.output}")
    
    def run(self):
        """Run the complete sitemap generation process"""
        try:
            self.crawl()
            self.save_sitemap()
            logger.info("SUCCESS: Sitemap generated successfully")
            return 0
        except Exception as e:
            logger.error(f"FAILED: {e}", exc_info=True)
            return 1


def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description='Generate sitemap.xml by crawling a website',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    parser.add_argument(
        '--base-url',
        default=os.getenv('BASE_URL', 'https://filesph.com'),
        help='Base URL to crawl (default: https://filesph.com or $BASE_URL)'
    )
    
    parser.add_argument(
        '--max-pages',
        type=int,
        default=int(os.getenv('MAX_PAGES', '5000')),
        help='Maximum number of pages to crawl (default: 5000 or $MAX_PAGES)'
    )
    
    parser.add_argument(
        '--delay',
        type=float,
        default=float(os.getenv('DELAY', '0.5')),
        help='Delay between requests in seconds (default: 0.5 or $DELAY)'
    )
    
    parser.add_argument(
        '--output',
        default=os.getenv('OUTPUT', 'public/sitemap.xml'),
        help='Output file path (default: public/sitemap.xml or $OUTPUT)'
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Run in dry-run mode (crawl but do not save sitemap)'
    )
    
    return parser.parse_args()


def main():
    """Main entry point"""
    args = parse_args()
    
    logger.info("=" * 60)
    logger.info("Sitemap Generator for filesph.com")
    logger.info("=" * 60)
    
    # Create generator
    generator = SitemapGenerator(
        base_url=args.base_url,
        max_pages=args.max_pages,
        delay=args.delay,
        output=args.output
    )
    
    # Run crawl
    if args.dry_run:
        logger.info("DRY-RUN MODE: Will not save sitemap")
        try:
            generator.crawl()
            logger.info(f"DRY-RUN SUCCESS: Would generate sitemap with {len(generator.sitemap_entries)} entries")
            return 0
        except Exception as e:
            logger.error(f"DRY-RUN FAILED: {e}", exc_info=True)
            return 1
    else:
        return generator.run()


if __name__ == '__main__':
    sys.exit(main())
