# ============================================================
# BAZA WIEDZY KG - WEB SCRAPER API
# Scrapes knowledge base from gov.pl/kgpsp website
# ============================================================

from fastapi import APIRouter, HTTPException
from datetime import datetime
from typing import List, Dict, Any, Optional, Set
import aiohttp
from bs4 import BeautifulSoup
import hashlib
import asyncio
import logging
import re

router = APIRouter()
logger = logging.getLogger(__name__)

# ============================================================
# CONFIGURATION
# ============================================================

BASE_URL = "https://www.gov.pl"
BAZA_WIEDZY_URL = f"{BASE_URL}/web/kgpsp/baza-wiedzy"
KGPSP_PREFIX = "/web/kgpsp/"
MAX_DEPTH = 4  # Maximum depth of page traversal
REQUEST_TIMEOUT = 15  # Seconds
MAX_CONCURRENT_REQUESTS = 3  # Limit concurrent requests to be polite
DELAY_BETWEEN_REQUESTS = 0.5  # Seconds

# User agent to identify as a legitimate browser
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


# ============================================================
# TYPE DEFINITIONS
# ============================================================

class ScrapedNode:
    """Represents a scraped node from the knowledge base"""
    def __init__(
        self,
        id: str,
        parent_id: Optional[str],
        title: str,
        node_type: str,  # 'folder', 'file', 'link'
        path: str,
        url: Optional[str] = None,
        extension: Optional[str] = None,
        source_url: Optional[str] = None,
        sort_order: int = 0
    ):
        self.id = id
        self.parent_id = parent_id
        self.title = title
        self.type = node_type
        self.path = path
        self.url = url
        self.extension = extension
        self.source_url = source_url
        self.sort_order = sort_order

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "parent_id": self.parent_id,
            "title": self.title,
            "type": self.type,
            "path": self.path,
            "url": self.url,
            "extension": self.extension,
            "source": self.source_url,
            "sort_order": self.sort_order
        }


# ============================================================
# UTILITY FUNCTIONS
# ============================================================

def generate_id(text: str) -> str:
    """Generate a short unique ID from text"""
    return hashlib.md5(text.encode()).hexdigest()[:12]


def clean_title(text: str) -> str:
    """Clean up title text"""
    if not text:
        return ""
    # Remove extra whitespace and newlines
    cleaned = " ".join(text.split())
    # Remove common prefixes
    cleaned = cleaned.strip()
    return cleaned


def extract_extension(url: str) -> Optional[str]:
    """Extract file extension from URL"""
    if not url:
        return None
    # Check common extensions
    extensions = ['pdf', 'pptx', 'ppt', 'doc', 'docx', 'xls', 'xlsx', 'zip', 'mp4', 'avi']
    url_lower = url.lower()
    for ext in extensions:
        if f'.{ext}' in url_lower:
            return ext
    return None


def is_kgpsp_page(url: str) -> bool:
    """Check if URL is a KGPSP subpage"""
    if not url:
        return False
    return KGPSP_PREFIX in url and 'baza-wiedzy' not in url


def is_gov_attachment(url: str) -> bool:
    """Check if URL is a gov.pl attachment"""
    return '/attachment/' in url


def is_external_link(url: str) -> bool:
    """Check if URL is external (not gov.pl)"""
    if not url:
        return False
    return url.startswith('http') and 'gov.pl' not in url


def normalize_url(url: str, current_page_url: str = BASE_URL) -> str:
    """Normalize relative URLs to absolute"""
    if not url:
        return ""
    if url.startswith('http'):
        return url
    if url.startswith('/'):
        return BASE_URL + url
    # Relative URL - combine with current page
    base = current_page_url.rsplit('/', 1)[0]
    return base + '/' + url


# ============================================================
# HTML SCRAPING FUNCTIONS
# ============================================================

async def fetch_page(session: aiohttp.ClientSession, url: str) -> Optional[str]:
    """Fetch page HTML content"""
    try:
        headers = {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'pl-PL,pl;q=0.9,en;q=0.8',
        }
        async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=REQUEST_TIMEOUT)) as response:
            if response.status == 200:
                return await response.text()
            else:
                logger.warning(f"Failed to fetch {url}: status {response.status}")
                return None
    except asyncio.TimeoutError:
        logger.warning(f"Timeout fetching {url}")
        return None
    except Exception as e:
        logger.error(f"Error fetching {url}: {str(e)}")
        return None


def parse_main_categories(html: str) -> List[Dict[str, str]]:
    """Parse main categories from Baza Wiedzy main page"""
    soup = BeautifulSoup(html, 'lxml')
    categories = []
    
    # Find the list of categories in art-prev
    art_prev = soup.find('div', class_='art-prev')
    if art_prev:
        links = art_prev.find_all('a')
        for i, link in enumerate(links):
            href = link.get('href', '')
            title = clean_title(link.get_text())
            if href and title:
                categories.append({
                    'url': normalize_url(href),
                    'title': title,
                    'sort_order': i + 1
                })
    
    return categories


