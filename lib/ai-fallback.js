function parseCsv(value, fallback = []) {
  if (!value || !String(value).trim()) return fallback;
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePositiveInteger(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.floor(numeric);
}

function resolveTimeoutMs(value, fallback) {
  return parsePositiveInteger(value) || parsePositiveInteger(fallback) || 20000;
}

function resolveMaxAttempts(value, fallback) {
  if (value === Infinity) return Infinity;
  return parsePositiveInteger(value) || parsePositiveInteger(fallback) || Infinity;
}

const DEFAULT_TEXT_TIMEOUT_MS = resolveTimeoutMs(process.env.AI_TEXT_TIMEOUT_MS, 25000);
const DEFAULT_EMBED_TIMEOUT_MS = resolveTimeoutMs(process.env.AI_EMBED_TIMEOUT_MS, 15000);
const DEFAULT_TEXT_MAX_ATTEMPTS = resolveMaxAttempts(process.env.AI_TEXT_MAX_ATTEMPTS, 8);
const DEFAULT_EMBED_MAX_ATTEMPTS = resolveMaxAttempts(process.env.AI_EMBED_MAX_ATTEMPTS, 6);

function readGeminiApiKey() {
  return process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
}

function resolveTextProviders() {
  const googleKey = readGeminiApiKey();
  const providerMap = {
    google: googleKey
      ? {
          name: "google",
          apiKey: googleKey,
          endpoint:
            process.env.GOOGLE_GEMINI_BASE_URL ||
            "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
          models: parseCsv(process.env.GOOGLE_GEMINI_MODELS, [
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite",
          ]),
        }
      : null,
    openrouter: process.env.OPENROUTER_API_KEY
      ? {
          name: "openrouter",
          apiKey: process.env.OPENROUTER_API_KEY,
          endpoint:
            process.env.OPENROUTER_BASE_URL ||
            "https://openrouter.ai/api/v1/chat/completions",
          models: parseCsv(process.env.OPENROUTER_MODELS, [
            "openrouter/free",
            "openai/gpt-oss-20b:free",
          ]),
        }
      : null,
    groq: process.env.GROQ_API_KEY
      ? {
          name: "groq",
          apiKey: process.env.GROQ_API_KEY,
          endpoint:
            process.env.GROQ_BASE_URL ||
            "https://api.groq.com/openai/v1/chat/completions",
          models: parseCsv(process.env.GROQ_MODELS, ["llama-3.1-8b-instant"]),
        }
      : null,
    euron: process.env.EURON_API_KEY
      ? {
          name: "euron",
          apiKey: process.env.EURON_API_KEY,
          endpoint:
            process.env.EURON_BASE_URL ||
            "https://api.euron.one/api/v1/euri/chat/completions",
          models: parseCsv(process.env.EURON_MODELS, [
            "gpt-4.1-nano",
            "gpt-4.1-mini",
            "openai/gpt-oss-20b",
          ]),
        }
      : null,
  };

  const configuredOrder = parseCsv(process.env.MODEL_PROVIDER_ORDER, [
    "google",
    "openrouter",
    "groq",
    "euron",
  ]);

  const ordered = [];
  const used = new Set();

  for (const name of configuredOrder) {
    const provider = providerMap[name];
    if (provider) {
      ordered.push(provider);
      used.add(name);
    }
  }

  for (const [name, provider] of Object.entries(providerMap)) {
    if (provider && !used.has(name)) {
      ordered.push(provider);
    }
  }

  return ordered;
}

function readTextFromPayload(payload) {
  if (!payload || typeof payload !== "object") return "";
  const choices = payload.choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const first = choices[0] || {};

  if (typeof first?.message?.content === "string") {
    return first.message.content.trim();
  }

  if (Array.isArray(first?.message?.content)) {
    const text = first.message.content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();
    if (text) return text;
  }

  if (typeof first?.text === "string") return first.text.trim();
  return "";
}

function normalizeError(error) {
  if (error instanceof Error) return error.message;
  return "unknown error";
}

async function callTextProvider(provider, model, messages, options) {
  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${provider.apiKey}`,
  };

  if (provider.name === "google") {
    headers["x-goog-api-key"] = provider.apiKey;
  }

  if (provider.name === "openrouter") {
    headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL || "http://localhost:3000";
    headers["X-Title"] = "ai-career-coach";
  }

  const timeoutMs = resolveTimeoutMs(options?.timeoutMs, DEFAULT_TEXT_TIMEOUT_MS);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(provider.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: typeof options?.temperature === "number" ? options.temperature : 0.2,
        max_tokens: typeof options?.maxTokens === "number" ? options.maxTokens : 900,
        response_format: options?.responseFormat,
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`status ${response.status}: ${raw.slice(0, 220)}`);
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`invalid json response: ${raw.slice(0, 220)}`);
    }

    const text = readTextFromPayload(parsed);
    if (!text) throw new Error("empty model response");
    return text;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateTextWithFallback(messages, options = {}) {
  const providers = resolveTextProviders();
  const trace = [];
  const maxAttempts = resolveMaxAttempts(options?.maxAttempts, DEFAULT_TEXT_MAX_ATTEMPTS);
  let attempts = 0;

  if (providers.length === 0) {
    throw new Error(
      "No AI provider key configured. Add at least one of: GEMINI_API_KEY / OPENROUTER_API_KEY / GROQ_API_KEY / EURON_API_KEY"
    );
  }

  outer: for (const provider of providers) {
    for (const model of provider.models) {
      if (attempts >= maxAttempts) break outer;
      attempts += 1;

      try {
        const text = await callTextProvider(provider, model, messages, options);
        trace.push({ provider: provider.name, model, success: true, attempt: attempts });
        return { text, trace, provider: provider.name, model };
      } catch (error) {
        trace.push({
          provider: provider.name,
          model,
          success: false,
          attempt: attempts,
          error: normalizeError(error).slice(0, 260),
        });
      }
    }
  }

  const details = trace
    .map(
      (item) =>
        `${item.provider}/${item.model} [#${item.attempt}]: ${item.error || "failed"}`
    )
    .join(" | ");

  throw new Error(`All text providers failed. ${details}`);
}

function resolveEmbeddingProviders() {
  const googleKey = readGeminiApiKey();
  const providerMap = {
    euron: process.env.EURON_API_KEY
      ? {
          name: "euron",
          apiKey: process.env.EURON_API_KEY,
          endpoint:
            process.env.EURON_EMBEDDING_BASE_URL ||
            "https://api.euron.one/api/v1/euri/embeddings",
          models: parseCsv(process.env.EURON_EMBEDDING_MODELS, ["text-embedding-3-small"]),
        }
      : null,
    groq: process.env.GROQ_API_KEY
      ? {
          name: "groq",
          apiKey: process.env.GROQ_API_KEY,
          endpoint:
            process.env.GROQ_EMBEDDING_BASE_URL ||
            "https://api.groq.com/openai/v1/embeddings",
          models: parseCsv(process.env.GROQ_EMBEDDING_MODELS, ["text-embedding-3-small"]),
        }
      : null,
    google: googleKey
      ? {
          name: "google",
          apiKey: googleKey,
          models: parseCsv(process.env.GOOGLE_GEMINI_EMBEDDING_MODELS, ["text-embedding-004"]),
        }
      : null,
  };

  const configuredOrder = parseCsv(process.env.EMBEDDING_PROVIDER_ORDER, [
    "euron",
    "groq",
    "google",
  ]);

  const ordered = [];
  const used = new Set();
  for (const name of configuredOrder) {
    const provider = providerMap[name];
    if (provider) {
      ordered.push(provider);
      used.add(name);
    }
  }

  for (const [name, provider] of Object.entries(providerMap)) {
    if (provider && !used.has(name)) ordered.push(provider);
  }
  return ordered;
}

async function callOpenAIEmbedding(provider, model, text, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(provider.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: text,
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`status ${response.status}: ${raw.slice(0, 220)}`);
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`invalid json response: ${raw.slice(0, 220)}`);
    }

    const vector = parsed?.data?.[0]?.embedding;
    if (!Array.isArray(vector) || vector.length === 0) {
      throw new Error("empty embedding vector");
    }

    return vector.map((value) => Number(value) || 0);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function callGoogleEmbedding(apiKey, model, text, timeoutMs) {
  const normalizedModel = String(model || "text-embedding-004").replace(/^models\//, "");
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${normalizedModel}:embedContent?key=${apiKey}`;
  const payload = {
    model: `models/${normalizedModel}`,
    content: {
      parts: [{ text }],
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`status ${response.status}: ${raw.slice(0, 220)}`);
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`invalid json response: ${raw.slice(0, 220)}`);
    }

    const vector = parsed?.embedding?.values;
    if (!Array.isArray(vector) || vector.length === 0) {
      throw new Error("empty embedding vector");
    }

    return vector.map((value) => Number(value) || 0);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function createEmbeddingWithFallback(text, options = {}) {
  const cleanText = String(text || "").trim();
  if (!cleanText) throw new Error("Text is required for embedding.");

  const providers = resolveEmbeddingProviders();
  const trace = [];
  const timeoutMs = resolveTimeoutMs(options?.timeoutMs, DEFAULT_EMBED_TIMEOUT_MS);
  const maxAttempts = resolveMaxAttempts(options?.maxAttempts, DEFAULT_EMBED_MAX_ATTEMPTS);
  let attempts = 0;

  if (providers.length === 0) {
    throw new Error(
      "No embedding provider key configured. Add EURON_API_KEY / GROQ_API_KEY / GEMINI_API_KEY."
    );
  }

  outer: for (const provider of providers) {
    for (const model of provider.models) {
      if (attempts >= maxAttempts) break outer;
      attempts += 1;

      try {
        const embedding =
          provider.name === "google"
            ? await callGoogleEmbedding(provider.apiKey, model, cleanText, timeoutMs)
            : await callOpenAIEmbedding(provider, model, cleanText, timeoutMs);

        trace.push({ provider: provider.name, model, success: true, attempt: attempts });
        return { embedding, trace, provider: provider.name, model };
      } catch (error) {
        trace.push({
          provider: provider.name,
          model,
          success: false,
          attempt: attempts,
          error: normalizeError(error).slice(0, 260),
        });
      }
    }
  }

  const details = trace
    .map(
      (item) =>
        `${item.provider}/${item.model} [#${item.attempt}]: ${item.error || "failed"}`
    )
    .join(" | ");

  throw new Error(`All embedding providers failed. ${details}`);
}

export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) {
    return 0;
  }
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i += 1) {
    const x = Number(a[i]) || 0;
    const y = Number(b[i]) || 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (!denom) return 0;
  return dot / denom;
}

export function splitTextForEmbedding(text, chunkSize = 900, overlap = 150) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= chunkSize) return [clean];

  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + chunkSize, clean.length);
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks.filter(Boolean);
}

export function buildUserTextPrompt(systemText, userText) {
  return [
    {
      role: "system",
      content: String(systemText || "").trim(),
    },
    {
      role: "user",
      content: String(userText || "").trim(),
    },
  ];
}

export function summarizeProviderTrace(trace = []) {
  if (!Array.isArray(trace)) return "No trace.";
  return trace
    .map(
      (item) =>
        `${item.provider}/${item.model}: ${item.success ? "ok" : item.error || "failed"}`
    )
    .join(" | ");
}
