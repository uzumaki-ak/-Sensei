import requests
from bs4 import BeautifulSoup
import json
import sys

def scrape_job(url):
    print(f"--- [PYTHON SCRAPER] Target: {url} ---")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }

    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Clean up the soup for the LLM
        for script in soup(["script", "style", "svg"]):
            script.decompose()
            
        text_content = soup.get_text(separator=' ', strip=True)
        
        # We output a truncated version for the AI Agent bridge
        print("[SUCCESS] Data extracted. Ready for AI Processing.")
        
        # In a full microservice, we would ping the Gemini API here, 
        # but as a tool, we return the clean text to the caller.
        result = {
            "source": url,
            "raw_text": text_content[:15000] # Safe limit
        }
        
        return result

    except Exception as e:
        print(f"[ERROR] Python Scraper failed: {str(e)}")
        return None

if __name__ == "__main__":
    if len(sys.argv) > 1:
        target_url = sys.argv[1]
        data = scrape_job(target_url)
        if data:
            # Output as JSON for the JS parent process to consume
            print(json.dumps(data, indent=2))
    else:
        print("Usage: python scraper.py <url>")