def parse_subpage(html: str, page_url: str) -> Dict[str, Any]:
    """Parse a subpage for subcategories, sections, and files"""
    soup = BeautifulSoup(html, 'lxml')
    result = {
        'subcategories': [],
        'items': []  # Mixed list of sections, files, and links in DOM order
    }
    
    # Find subcategories (links in art-prev list)
    art_prev = soup.find('div', class_='art-prev')
    if art_prev:
        links = art_prev.find_all('a')
        for i, link in enumerate(links):
            href = link.get('href', '')
            title = clean_title(link.get_text())
            full_url = normalize_url(href, page_url)
            if href and title and is_kgpsp_page(full_url):
                result['subcategories'].append({
                    'url': full_url,
                    'title': title,
                    'sort_order': i + 1
                })
    
    # Find main article content
    article = soup.find('article', id='main-content')
    if not article:
        return result
    
    # Track current section for grouping
    current_section = None
    item_index = 0
    
    # Iterate through direct children and relevant elements
    for element in article.children:
        if not hasattr(element, 'name') or not element.name:
            continue
            
        # Check for section headers in editor-content divs
        if element.name == 'div' and 'editor-content' in element.get('class', []):
            h3 = element.find('h3')
            if h3:
                section_title = clean_title(h3.get_text())
                # Skip generic "Materiały" headers
                if section_title and section_title.lower() not in ['materiały', 'pliki', 'dokumenty']:
                    item_index += 1
                    current_section = section_title
                    result['items'].append({
                        'type': 'section',
                        'title': section_title,
                        'sort_order': item_index
                    })
            
            # Also check for external links in this div
            for link in element.find_all('a'):
                href = link.get('href', '')
                title = clean_title(link.get_text())
                full_url = normalize_url(href, page_url)
                
                if not href or not title:
                    continue
                if is_gov_attachment(full_url):
                    continue
                if any(sub['url'] == full_url for sub in result['subcategories']):
                    continue
                    
                if is_external_link(full_url) or (href.startswith('http') and 'kgpsp' not in href):
                    item_index += 1
                    extension = extract_extension(full_url)
                    result['items'].append({
                        'type': 'link',
                        'url': full_url,
                        'title': title,
                        'extension': extension,
                        'section': current_section,
                        'sort_order': item_index
                    })
        
        # Check for standalone h3 section headers
        elif element.name == 'h3':
            section_title = clean_title(element.get_text())
            # Skip generic "Materiały" headers
            if section_title and section_title.lower() not in ['materiały', 'pliki', 'dokumenty']:
                item_index += 1
                current_section = section_title
                result['items'].append({
                    'type': 'section',
                    'title': section_title,
                    'sort_order': item_index
                })
        
        # Check for file downloads
        elif element.name == 'a' and 'file-download' in element.get('class', []):
            href = element.get('href', '')
            full_url = normalize_url(href, page_url)
            
            # Get title - first text content before <br>
            title = ""
            for content in element.contents:
                if isinstance(content, str):
                    title = clean_title(content)
                    break
                elif hasattr(content, 'name') and content.name == 'br':
                    break
            
            # Fallback: get from aria-label
            if not title:
                aria_label = element.get('aria-label', '')
                if 'Pobierz plik' in aria_label:
                    title = aria_label.split('Pobierz plik')[-1].strip()
                    title = title.split('\n')[0].strip()
            
            # Get extension from span or URL
            ext_span = element.find('span', class_='extension')
            extension = None
            if ext_span:
                ext_text = ext_span.get_text().strip()
                if '.' in ext_text:
                    extension = ext_text.split('.')[-1].lower()
            if not extension:
                extension = extract_extension(full_url)
            
            if full_url and title:
                item_index += 1
                result['items'].append({
                    'type': 'file',
                    'url': full_url,
                    'title': title,
                    'extension': extension,
                    'section': current_section,
                    'sort_order': item_index
                })
    
    return result


# ============================================================
# RECURSIVE SCRAPING
# ============================================================

