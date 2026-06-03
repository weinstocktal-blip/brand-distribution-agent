export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a fashion brand research agent. Given a brand name and optionally a website URL, research the brand and return ONLY a JSON object with these fields:

{
  "year_founded": <number or null if truly unknown>,
  "us_distribution": "<one of: None | DTC Only | DTC + Own Store(s) | Limited Wholesale | Broad Wholesale>",
  "us_retail_partners": "<comma-separated list of specific US retailers, or empty string>",
  "intl_distribution": "<description of international distribution, or empty string>",
  "confidence": "<Low | Medium | High>",
  "sources": "<brief note on where you found this info>"
}

Rules:
- Search the brand's website (especially About, Stockists, Press pages) and fashion press.
- For us_distribution:
  - "None" = not sold in the US at all
  - "DTC Only" = only their own website, no physical retail
  - "DTC + Own Store(s)" = own website plus own physical store(s)
  - "Limited Wholesale" = 1-5 US retail doors
  - "Broad Wholesale" = 6+ US retail doors or major department stores
- For us_retail_partners: list actual names. Don't guess. Leave empty if unsure.
- For intl_distribution: specific countries/retailers if found.
- confidence: High = clear data from brand site or reliable press. Medium = indirect. Low = inference.
- Return ONLY the JSON object. No markdown. No explanation.`;

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

    const cleaned = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        return Response.json(
          { error: "Could not parse agent response", raw: cleaned },
          { status: 500 }
        );
      }
    }

    return Response.json({ success: true, brand: brandName, ...parsed });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
