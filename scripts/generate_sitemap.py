#!/usr/bin/env python3
"""
Sitemap Generator for filesph.com

This script crawls a website starting from BASE_URL and generates an XML sitemap
following the sitemaps.org protocol. It discovers HTML pages and static assets
(PDFs, images) and creates sitemap entries with optional lastmod timestamps.

Usage:
    python generate_sitemap.py [options]
    
    Environment variables:
        BASE_URL    - Base URL to crawl (default: https://filesph.com)
        MAX_PAGES   - Maximum pages to crawl (default: 5000)
        DELAY       - Delay between requests in seconds (default: 0.5)
        OUTPUT      - Output file path (default: frontend/public/sitemap.xml)
    
    CLI flags:
        --base-url URL      Override BASE_URL
        --max-pages N       Override MAX_PAGES
        --delay SECONDS     Override DELAY
        --output PATH       Override OUTPUT
        --dry-run           Run without writing output
        --verbose           Enable verbose logging

License: MIT
Author: filesph.com team
Contact: admin@filesph.com (update this email)
"""

import os
import sys
import time
import argparse
import logging
from datetime import datetime
from urllib.parse import urljoin, urlparse, urlunparse
from collections import deque
import xml.etree.ElementTree as ET

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("ERROR: Required dependencies not installed.", file=sys.stderr)
    print("Please run: pip install -r scripts/requirements.txt", file=sys.stderr)
    sys.exit(1)

# Constants
DEFAULT_BASE_URL = "https://filesph.com"
DEFAULT_MAX_PAGES = 5000
DEFAULT_DELAY = 0.5
DEFAULT_OUTPUT = "frontend/public/sitemap.xml"
MAX_URLS_PER_SITEMAP = 50000
USER_AGENT = "filesph-sitemap-bot/1.0 (+https://filesph.com; admin@filesph.com)"

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


def normalize_url(url):
    """Normalize URL by removing fragments and query params for comparison."""
    parsed = urlparse(url)
    # Keep query params but remove fragments
    normalized = urlunparse((
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        parsed.query,
        ''  # Remove fragment
    ))
    return normalized


def is_same_origin(url, base_url):
    """Check if URL is same origin as base_url."""
    url_parsed = urlparse(url)
    base_parsed = urlparse(base_url)
    return url_parsed.netloc == base_parsed.netloc


def is_asset_url(url):
    """Check if URL points to a static asset (PDF, image, etc)."""
    path = urlparse(url).path.lower()
    asset_extensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico']
    return any(path.endswith(ext) for ext in asset_extensions)


def is_html_url(url):
    """Check if URL likely points to an HTML page."""
    path = urlparse(url).path.lower()
    # Exclude known non-HTML extensions
    non_html_extensions = [
        '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico',
        '.css', '.js', '.json', '.xml', '.txt', '.zip', '.gz'
    ]
    return not any(path.endswith(ext) for ext in non_html_extensions)


def fetch_url(url, session, delay):
    """Fetch a URL and return response with headers."""
    try:
        time.sleep(delay)
        response = session.get(url, timeout=10, allow_redirects=True)
        response.raise_for_status()
        return response
    except requests.RequestException as e:
        logger.warning(f"Failed to fetch {url}: {e}")
        return None


def extract_links(html, base_url):
    """Extract links from HTML content."""
    links = set()
    try:
        soup = BeautifulSoup(html, 'html.parser')
        
        # Extract links from <a> tags
        for tag in soup.find_all('a', href=True):
            href = tag['href']
            absolute_url = urljoin(base_url, href)
            normalized = normalize_url(absolute_url)
            if is_same_origin(normalized, base_url):
                links.add(normalized)
        
        # Extract asset URLs from img, link[rel=icon], etc.
        for tag in soup.find_all(['img', 'link'], src=True):
            src = tag.get('src') or tag.get('href')
            if src:
                absolute_url = urljoin(base_url, src)
                normalized = normalize_url(absolute_url)
                if is_same_origin(normalized, base_url) and is_asset_url(normalized):
                    links.add(normalized)
        
        for tag in soup.find_all('link', href=True):
            href = tag['href']
            if 'icon' in tag.get('rel', []):
                absolute_url = urljoin(base_url, href)
                normalized = normalize_url(absolute_url)
                if is_same_origin(normalized, base_url):
                    links.add(normalized)
                    
    except Exception as e:
        logger.warning(f"Failed to parse HTML: {e}")
    
    return links


