import { GoogleGenerativeAI } from "@google/generative-ai";
import { generateTextWithFallback } from "./ai-fallback.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
let googleKeyRejected = false;

export const getModel = (modelName = process.env.GEMINI_TEXT_MODEL || "gemini-3.1-flash-lite") => {
  const googleModel = genAI.getGenerativeModel({ model: modelName });

  return {
    async generateContent(input) {
      let googleError = null;
      if (process.env.GEMINI_API_KEY && !googleKeyRejected) {
        try {
          return await googleModel.generateContent(input);
        } catch (error) {
          googleError = error;
          if (/API_KEY_INVALID|API key not valid/i.test(String(error?.message || ""))) {
            googleKeyRejected = true;
          }
        }
      }

      const textParts = typeof input === "string"
        ? [input]
        : input?.contents?.flatMap((content) => content.parts || [])
            .map((part) => part.text);
      if (!textParts?.length || textParts.some((part) => typeof part !== "string")) {
        throw googleError || new Error("A Gemini key is required for image analysis.");
      }

      const generated = await generateTextWithFallback(
        [{ role: "user", content: textParts.join("\n") }],
        { maxTokens: 4096, excludeProviders: googleKeyRejected ? ["google"] : [] }
      );
      const outputText = input?.generationConfig?.responseMimeType === "application/json"
        ? generated.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
        : generated.text;
      const response = {
        text: () => outputText,
        candidates: [{ content: { parts: [{ text: outputText }] } }],
      };
      return { response };
    },
  };
};

/**
 * Formats Gemini API errors into user-friendly messages.
 */
export const handleGeminiError = (error) => {
  console.error("[Gemini Error]:", error);

  const message = error.message || "";
  
  if (message.includes("429") || message.includes("quota")) {
    return "Rate limit exceeded. Please wait about 30 seconds before trying again.";
  }
  
  if (message.includes("500") || message.includes("503")) {
    return "AI service is temporarily overloaded. Please try again in a few moments.";
  }

  if (/invalid_api_key|API_KEY_INVALID|API key not valid/i.test(message)) {
    return "The AI service key is invalid. Please ask the app owner to update it.";
  }

  if (message.includes("All text providers failed")) {
    return "The AI services are unavailable right now. Please try again shortly.";
  }

  return "AI is having a moment. Please try again shortly.";
};
