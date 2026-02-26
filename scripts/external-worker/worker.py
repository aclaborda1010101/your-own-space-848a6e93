#!/usr/bin/env python3
"""
RAG External Worker — Playwright + PyMuPDF
Polls rag-architect for EXTERNAL_SCRAPE jobs, scrapes with Playwright or extracts PDF text.
Deploy on Railway/Render with the included Dockerfile.
"""

import os
import sys
import time
import json
import requests
from urllib.parse import urlparse
from bs4 import BeautifulSoup

# Config from environment
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
WORKER_ID = os.environ.get("WORKER_ID", f"py-worker-{os.getpid()}")
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "5"))

EDGE_URL = f"{SUPABASE_URL}/functions/v1/rag-architect"
HEADERS = {
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
}


def log(msg: str):
    print(f"[{WORKER_ID}] {msg}", flush=True)


def poll_job() -> dict | None:
    """Poll for next EXTERNAL_SCRAPE job."""
    try:
        resp = requests.post(
            EDGE_URL,
            headers=HEADERS,
            json={"action": "external-worker-poll", "workerId": WORKER_ID},
            timeout=15,
        )
        if resp.status_code != 200:
            log(f"Poll error: HTTP {resp.status_code}")
            return None
        data = resp.json()
        if data.get("job"):
            return data["job"]
        return None
    except Exception as e:
        log(f"Poll exception: {e}")
        return None


def complete_job(job_id: str, text: str, quality: str = "high"):
    """Report successful extraction."""
    try:
        resp = requests.post(
            EDGE_URL,
            headers=HEADERS,
            json={
                "action": "external-worker-complete",
                "jobId": job_id,
                "extractedText": text[:200000],
                "quality": quality,
            },
            timeout=30,
        )
        log(f"Complete job {job_id}: HTTP {resp.status_code}")
    except Exception as e:
        log(f"Complete error: {e}")


def fail_job(job_id: str, error: str):
    """Report failed extraction."""
    try:
        requests.post(
            EDGE_URL,
            headers=HEADERS,
            json={
                "action": "external-worker-fail",
                "jobId": job_id,
                "error": error[:2000],
            },
            timeout=15,
        )
        log(f"Failed job {job_id}: {error[:100]}")
    except Exception as e:
        log(f"Fail report error: {e}")


def is_pdf_url(url: str) -> bool:
    return urlparse(url).path.lower().endswith(".pdf")


def extract_pdf(url: str) -> str:
    """Download PDF and extract text with PyMuPDF."""
    import fitz  # PyMuPDF

    log(f"Downloading PDF: {url}")
    resp = requests.get(url, timeout=60, headers={"User-Agent": "JarvisRAG-Worker/1.0"})
    resp.raise_for_status()

    doc = fitz.open(stream=resp.content, filetype="pdf")
    text_parts = []
    for page in doc:
        text_parts.append(page.get_text())
    doc.close()

    text = "\n".join(text_parts).strip()
    log(f"PDF extracted: {len(text.split())} words from {doc.page_count} pages")
    return text


def scrape_with_playwright(url: str) -> str:
    """Render page with Playwright and extract text."""
    from playwright.sync_api import sync_playwright

    log(f"Scraping with Playwright: {url}")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            locale="es-ES",
        )
        page = context.new_page()

        # Accept cookies automatically
        page.on("dialog", lambda dialog: dialog.accept())

        try:
            page.goto(url, wait_until="networkidle", timeout=30000)
        except Exception:
            # Fallback to domcontentloaded if networkidle times out
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=15000)
            except Exception as e:
                browser.close()
                raise e

        # Try to dismiss cookie banners
        for selector in [
            "button:has-text('Aceptar')",
            "button:has-text('Accept')",
            "button:has-text('Acepto')",
            "[id*='cookie'] button",
            "[class*='cookie'] button",
        ]:
            try:
                btn = page.query_selector(selector)
                if btn:
                    btn.click()
                    page.wait_for_timeout(500)
                    break
            except Exception:
                pass

        # Wait for content to settle
        page.wait_for_timeout(2000)

        # Extract text
        html = page.content()
        browser.close()

    soup = BeautifulSoup(html, "html.parser")

    # Remove noise elements
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form", "iframe", "noscript"]):
        tag.decompose()

    text = soup.get_text(separator="\n", strip=True)
    # Clean up
    lines = [line.strip() for line in text.split("\n") if len(line.strip()) > 20]
    text = "\n".join(lines)

    log(f"Playwright extracted: {len(text.split())} words")
    return text


def process_job(job: dict):
    """Process a single EXTERNAL_SCRAPE job."""
    job_id = job["id"]
    url = job.get("url") or job.get("payload", {}).get("url", "")

    if not url:
        fail_job(job_id, "No URL in job payload")
        return

    log(f"Processing job {job_id}: {url}")

    try:
        if is_pdf_url(url):
            text = extract_pdf(url)
            quality = "high" if len(text.split()) > 500 else "medium"
        else:
            text = scrape_with_playwright(url)
            quality = "high" if len(text.split()) > 500 else "medium"

        word_count = len(text.split())
        if word_count < 50:
            fail_job(job_id, f"Extraction too short: {word_count} words")
            return

        complete_job(job_id, text, quality)
        log(f"✅ Job {job_id} completed: {word_count} words ({quality})")

    except Exception as e:
        fail_job(job_id, str(e))
        log(f"❌ Job {job_id} failed: {e}")


def main():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("ERROR: Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)

    log("🚀 External worker started")
    log(f"   Supabase: {SUPABASE_URL}")
    log(f"   Poll interval: {POLL_INTERVAL}s")

    consecutive_empty = 0
    while True:
        job = poll_job()
        if job:
            consecutive_empty = 0
            process_job(job)
        else:
            consecutive_empty += 1
            # Adaptive polling: slow down when idle
            wait = min(POLL_INTERVAL * (1 + consecutive_empty // 10), 30)
            time.sleep(wait)


if __name__ == "__main__":
    main()
