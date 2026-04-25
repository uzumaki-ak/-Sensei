"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

/**
 * Saves the Telegram Chat ID to the user's profile and sends a test message.
 * 
 * @param {string} chatId - The user's Telegram Chat ID.
 * @returns {Promise<{ success: boolean, message?: string, error?: string }>}
 */
export async function connectTelegramSniper(chatId) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    if (!chatId) {
      throw new Error("Chat ID is required.");
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        throw new Error("TELEGRAM_BOT_TOKEN is not configured on the server.");
    }

    // Send a test message
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(telegramApiUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            chat_id: chatId,
            text: "🎯 Connection successful! You are now subscribed to the Sensai AI Midnight Job Hunt. I will snipe new job listings and send them to you instantly.",
            parse_mode: "HTML",
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Telegram API Error: ${errorData.description || "Failed to send message."}`);
    }

    // Save to Database
    await db.user.update({
        where: { clerkUserId: userId },
        data: { telegramChatId: chatId }
    });

    return {
      success: true,
      message: "Telegram Sniper connected successfully!",
    };

  } catch (error) {
    console.error("[Telegram Connection Error]:", error);
    return {
      success: false,
      error: error.message || "An unexpected error occurred.",
    };
  }
}

/**
 * Disconnects the Telegram sniper.
 */
export async function disconnectTelegramSniper() {
    try {
        const { userId } = await auth();
        if (!userId) throw new Error("Unauthorized");
    
        await db.user.update({
            where: { clerkUserId: userId },
            data: { telegramChatId: null }
        });
    
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
}
