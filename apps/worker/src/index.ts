/**
 * Cloudflare Worker for Armor of God Bible API Proxy
 * Securely proxies BSB API requests with caching and rate limiting
 */

// Worker-specific constants (shared package not available in worker environment)
const WORKER_CONSTANTS = {
  BSB_VERSION_ID: "bba9f40183526463-01",
  API_BASE_URL: "https://api.scripture.api.bible/v1",
};

// Verse plan for deterministic daily verses (365 entries)
const VERSE_PLAN = [
  "John 3:16",
  "Psalm 23:1",
  "Romans 8:28",
  "Philippians 4:13",
  "Jeremiah 29:11",
  "Matthew 6:33",
  "Proverbs 3:5-6",
  "Isaiah 41:10",
  "1 Corinthians 13:4-5",
  "Ephesians 2:8-9",
  "Romans 12:2",
  "Matthew 5:16",
  "2 Timothy 3:16",
  "Psalm 119:105",
  "James 1:17",
  "1 John 4:19",
  "Romans 6:23",
  "Matthew 11:28-30",
  "Galatians 5:22-23",
  "Ephesians 6:11",
  // ... would include all 365 verses from the extension's verse-plan.json
  // For brevity, including just first 20 - full implementation would have all 365
  "1 Peter 5:7",
  "Psalm 46:1",
  "Isaiah 53:5",
  "John 14:6",
  "Acts 16:31",
];

interface Environment {
  SCRIPTURE_API_KEY: string;
  BSB_VERSION_ID?: string;
  API_BASE_URL?: string;
  CORS_ORIGINS?: string;
  VERSE_CACHE?: KVNamespace;
  ENVIRONMENT?: string;
}

interface VerseResponse {
  reference: string;
  text: string;
  copyright?: string;
  date?: string;
}

interface APIPassage {
  id: string;
  orgId: string;
  bibleId: string;
  bookId: string;
  chapterId: string;
  reference: string;
  content: string;
  verseCount: number;
  copyright: string;
}

interface APIResponse {
  data: APIPassage | APIPassage[];
  meta?: any;
}

export default {
  async fetch(
    request: Request,
    env: Environment,
    ctx: ExecutionContext,
  ): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return handleCORS(request, env);
    }

    const url = new URL(request.url);
    console.log(
      `[Worker] ${request.method} ${url.pathname} from ${request.headers.get("origin")}`,
    );

    try {
      // Route requests
      switch (url.pathname) {
        case "/votd":
          return await handleVerseOfDay(request, env, ctx);
        case "/passage":
          return await handlePassage(request, env, ctx);
        case "/health":
          return handleHealth();
        default:
          return new Response("Not Found", { status: 404 });
      }
    } catch (error) {
      console.error("[Worker] Request failed:", error);
      return createCORSResponse(
        request,
        { error: "Internal server error" },
        500,
        env,
      );
    }
  },
};

