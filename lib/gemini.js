import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const getModel = (modelName = "gemini-2.5-flash") => {
  return genAI.getGenerativeModel({ model: modelName });
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

  if (message.includes("invalid_api_key")) {
    return "Invalid Gemini API Key. Please check your .env file.";
  }

  return "AI is having a moment. Please try again shortly.";
};
