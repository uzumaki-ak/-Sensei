import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Isolated test function for Phase 2: Web Scraping
async function scrapeJobPage(url) {
  console.log(`[Phase 2] Attempting to scrape URL: ${url}`);
  try {
    // 1. Fetch raw HTML
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch page");
    let html = await response.text();
    
    // 2. We use regex or simple string truncation to avoid token limits for massive HTML
    // A production version would use Cheerio here to grab the 'body'.
    html = html.substring(0, 30000); // Send first 30k chars

    // 3. Agent extraction
    console.log("[Phase 2] HTML acquired, passing to Extract Agent...");
    const prompt = `
      You are an expert job parsing agent. Extract the following details from the HTML provided:
      Produce strict JSON ONLY with these keys: 
      "title" (string), "company" (string), "description" (string, max 3 sentences), "techStack" (array of strings), "recruiterEmail" (string or null).
      
      HTML CONTENT:
      ${html}
    `;

    const result = await model.generateContent(prompt);
    const jsonStr = result.response.text().replace(/```(?:json)?\n?/g, "").trim();
    const scrapedData = JSON.parse(jsonStr);
    
    console.log("[Phase 2] SUCCESS! Data Scraped:");
    console.log(scrapedData);
    return scrapedData;

  } catch (error) {
    console.error("[Phase 2] Error Scraping:", error.message);
    throw error;
  }
}

// Isolated test function for Phase 3: Agentic Email Generation
async function generateColdEmail(jobData) {
  console.log(`\n[Phase 3] Generating personalized cold email for ${jobData.company}...`);
  try {
    const prompt = `
      You are an expert career coach helping a user write a cold email.
      The user is applying for: ${jobData.title} at ${jobData.company}.
      The job's tech stack is: ${jobData.techStack.join(", ")}.
      
      Write a highly enthusiastic, incredibly short (max 4 sentences) cold email to a recruiter highlighting fit with their stack.
      Do not include formal headers, just the subject line and body.
    `;

    const result = await model.generateContent(prompt);
    console.log("[Phase 3] SUCCESS! Email Generated:");
    console.log("-------------------------------------------------");
    console.log(result.response.text().trim());
    console.log("-------------------------------------------------");

  } catch (error) {
    console.error("[Phase 3] Error Generating Email:", error.message);
  }
}

async function runTests() {
  console.log("=== STARTING AGENTIC TESTS ===\n");
  // Let's test with a Y-Combinator job or similar generic job board URL.
  // We'll use a dummy URL or any safe static URL with job keywords.
  // Using a sample hackernews thread or wikipedia page just to test LLM parsing.
  const testUrl = "https://news.ycombinator.com/item?id=38102377"; // Standard HN thread
  
  const jobData = await scrapeJobPage(testUrl);
  if (jobData) {
    await generateColdEmail(jobData);
  }
}

runTests();