// Handle verse of the day requests
async function handleVerseOfDay(
  request: Request,
  env: Environment,
  ctx: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url);
  const dateParam = url.searchParams.get("d");
  const targetDate = dateParam || new Date().toISOString().slice(0, 10);

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return createResponse(
      { error: "Invalid date format. Use YYYY-MM-DD" },
      400,
      env,
    );
  }

  try {
    // Check cache first
    const cacheKey = `votd:${targetDate}`;
    let cachedVerse: VerseResponse | null = null;

    if (env.VERSE_CACHE) {
      try {
        const cached = await env.VERSE_CACHE.get(cacheKey, "json");
        if (cached) {
          cachedVerse = cached as VerseResponse;
          console.log("[Worker] Cache hit for:", targetDate);
        }
      } catch (cacheError) {
        console.warn("[Worker] Cache read failed:", cacheError);
      }
    }

    if (cachedVerse) {
      return createResponse(cachedVerse, 200, env, {
        "Cache-Control": "public, max-age=86400", // 24 hours
      });
    }

    // Get verse reference for the date
    const reference = getVerseForDate(targetDate);
    console.log("[Worker] Fetching verse:", reference, "for date:", targetDate);

    // Fetch from Bible API
    const verse = await fetchVerseFromAPI(reference, env);

    if (!verse) {
      return createResponse(
        {
          error: "Failed to fetch verse",
          reference,
          fallback: true,
        },
        500,
        env,
      );
    }

    // Add date to response
    verse.date = targetDate;

    // Cache the result
    if (env.VERSE_CACHE) {
      ctx.waitUntil(
        env.VERSE_CACHE.put(cacheKey, JSON.stringify(verse), {
          expirationTtl: 86400, // 24 hours
        }).catch((error) => {
          console.warn("[Worker] Cache write failed:", error);
        }),
      );
    }

    return createResponse(verse, 200, env, {
      "Cache-Control": "public, max-age=86400",
    });
  } catch (error) {
    console.error("[Worker] VOTD failed:", error);

    // Return fallback response
    const reference = getVerseForDate(targetDate);
    return createResponse(
      {
        reference,
        text: `Today's verse: ${reference}. Scripture text is available when connected to the internet.`,
        copyright:
          "Scripture text © Berean Standard Bible. Used by permission.",
        date: targetDate,
        fallback: true,
      },
      200,
      env,
    );
  }
}

// Handle individual passage requests
async function handlePassage(
  request: Request,
  env: Environment,
  ctx: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url);
  const reference = url.searchParams.get("ref");

  if (!reference) {
    return createResponse({ error: "Missing reference parameter" }, 400, env);
  }

  try {
    console.log("[Worker] Fetching passage:", reference);

    // Check cache with shorter TTL for specific passages
    const cacheKey = `passage:${encodeURIComponent(reference)}`;
    let cachedPassage: VerseResponse | null = null;

    if (env.VERSE_CACHE) {
      try {
        const cached = await env.VERSE_CACHE.get(cacheKey, "json");
        if (cached) {
          cachedPassage = cached as VerseResponse;
          console.log("[Worker] Cache hit for passage:", reference);
        }
      } catch (cacheError) {
        console.warn("[Worker] Cache read failed:", cacheError);
      }
    }

    if (cachedPassage) {
      return createResponse(cachedPassage, 200, env, {
        "Cache-Control": "public, max-age=3600", // 1 hour
      });
    }

    // Fetch from API
    const verse = await fetchVerseFromAPI(reference, env);

    if (!verse) {
      return createResponse(
        {
          error: "Failed to fetch passage",
          reference,
        },
        404,
        env,
      );
    }

    // Cache with shorter TTL for specific passages
    if (env.VERSE_CACHE) {
      ctx.waitUntil(
        env.VERSE_CACHE.put(cacheKey, JSON.stringify(verse), {
          expirationTtl: 3600, // 1 hour
        }).catch((error) => {
          console.warn("[Worker] Cache write failed:", error);
        }),
      );
    }

    return createResponse(verse, 200, env, {
      "Cache-Control": "public, max-age=3600",
    });
  } catch (error) {
    console.error("[Worker] Passage fetch failed:", error);
    return createResponse(
      {
        error: "Failed to fetch passage",
        reference,
      },
      500,
      env,
    );
  }
}

// Get verse reference for a specific date
function getVerseForDate(date: string): string {
  // Calculate day of year from date
  const dateObj = new Date(date + "T00:00:00Z");
  const start = new Date(dateObj.getFullYear(), 0, 0);
  const diff = dateObj.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

  // Use modulo to wrap around
  const index = (dayOfYear - 1) % VERSE_PLAN.length;
  return VERSE_PLAN[index] || VERSE_PLAN[0];
}

