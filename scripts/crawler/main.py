import asyncio
import sys
import json
from engine import CrawlerEngine
from handlers import get_handler

async def run_crawler(url):
    engine = CrawlerEngine(headless=True)
    handler = get_handler(url)
    
    result = await engine.scrape_url(url, handler)
    
    if result:
        # Final cleanup for Node.js consumption
        print(json.dumps(result))
    else:
        print(json.dumps({"error": "Failed to extract data"}))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python main.py <url>")
        sys.exit(1)
        
    target_url = sys.argv[1]
    asyncio.run(run_crawler(target_url))
