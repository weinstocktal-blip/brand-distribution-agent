export const maxDuration = 300; // Raised from 60 so the agent can run many searches without timing out.
// NOTE: the real cap depends on your Vercel plan (Hobby is lower than Pro). Verify this value is allowed on your plan.

const SYSTEM_PROMPT = `You are a fashion brand research agent. Given a brand name and optionally a website URL, research where the brand is sold and return ONLY a JSON object with these fields:

{
  "year_founded": <number or null if truly unknown>,
  "us_distribution": "<None | DTC Only | DTC + Own Store(s) | Limited Wholesale | Broad Wholesale>",
  "us_retail_partners": "<comma-separated list of VERIFIED US retailers>",
  "unconfirmed_partners": "<comma-separated list of retailers mentioned but NOT verified on their own site>",
  "intl_distribution": "<description of international distribution, or empty string>",
  "confidence": "<Low | Medium | High>",
  "sources": "<brief note on where you found this info>"
}

Return ONLY valid JSON. No markdown. No backticks. No text before or after.

BRAND IDENTITY — RESOLVE FIRST:
Before any retailer research, pin down exactly which brand this is. Search for the brand website, confirm the category (jewelry, apparel, tableware, etc.), and note any ambiguity. If the brand name is a common word or name (e.g. "Dorsey", "Union", "Camp"), you MUST verify every result refers to THIS specific brand by matching the category, product type, and website. A search result about a different company or person with the same name is garbage — discard it.

RESEARCH — TWO PASSES:

PASS 1: DISCOVER candidates (cast a wide net).
- Check the brand's own Stockists / Retailers / "Where to Buy" page.
- Run broad searches: "<brand> stockists", "buy <brand> online", "<brand> retailers", "where to buy <brand>".
- Think about which major retailers are plausible given the brand's category and tier, and search for each:
  Luxury/contemporary e-tail: Net-a-Porter, Moda Operandi, Ssense, MatchesFashion, Mytheresa, Farfetch, The Webster, FWRD
  Department stores: Nordstrom, Saks Fifth Avenue, Bergdorf Goodman, Neiman Marcus, Bloomingdale's
  Contemporary/lifestyle: Shopbop, Revolve, Garmentory, Verishop
  Category-specific (jewelry: Catbird, Twist; homeware: MoMA Design Store, Goop, Food52; etc.)
- Keep searching until new queries stop turning up new names.
- At this point you have a CANDIDATE list. Do NOT finalize anything yet.

PASS 2: VERIFY each candidate on the retailer's own site.
This is the critical step. For every candidate retailer from Pass 1, run a SITE-SCOPED search:
  site:retailername.com "<exact brand name>"
For example: site:bloomingdales.com "Dorsey"
             site:net-a-porter.com "Gohar World"
             site:revolve.com "Dorsey"

Look at what comes back:
- If the results show actual PRODUCT PAGES for this brand on that retailer's domain → CONFIRMED. Add to us_retail_partners.
- If nothing comes back, or results are about a different brand/person/topic → REJECTED. Do not list anywhere.
- If results are ambiguous (e.g. a blog post on the retailer's site mentioning the brand, but no product page) → UNCONFIRMED. Add to unconfirmed_partners.

Do NOT skip Pass 2. Do NOT list a retailer as confirmed based on a third-party article, gift guide, social media post, or your own assumption. The ONLY thing that puts a retailer in us_retail_partners is finding the brand's products on that retailer's own domain via a site-scoped search.

CLASSIFICATION:
- us_distribution should reflect the SIGNIFICANCE of the confirmed retailers, not just the count. A brand confirmed at Saks or Nordstrom is "Broad Wholesale" even with few doors — those are major department stores with national reach. A brand at five small independent boutiques is "Limited Wholesale." Use your knowledge of the retail landscape to judge this.
- None = not sold in US. DTC Only = own website/studio only. DTC + Own Store(s) = own permanent physical store(s). Limited Wholesale = small or independent retailers only. Broad Wholesale = carried by major retailers with significant reach.
- confidence: High = all listed retailers verified via site-scoped search. Medium = most verified, some gaps. Low = little could be verified.
- Made-to-order / by-appointment from the brand's own studio = DTC, not wholesale. Pop-ups and temporary activations don't count.

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
        // Pass 1 (discovery) uses ~8-12 searches, Pass 2 (site-scoped verification) uses ~1 per candidate.
        // 25 allows verifying ~10-15 candidates after discovery. Raise if brands have many candidates.
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 25 }],
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
