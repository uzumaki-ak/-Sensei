import { fetchPageContent } from "./lib/scraper.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function testScraper(url) {
  console.log(`\n[SCRAPER TEST] Targeting: ${url}`);
  
  try {
    // 1. Test Fetching
    const html = await fetchPageContent(url);
    console.log("[SCRAPER TEST] HTML Fetched successfully (truncated):", html.substring(0, 100) + "...");

    // 2. Test AI Extraction
    const prompt = `
      You are an expert recruitment parser. Extract job details from the provided HTML.
      Return strict JSON ONLY.
      JSON keys: "title", "company", "description", "techStack" (array), "recruiterEmail".
      
      HTML Content:
      ${html}
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```(?:json)?\n?/g, "").trim();
    const scrapedData = JSON.parse(text);

    console.log("\n[SCRAPER TEST] SUCCESS! AI Extracted Data:");
    console.log(JSON.stringify(scrapedData, null, 2));

  } catch (error) {
    console.error("\n[SCRAPER TEST] FAILED:", error.message);
  }
}

// Test with a generic Y-Combinator job or similar
testScraper("https://www.ycombinator.com/jobs/role/software-engineer");
