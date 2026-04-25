import asyncio
import sys
import json
import os

# Ensure the discovery and engine logic is accessible
sys.path.append(os.path.join(os.getcwd(), "scripts", "crawler"))

from discovery import DiscoveryEngine
from engine import CrawlerEngine
from handlers import get_handler

async def test_my_hunt(query):
    print(f"\n🚀 [MASTER TEST] Starting Autonomous Hunt for: {query}")
    print("---------------------------------------------------------")
    
    # 1. Discovery Phase
    discovery = DiscoveryEngine()
    print("Step 1: Discovering Job Links on LinkedIn/Google...")
    discovery_result = await discovery.run_discovery(query)
    
    urls = discovery_result.get("discovered_urls", [])
    
    if not urls:
        print("❌ No jobs found. Try adjusting the query.")
        return

    print(f"✅ Found {len(urls)} fresh opportunities!")
    for idx, url in enumerate(urls, 1):
        print(f"  {idx}. {url}")

    # 2. Scraping Phase (Test the first one)
    target_url = urls[0]
    print(f"\nStep 2: Deep-Scraping Job Details for: {target_url}")
    
    engine = CrawlerEngine(headless=True)
    handler = get_handler(target_url)
    
    job_data = await engine.scrape_url(target_url, handler)
    
    print("\n✅ SUCCESS! Extracted Data for AI Agent:")
    print(json.dumps(job_data, indent=2))
    print("\n---------------------------------------------------------")
    print("Everything is working! Your midnight cron job is ready.")

if __name__ == "__main__":
    # Custom query from the user
    query = "App Development jobs in New Delhi"
    asyncio.run(test_my_hunt(query))
