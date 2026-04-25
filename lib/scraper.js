/**
 * Base utility to fetch job page content.
 * Handles basic User-Agent headers to avoid some anti-bot detection.
 */
export async function fetchPageContent(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.statusText}`);
    }

    const html = await response.text();
    
    // Clean up unnecessary tags to save tokens for the LLM
    const cleanedHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
      .substring(0, 40000); // Max 40k chars for the agent to process

    return cleanedHtml;
  } catch (error) {
    console.error("Scraper Error (Fetch):", error.message);
    throw new Error("Target site blocked the scraper. Please try a screenshot instead.");
  }
}