async def scrape_page_recursive(
    session: aiohttp.ClientSession,
    url: str,
    title: str,
    parent_id: Optional[str],
    path_parts: List[str],
    nodes: List[ScrapedNode],
    visited: Set[str],
    depth: int,
    sort_order: int,
    semaphore: asyncio.Semaphore
) -> None:
    """Recursively scrape a page and its subpages"""
    
    if depth > MAX_DEPTH:
        return
    
    if url in visited:
        return
    
    visited.add(url)
    
    # Create folder node for this page
    current_path = " > ".join(path_parts)
    folder_id = generate_id(url)
    folder_node = ScrapedNode(
        id=folder_id,
        parent_id=parent_id,
        title=title,
        node_type='folder',
        path=current_path,
        source_url=url,
        sort_order=sort_order
    )
    nodes.append(folder_node)
    
    # Fetch and parse page
    async with semaphore:
        html = await fetch_page(session, url)
        await asyncio.sleep(DELAY_BETWEEN_REQUESTS)
    
    if not html:
        return
    
    parsed = parse_subpage(html, url)
    
    # Add items (sections, files, links) in DOM order
    for item in parsed.get('items', []):
        if item['type'] == 'section':
            # Section headers are non-clickable separators
            section_id = generate_id(url + '_section_' + item['title'])
            section_node = ScrapedNode(
                id=section_id,
                parent_id=folder_id,
                title=item['title'],
                node_type='section',
                path=current_path + " > " + item['title'],
                source_url=url,
                sort_order=item['sort_order']
            )
            nodes.append(section_node)
        
        elif item['type'] == 'file':
            file_id = generate_id(item['url'])
            file_node = ScrapedNode(
                id=file_id,
                parent_id=folder_id,
                title=item['title'],
                node_type='file',
                path=current_path + " > " + item['title'],
                url=item['url'],
                extension=item.get('extension'),
                source_url=url,
                sort_order=item['sort_order']
            )
            nodes.append(file_node)
        
        elif item['type'] == 'link':
            link_id = generate_id(item['url'])
            link_node = ScrapedNode(
                id=link_id,
                parent_id=folder_id,
                title=item['title'],
                node_type='link',
                path=current_path + " > " + item['title'],
                url=item['url'],
                extension=item.get('extension'),
                source_url=url,
                sort_order=item['sort_order']
            )
            nodes.append(link_node)
    
    # Recursively process subcategories
    tasks = []
    for sub_info in parsed['subcategories']:
        sub_path_parts = path_parts + [sub_info['title']]
        task = scrape_page_recursive(
            session=session,
            url=sub_info['url'],
            title=sub_info['title'],
            parent_id=folder_id,
            path_parts=sub_path_parts,
            nodes=nodes,
            visited=visited,
            depth=depth + 1,
            sort_order=sub_info['sort_order'],
            semaphore=semaphore
        )
        tasks.append(task)
    
    # Run subcategory scraping concurrently
    if tasks:
        await asyncio.gather(*tasks)


async def scrape_baza_wiedzy() -> Dict[str, Any]:
    """Main function to scrape the entire Baza Wiedzy"""
    logger.info("Starting Baza Wiedzy scraping...")
    
    nodes: List[ScrapedNode] = []
    visited: Set[str] = set()
    
    async with aiohttp.ClientSession() as session:
        # Fetch main page
        html = await fetch_page(session, BAZA_WIEDZY_URL)
        if not html:
            raise HTTPException(status_code=503, detail="Nie można pobrać strony Bazy Wiedzy")
        
        # Parse main categories
        categories = parse_main_categories(html)
        logger.info(f"Found {len(categories)} main categories")
        
        # Create semaphore for concurrent request limiting
        semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
        
        # Scrape each category recursively
        tasks = []
        for cat_info in categories:
            task = scrape_page_recursive(
                session=session,
                url=cat_info['url'],
                title=cat_info['title'],
                parent_id=None,
                path_parts=[cat_info['title']],
                nodes=nodes,
                visited=visited,
                depth=1,
                sort_order=cat_info['sort_order'],
                semaphore=semaphore
            )
            tasks.append(task)
        
        await asyncio.gather(*tasks)
    
    # Convert to dict format
    nodes_dict = [node.to_dict() for node in nodes]
    
    # Count stats
    folders = sum(1 for n in nodes if n.type == 'folder')
    sections = sum(1 for n in nodes if n.type == 'section')
    files = sum(1 for n in nodes if n.type == 'file')
    links = sum(1 for n in nodes if n.type == 'link')
    
    logger.info(f"Scraping complete: {folders} folders, {sections} sections, {files} files, {links} links")
    
    return {
        "version": datetime.now().strftime("%Y%m%d%H%M"),
        "updated_at": datetime.now().isoformat(),
        "source": BAZA_WIEDZY_URL,
        "stats": {
            "folders": folders,
            "sections": sections,
            "files": files,
            "links": links,
            "total": len(nodes)
        },
        "nodes": nodes_dict
    }


# ============================================================
# API ENDPOINTS
# ============================================================

@router.get("/baza-wiedzy")
async def get_baza_wiedzy():
    """
    Scrapes and returns the knowledge base tree structure from gov.pl/kgpsp.
    
    This endpoint:
    1. Fetches the main Baza Wiedzy page
    2. Recursively scrapes all subcategories
    3. Extracts files (PDF, PPTX, etc.) and external links
    4. Returns a flat list of nodes with parent-child relationships
    
    The mobile app transforms this into a tree and caches it locally.
    """
    try:
        data = await scrape_baza_wiedzy()
        return data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Scraping error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Błąd podczas scrapowania: {str(e)}")


@router.get("/baza-wiedzy/status")
async def get_baza_wiedzy_status():
    """
    Returns the current status/configuration of the scraper.
    Useful for debugging.
    """
    return {
        "source_url": BAZA_WIEDZY_URL,
        "max_depth": MAX_DEPTH,
        "max_concurrent_requests": MAX_CONCURRENT_REQUESTS,
        "request_timeout": REQUEST_TIMEOUT
    }
