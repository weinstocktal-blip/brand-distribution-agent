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

Return ONLY valid JSON. No markdown. No backticks. No text before or after.

CRITICAL RULES FOR ACCURACY:
- VERIFY before listing a retail partner. Search the retailer website to confirm the brand is currently stocked. A press mention or showroom listing is NOT confirmation.
- DISTINGUISH showroom/PR representation from actual retail distribution. Only list actual retail distribution.
- If a brand website has a Stockists or Retailers page, use THAT as primary source.
- If you cannot confirm a retailer carries the brand, DO NOT list it. Leave empty.
- Made-to-order or by appointment from the brand own studio is DTC, not wholesale.
- Pop-up shops and temporary activations do not count as wholesale.
- For us_distribution: None = not sold in US. DTC Only = own website/studio only. DTC + Own Store(s) = own permanent physical store(s). Limited Wholesale = 1-5 verified US retail doors. Broad Wholesale = 6+ doors or major department store.
- confidence: High = verified from brand stockists page or retailer website. Medium = reliable press. Low = inference.
- Return ONLY the JSON object.`;

function extractJSON(text) {
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        try {
          return JSON.parse(text.substring(start, i + 1));
        } catch {
          start = -1;
        }
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

    let userMessage = "Research this fashion brand: " + brandName;
    if (website) {
      userMessage += ". Their website is: " + website;
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
      var errMsg = "API request failed";
      if (data && data.error) {
        errMsg = data.error.message || JSON.stringify(data.error);
      }
      return Response.json({ error: errMsg }, { status: response.status });
    }

    var rawText = "";
    if (data.content) {
      for (var i = 0; i < data.content.length; i++) {
        if (data.content[i].type === "text") {
          rawText += data.content[i].text + "\n";
        }
      }
    }
    rawText = rawText.trim();

    if (!rawText) {
      return Response.json({ error: "Agent returned no text." }, { status: 500 });
    }

    var parsed = extractJSON(rawText);

    if (!parsed) {
      return Response.json({
        error: "Could not parse agent response. Raw preview: " + rawText.substring(0, 200)
      }, { status: 500 });
    }

    parsed.success = true;
    parsed.brand = brandName;
    return Response.json(parsed);
  } catch (err) {
    return Response.json({ error: "Server error: " + err.message }, { status: 500 });
  }
}