def crawl_site(base_url, max_pages, delay):
    """Crawl website and return discovered URLs with metadata."""
    logger.info(f"Starting crawl from {base_url}")
    logger.info(f"Max pages: {max_pages}, Delay: {delay}s")
    
    session = requests.Session()
    session.headers.update({'User-Agent': USER_AGENT})
    
    # Track URLs: visited, to_visit, and url_metadata
    visited = set()
    to_visit = deque([normalize_url(base_url)])
    url_metadata = {}  # url -> {lastmod: str, priority: float, changefreq: str}
    
    page_count = 0
    
    while to_visit and page_count < max_pages:
        current_url = to_visit.popleft()
        
        if current_url in visited:
            continue
            
        visited.add(current_url)
        page_count += 1
        
        logger.info(f"[{page_count}/{max_pages}] Crawling: {current_url}")
        
        response = fetch_url(current_url, session, delay)
        if not response:
            continue
        
        # Store metadata
        lastmod = None
        if 'Last-Modified' in response.headers:
            try:
                # Parse Last-Modified header and convert to W3C datetime format
                last_modified_str = response.headers['Last-Modified']
                dt = datetime.strptime(last_modified_str, '%a, %d %b %Y %H:%M:%S %Z')
                lastmod = dt.strftime('%Y-%m-%dT%H:%M:%S+00:00')
            except Exception as e:
                logger.debug(f"Failed to parse Last-Modified header: {e}")
        
        # Determine priority and changefreq based on URL
        priority = 0.5
        changefreq = 'monthly'
        
        parsed_path = urlparse(current_url).path
        if parsed_path == '/' or parsed_path == '':
            priority = 1.0
            changefreq = 'daily'
        elif '/d/' in parsed_path or '/view/' in parsed_path:
            # Document pages
            priority = 0.8
            changefreq = 'monthly'
        elif '/agency/' in parsed_path or '/category/' in parsed_path:
            priority = 0.7
            changefreq = 'weekly'
        elif is_asset_url(current_url):
            priority = 0.3
            changefreq = 'yearly'
        
        url_metadata[current_url] = {
            'lastmod': lastmod,
            'priority': priority,
            'changefreq': changefreq
        }
        
        # Only extract links from HTML pages
        if is_html_url(current_url) and response.headers.get('content-type', '').startswith('text/html'):
            links = extract_links(response.text, current_url)
            for link in links:
                if link not in visited:
                    to_visit.append(link)
    
    logger.info(f"Crawl complete. Discovered {len(visited)} URLs.")
    return visited, url_metadata


def generate_sitemap(urls, url_metadata, output_path, dry_run=False):
    """Generate sitemap.xml or sitemap index if URLs exceed limit."""
    # Sort URLs for deterministic output
    sorted_urls = sorted(urls)
    
    if len(sorted_urls) <= MAX_URLS_PER_SITEMAP:
        # Single sitemap file
        return generate_single_sitemap(sorted_urls, url_metadata, output_path, dry_run)
    else:
        # Sitemap index with multiple files
        return generate_sitemap_index(sorted_urls, url_metadata, output_path, dry_run)


def generate_single_sitemap(urls, url_metadata, output_path, dry_run=False):
    """Generate a single sitemap.xml file."""
    logger.info(f"Generating sitemap with {len(urls)} URLs")
    
    # Create XML structure
    urlset = ET.Element('urlset', xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")
    
    for url in urls:
        url_elem = ET.SubElement(urlset, 'url')
        
        loc = ET.SubElement(url_elem, 'loc')
        loc.text = url
        
        metadata = url_metadata.get(url, {})
        
        if metadata.get('lastmod'):
            lastmod = ET.SubElement(url_elem, 'lastmod')
            lastmod.text = metadata['lastmod']
        
        if metadata.get('changefreq'):
            changefreq = ET.SubElement(url_elem, 'changefreq')
            changefreq.text = metadata['changefreq']
        
        if metadata.get('priority') is not None:
            priority = ET.SubElement(url_elem, 'priority')
            priority.text = f"{metadata['priority']:.1f}"
    
    # Write to file
    tree = ET.ElementTree(urlset)
    ET.indent(tree, space='  ')
    
    if dry_run:
        logger.info(f"[DRY-RUN] Would write sitemap to: {output_path}")
        return True
    
    try:
        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else '.', exist_ok=True)
        
        with open(output_path, 'wb') as f:
            tree.write(f, encoding='utf-8', xml_declaration=True)
        
        logger.info(f"Sitemap written to: {output_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to write sitemap: {e}")
        return False


