export const maxDuration = 300; // Raised from 60 so the agent can run many searches without timing out.
// NOTE: the real cap depends on your Vercel plan (Hobby is lower than Pro). Verify this value is allowed on your plan.

const SYSTEM_PROMPT = `You are a fashion brand research agent. Given a brand name and optionally a website URL, research EVERYWHERE the brand is sold and return ONLY a JSON object with these fields:

{
  "year_founded": <number or null if truly unknown>,
  "us_distribution": "<None | DTC Only | DTC + Own Store(s) | Limited Wholesale | Broad Wholesale>",
  "us_retail_partners": "<comma-separated list of US retailers that stock the brand>",
  "intl_distribution": "<description of international distribution, or empty string>",
  "confidence": "<Low | Medium | High>",
  "sources": "<brief note on where you found this info>"
}

Return ONLY valid JSON. No markdown. No backticks. No text before or after.

RESEARCH PROCESS - be exhaustive, do NOT stop early. Your goal is maximum coverage of every retailer that sells this brand.
1. First, identify the brand's profile: category (e.g. apparel, tableware, jewelry, homeware), price tier (mass / contemporary / luxury), aesthetic, and home country. This determines which retailers are even plausible.
2. Check the brand's own website Stockists / Retailers / "Where to Buy" / "Find in Store" page. Treat this as a STARTING point only - brands routinely omit retailers from it.
3. Run multiple generic searches, varying the wording: "<brand> stockists", "buy <brand> online", "<brand> retailers", "where to buy <brand>", "<brand> available at".
4. Search for the brand BY NAME at major retailers individually (one search each, not one combined search). Start with these and add any others that fit the brand's category and tier:
   - Luxury / contemporary e-tail: Net-a-Porter, Moda Operandi, Ssense, MatchesFashion, Mytheresa, Farfetch, The Webster, FWRD
   - Department stores: Nordstrom, Saks Fifth Avenue, Bergdorf Goodman, Neiman Marcus, Bloomingdale's, Liberty London, Selfridges
   - Contemporary / lifestyle: Shopbop, Revolve, Need Supply, Garmentory, Verishop
   - Category-specific (use when relevant): for homeware/tableware - MoMA Design Store, Goop, Coming Soon, March SF, Food52; for jewelry - Catbird, Twist; etc.
5. EXPAND as you learn: once you know the brand's category and region, search additional retailers specific to that niche and country. Keep going until new searches stop turning up new retailers.

LISTING RULES:
- Distinguish actual retail distribution from showroom / PR / press mentions. Only list retailers that actually SELL the product.
- If a retailer currently sells the brand, LIST IT. Never omit a confirmed retailer.
- If a retailer appears to sell it but you cannot fully confirm it is current, STILL list it, and lower the overall confidence to Medium or Low, noting the uncertainty in "sources". Do not silently drop it.
- Made-to-order / by-appointment from the brand's own studio is DTC, not wholesale. Pop-ups and temporary activations do not count.
- us_distribution: None = not sold in US. DTC Only = own site/studio only. DTC + Own Store(s) = own permanent store(s). Limited Wholesale = 1-5 US doors. Broad Wholesale = 6+ doors or a major department store.
- confidence: High = confirmed from retailer sites or the brand's stockist page. Medium = reliable press. Low = inference.

Return ONLY the JSON object.`;

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
        // Big search budget so the agent can check many retailers individually.
        // Raise/lower this to trade off coverage vs. cost and latency.
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 20 }],
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
