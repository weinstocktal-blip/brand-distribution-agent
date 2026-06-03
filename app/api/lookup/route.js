export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a fashion brand research agent. Given a brand name and optionally a website URL, research the brand and return ONLY a JSON object with these fields:

{
  "year_founded": <number or null if truly unknown>,
  "us_distribution": "<one of: None | DTC Only | DTC + Own Store(s) | Limited Wholesale | Broad Wholesale>",
  "us_retail_partners": "<comma-separated list of VERIFIED US retailers, or empty string>",
  "intl_distribution": "<description of international distribution, or empty string>",
  "confidence": "<Low | Medium | High>",
  "sources": "<brief note on where you found this info>"
}

Return ONLY valid JSON. No markdown backticks. No text before or after the JSON object.

CRITICAL RULES FOR ACCURACY:
- VERIFY before listing a retail partner. Search the retailer's own website to confirm the brand is currently stocked there. A press mention or showroom listing is NOT confirmation of retail distribution.
- DISTINGUISH between showroom/PR representation (e.g., brand is represented by a showroom for wholesale meetings) and actual retail distribution (brand is available for purchase at a store). Only list actual retail distribution.
- If a brand's website has a "Stockists" or "Retailers" page, use THAT as the primary source. It is more reliable than press coverage.
- If you cannot confirm a retailer carries the brand by finding it on the retailer's website or the brand's own stockists page, DO NOT list it. Leave the field empty instead.
- "Made-to-order" or "by appointment" from the brand's own studio is DTC, not wholesale.
- A brand being featured in a magazine article mentioning a retailer does NOT mean the retailer carries them.
- Pop-up shops and temporary activations do not count as wholesale distribution.
- For us_distribution classification:
  - "None" = not sold in the US at all
  - "DTC Only" = only through their own website or studio, no retail partners
  - "DTC + Own Store(s)" = own website plus their own permanent physical store(s)
  - "Limited Wholesale" = currently stocked at 1-5 VERIFIED US retail doors
  - "Broad Wholesale" = currently stocked at 6+ US retail doors or a major department store chain
- For year_founded: look for "founded in," "established," "launched," or "since" on the brand's About page. If not found, leave null.
- confidence: High = verified from brand's own stockists page or retailer's website. Medium = from reliable press but not directly verified. Low = inference or uncertain.
- IMPORTANT: Return ONLY the JSON object. Nothing else.`;

function extractJSON(text) {
  const cleaned = text.replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {}

  let depth = 0;
  let start = -1;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (cleaned[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        try {
          return JSON.parse(cleaned.substring(start, i + 1));
        } catch {}
      }
    }
  }

  return null;
}

export async function POST(request) {
  try {
    const { brandName, website } = await request.json();

    if (!brandName) {
      return Response.json({ error: "Brand name is required" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "API key not configured" }, { status: 500 });
    }

    let userMessage = `Research this fashion brand: "${brandName}"`;
    if (website) {
      userMessage += `. Their website is: ${website}`;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "web-search-2025-03-05",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data.error?.message || JSON.stringify(data.error) || "API request failed";
      return Response.json({ error: errMsg }, { status: response.status });
    }

    const textBlocks = (data.content || []).filter((b) => b.type === "text");
    const rawText = textBlocks.map((b) => b.text).join("\n").trim();

    if (!rawText) {
      return Response.json(
        { error: "Agent returned no text response." },
        { status: 500 }
      );
    }

    const parsed = extractJSON(rawText);

    if (!parsed) {
      return Response.json(
        { error: "Could not parse agent response", raw: rawText.substring(0, 500) },
        { status: 500 }
      );
    }

    return Response.json({ success: true, brand: brandName, ...parsed });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
