import asyncio
import random
import sys
from playwright.async_api import async_playwright
from playwright_stealth import Stealth


def log(message):
    print(message, file=sys.stderr)


class CrawlerEngine:
    def __init__(self, headless=True):
        self.headless = headless
        self.user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/119.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, Gecko) Chrome/118.0.0.0 Safari/537.36"
        ]

    async def get_browser_context(self, playwright):
        browser = await playwright.chromium.launch(headless=self.headless)
        context = await browser.new_context(
            user_agent=random.choice(self.user_agents),
            viewport={'width': 1280, 'height': 720}
        )
        return browser, context

    async def scrape_url(self, url, handler=None):
        try:
            async with async_playwright() as p:
                browser, context = await self.get_browser_context(p)
                page = await context.new_page()
                
                # Apply Stealth
                await Stealth().apply_stealth_async(page)
                
                # Stealth: Add randomized delays
                await asyncio.sleep(random.uniform(1, 4))
                
                try:
                    log(f"[ENGINE] Navigating to {url}...")
                    await page.goto(url, wait_until="load", timeout=60000)
                    
                    # Handle potential popups (Common on Internshala/Indeed)
                    try:
                        popups = [".close", "[aria-label='Close']", "#close-button", ".modal-close"]
                        for selector in popups:
                            if await page.isVisible(selector):
                                await page.click(selector)
                                log(f"[ENGINE] Closed popup: {selector}")
                    except Exception:
                        pass

                    # Human-like behavior: Scroll down
                    await page.evaluate("window.scrollTo(0, document.body.scrollHeight / 3)")
                    await asyncio.sleep(random.uniform(1, 2))
                    
                    data = None
                    if handler:
                        try:
                            data = await handler(page)
                            # Check if data is essentially empty
                            if data and not any(data.values()):
                                 data = None
                        except Exception as he:
                            log(f"[ENGINE WARNING] Handler failed, falling back: {he}")
                    
                    if not data:
                        data = await self.universal_fallback(page)
                    
                    return data
                except Exception as e:
                    log(f"[ENGINE ERROR] Failed scraping: {str(e)}")
                    return None
                finally:
                    await browser.close()
        except Exception as error:
            log(f"[ENGINE ERROR] Playwright failed to start: {error}")
            return None

    async def universal_fallback(self, page):
        """
        Extracts the main body text as a fallback if site-specific selectors fail.
        """
        log("[ENGINE] Running Universal Heuristic Fallback...")
        content = await page.evaluate("""() => {
            // Remove fluff
            const ignore = ['script', 'style', 'nav', 'footer', 'header', 'svg'];
            ignore.forEach(tag => {
                document.querySelectorAll(tag).forEach(el => el.remove());
            });
            return document.body.innerText.substring(0, 20000); 
        }""")
        return {"raw_text": content, "method": "heuristic"}