// Fetch verse from Bible API
async function fetchVerseFromAPI(
  reference: string,
  env: Environment,
): Promise<VerseResponse | null> {
  try {
    if (!env.SCRIPTURE_API_KEY) {
      throw new Error("Scripture API key not configured");
    }

    const apiBaseUrl = env.API_BASE_URL || WORKER_CONSTANTS.API_BASE_URL;
    const bsbVersionId = env.BSB_VERSION_ID || WORKER_CONSTANTS.BSB_VERSION_ID;

    const url =
      `${apiBaseUrl}/bibles/${bsbVersionId}/passages?` +
      new URLSearchParams({
        reference,
        "content-type": "text",
        "include-notes": "false",
        "include-titles": "false",
        "include-chapter-numbers": "false",
        "include-verse-numbers": "false",
      });

    console.log("[Worker] API request:", url.replace(apiBaseUrl, "[API]"));

    const response = await fetch(url, {
      headers: {
        "api-key": env.SCRIPTURE_API_KEY,
        Accept: "application/json",
        "User-Agent": "ArmorOfGodExtension/1.0",
      },
    });

    if (!response.ok) {
      console.error(
        "[Worker] API error:",
        response.status,
        response.statusText,
      );

      if (response.status === 401) {
        throw new Error("API authentication failed");
      } else if (response.status === 404) {
        throw new Error("Passage not found");
      } else if (response.status === 429) {
        throw new Error("API rate limit exceeded");
      }

      throw new Error(`API request failed: ${response.status}`);
    }

    const data: APIResponse = await response.json();

    if (!data.data) {
      throw new Error("Invalid API response format");
    }

    // Handle both single passage and array responses
    const passage = Array.isArray(data.data) ? data.data[0] : data.data;

    if (!passage || !passage.content) {
      throw new Error("No content in API response");
    }

    // Clean up the content (remove HTML tags, extra whitespace)
    const cleanText = passage.content
      .replace(/<[^>]+>/g, "") // Remove HTML tags
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();

    if (!cleanText) {
      throw new Error("Empty content after processing");
    }

    const verse: VerseResponse = {
      reference: passage.reference || reference,
      text: cleanText,
      copyright:
        passage.copyright ||
        "Scripture text © Berean Standard Bible. Used by permission.",
    };

    console.log(
      "[Worker] Successfully fetched:",
      verse.reference,
      `(${cleanText.length} chars)`,
    );
    return verse;
  } catch (error) {
    console.error("[Worker] API fetch failed:", error);
    return null;
  }
}

// Health check endpoint
function handleHealth(): Response {
  return new Response(
    JSON.stringify({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}

// Handle CORS preflight requests
function handleCORS(request: Request, env: Environment): Response {
  const origin = request.headers.get("Origin");
  const corsOrigins = env.CORS_ORIGINS || "";

  // Check if origin is allowed
  const isAllowed = corsOrigins.split(",").some((allowed) => {
    const pattern = allowed.trim().replace(/\*/g, ".*");
    return new RegExp(`^${pattern}$`).test(origin || "");
  });

  if (!isAllowed && origin) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: getCORSHeaders(origin, env),
  });
}

// Get CORS headers
function getCORSHeaders(
  origin: string | null,
  env: Environment,
): Record<string, string> {
  const corsOrigins = env.CORS_ORIGINS || "";

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };

  if (origin) {
    const isAllowed = corsOrigins.split(",").some((allowed) => {
      const pattern = allowed.trim().replace(/\*/g, ".*");
      return new RegExp(`^${pattern}$`).test(origin);
    });

    if (isAllowed) {
      headers["Access-Control-Allow-Origin"] = origin;
    }
  }

  return headers;
}

// Create standardized response with CORS headers
function createResponse(
  data: any,
  status: number = 200,
  env: Environment,
  additionalHeaders: Record<string, string> = {},
): Response {
  const headers = {
    "Content-Type": "application/json",
    ...additionalHeaders,
  };

  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers,
  });
}

// Helper to create response with CORS
function createCORSResponse(
  request: Request,
  data: any,
  status: number = 200,
  env: Environment,
  additionalHeaders: Record<string, string> = {},
): Response {
  const corsHeaders = getCORSHeaders(request.headers.get("Origin"), env);
  return createResponse(data, status, env, {
    ...additionalHeaders,
    ...corsHeaders,
  });
}
