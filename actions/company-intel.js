"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { getModel } from "@/lib/gemini";
import { exec } from "child_process";
import util from "util";
import fs from "fs/promises";
import path from "path";

const execPromise = util.promisify(exec);

/**
 * Scrapes recent news about a company and generates interview talking points.
 * 
 * @param {string} applicationId - The ID of the saved job application.
 * @returns {Promise<{ talkingPointsMarkdown: string, recentNews: any[] }>}
 */
export async function generateCompanyIntel(applicationId) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    if (!applicationId) {
      throw new Error("A selected job is required.");
    }

    // 1. Fetch Job Application Details
    const application = await db.jobApplication.findUnique({
      where: {
        id: applicationId,
        userId: userId,
      },
      include: {
        job: true,
      },
    });

    if (!application) throw new Error("Job application not found.");

    const companyName = application.job.company;
    if (!companyName) throw new Error("Job does not have a company name specified.");

    // 2. Use a temporary python script to scrape Google News using the existing Playwright engine
    // Since we are running in a Node context, we can write a quick python script that uses engine.py
    
    const scriptContent = `
import asyncio
import json
import sys
from urllib.parse import quote_plus
from crawler.engine import CrawlerEngine

async def extract_news(page):
    return await page.evaluate('''() => {
        const articles = Array.from(document.querySelectorAll('article')).slice(0, 5);
        return articles.map(a => {
            const titleEl = a.querySelector('h4, h3, a');
            const timeEl = a.querySelector('time');
            return {
                title: titleEl ? titleEl.innerText : 'Unknown Title',
                time: timeEl ? timeEl.innerText : 'Recent',
                link: a.querySelector('a') ? a.querySelector('a').href : ''
            };
        });
    }''')

async def main():
    company = sys.argv[1]
    url = f"https://news.google.com/search?q={quote_plus(company)}&hl=en-US&gl=US&ceid=US%3Aen"
    engine = CrawlerEngine(headless=True)
    try:
        data = await engine.scrape_url(url, extract_news)
        print(json.dumps(data if data else []))
    except Exception as e:
        print(json.dumps([]))

if __name__ == "__main__":
    asyncio.run(main())
`;

    // Create a temporary script in the scripts directory
    const tempScriptPath = path.join(process.cwd(), "scripts", "temp_news_scraper.py");
    await fs.writeFile(tempScriptPath, scriptContent);

    // Execute the scraper
    const command = `python "${tempScriptPath}" "${companyName}"`;
    const { stdout } = await execPromise(command, {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONPATH: `${process.cwd()}/scripts` },
      timeout: 30000, // 30 seconds
    });

    // Cleanup
    await fs.unlink(tempScriptPath).catch(() => {});

    let newsItems = [];
    try {
        // Find the JSON array in the stdout
        const jsonMatch = stdout.match(/\[.*\]/s);
        if (jsonMatch) {
            newsItems = JSON.parse(jsonMatch[0]);
        }
    } catch (e) {
        console.error("Failed to parse news JSON", e);
    }

    // 3. Prompt Gemini AI
    const model = getModel();
    const prompt = `
You are an expert executive coach preparing a candidate for a job interview.
The candidate is interviewing at **${companyName}** for the role of **${application.job.title}**.

I have scraped the latest Google News headlines for this company:
${JSON.stringify(newsItems, null, 2)}

Your task is to generate an "Interview Intel Briefing". 
Provide 3-4 highly strategic talking points or questions the candidate can ask at the end of the interview based on this recent news. If the news is empty or irrelevant, provide generic but high-level strategic questions for this industry/role.

Return your response ONLY as a strict JSON object with this format:
{
  "talkingPointsMarkdown": "### 1. Strategic Point...\\n### 2. Strategic Point..."
}
Do not include markdown code block formatting (like \`\`\`json) in the response text itself, just the raw JSON string.
    `;

    const result = await model.generateContent(prompt);
    const rawResponse = result.response.text();
    
    // Strip markdown formatting if Gemini includes it
    const cleanedJson = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const parsed = JSON.parse(cleanedJson);

    return {
      success: true,
      talkingPointsMarkdown: parsed.talkingPointsMarkdown || "No intel generated.",
      recentNews: newsItems,
    };

  } catch (error) {
    console.error("[Company Intel Error]:", error);
    return {
      success: false,
      error: error.message || "An unexpected error occurred during analysis.",
    };
  }
}