def generate_sitemap_index(urls, url_metadata, output_path, dry_run=False):
    """Generate sitemap index with multiple sitemap files."""
    logger.info(f"Generating sitemap index for {len(urls)} URLs")
    
    # Split URLs into chunks
    chunk_size = MAX_URLS_PER_SITEMAP
    chunks = [urls[i:i + chunk_size] for i in range(0, len(urls), chunk_size)]
    
    base_dir = os.path.dirname(output_path) if os.path.dirname(output_path) else '.'
    base_name = os.path.basename(output_path).replace('.xml', '')
    
    # Generate individual sitemap files
    sitemap_files = []
    for idx, chunk in enumerate(chunks, start=1):
        part_filename = f"{base_name}-part-{idx}.xml"
        part_path = os.path.join(base_dir, part_filename)
        
        if not generate_single_sitemap(chunk, url_metadata, part_path, dry_run):
            return False
        
        sitemap_files.append(part_filename)
    
    # Generate sitemap index
    sitemapindex = ET.Element('sitemapindex', xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")
    
    base_url = urlparse(urls[0])
    base_url_str = f"{base_url.scheme}://{base_url.netloc}"
    
    for sitemap_file in sitemap_files:
        sitemap_elem = ET.SubElement(sitemapindex, 'sitemap')
        loc = ET.SubElement(sitemap_elem, 'loc')
        loc.text = f"{base_url_str}/{sitemap_file}"
        
        lastmod = ET.SubElement(sitemap_elem, 'lastmod')
        lastmod.text = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S+00:00')
    
    # Write index file
    tree = ET.ElementTree(sitemapindex)
    ET.indent(tree, space='  ')
    
    if dry_run:
        logger.info(f"[DRY-RUN] Would write sitemap index to: {output_path}")
        return True
    
    try:
        with open(output_path, 'wb') as f:
            tree.write(f, encoding='utf-8', xml_declaration=True)
        
        logger.info(f"Sitemap index written to: {output_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to write sitemap index: {e}")
        return False


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Generate XML sitemap for filesph.com',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    parser.add_argument(
        '--base-url',
        default=os.environ.get('BASE_URL', DEFAULT_BASE_URL),
        help=f'Base URL to crawl (default: {DEFAULT_BASE_URL})'
    )
    parser.add_argument(
        '--max-pages',
        type=int,
        default=int(os.environ.get('MAX_PAGES', DEFAULT_MAX_PAGES)),
        help=f'Maximum pages to crawl (default: {DEFAULT_MAX_PAGES})'
    )
    parser.add_argument(
        '--delay',
        type=float,
        default=float(os.environ.get('DELAY', DEFAULT_DELAY)),
        help=f'Delay between requests in seconds (default: {DEFAULT_DELAY})'
    )
    parser.add_argument(
        '--output',
        default=os.environ.get('OUTPUT', DEFAULT_OUTPUT),
        help=f'Output file path (default: {DEFAULT_OUTPUT})'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Run without writing output files'
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )
    
    args = parser.parse_args()
    
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    logger.info("=" * 60)
    logger.info("filesph.com Sitemap Generator")
    logger.info("=" * 60)
    logger.info(f"Configuration:")
    logger.info(f"  Base URL: {args.base_url}")
    logger.info(f"  Max Pages: {args.max_pages}")
    logger.info(f"  Delay: {args.delay}s")
    logger.info(f"  Output: {args.output}")
    logger.info(f"  Dry Run: {args.dry_run}")
    logger.info("=" * 60)
    
    try:
        # Crawl the site
        urls, url_metadata = crawl_site(args.base_url, args.max_pages, args.delay)
        
        if not urls:
            logger.error("No URLs discovered. Exiting.")
            return 1
        
        # Generate sitemap
        success = generate_sitemap(urls, url_metadata, args.output, args.dry_run)
        
        if success:
            logger.info("Sitemap generation completed successfully.")
            return 0
        else:
            logger.error("Sitemap generation failed.")
            return 1
            
    except KeyboardInterrupt:
        logger.info("\nCrawl interrupted by user.")
        return 130
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        return 1


if __name__ == '__main__':
    sys.exit(main())
