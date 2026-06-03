"use client";
import { useState, useRef } from "react";

export default function Home() {
  const [brandName, setBrandName] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [copied, setCopied] = useState(null);
  const inputRef = useRef(null);

  const handleLookup = async () => {
    if (!brandName.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: brandName.trim(),
          website: website.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Request failed");
      }

      const entry = { ...data, website: website.trim(), timestamp: new Date() };
      setResult(entry);
      setHistory((prev) => [entry, ...prev]);
      setBrandName("");
      setWebsite("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) handleLookup();
  };

  const copyRow = (entry) => {
    const row = [
      entry.year_founded || "",
      entry.us_distribution || "",
      entry.us_retail_partners || "",
      entry.intl_distribution || "",
    ].join("\t");
    navigator.clipboard.writeText(row);
    setCopied(entry.brand);
    setTimeout(() => setCopied(null), 2000);
  };

  const copyAllRows = () => {
    const header = "Brand\tYear Founded\tUS Distribution\tUS Retail Partners\tIntl Distribution\tConfidence";
    const rows = history.map((e) =>
      [e.brand, e.year_founded || "", e.us_distribution || "", e.us_retail_partners || "", e.intl_distribution || "", e.confidence || ""].join("\t")
    );
    navigator.clipboard.writeText([header, ...rows].join("\n"));
    setCopied("__all__");
    setTimeout(() => setCopied(null), 2000);
  };

  const distColor = (dist) => {
    const c = {
      None: { bg: "#F8D7DA", fg: "#721C24" },
      "DTC Only": { bg: "#FFF3CD", fg: "#856404" },
      "DTC + Own Store(s)": { bg: "#FFE0CC", fg: "#8A4500" },
      "Limited Wholesale": { bg: "#D1ECF1", fg: "#0C5460" },
      "Broad Wholesale": { bg: "#D4EDDA", fg: "#155724" },
    };
    return c[dist] || { bg: "#E9E5E0", fg: "#5A5550" };
  };

  const confColor = (c) => {
    if (c === "High") return { bg: "#D4EDDA", fg: "#155724" };
    if (c === "Medium") return { bg: "#FFF3CD", fg: "#856404" };
    return { bg: "#F8D7DA", fg: "#721C24" };
  };

  const s = {
    page: { minHeight: "100vh", background: "#F7F3ED", fontFamily: "'Jost', 'Helvetica Neue', sans-serif" },
    header: { background: "#0F1A2E", padding: "28px 32px 20px" },
    h1: { fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 600, color: "#fff", margin: 0, letterSpacing: 1 },
    subtitle: { fontSize: 13, color: "#E8A882", margin: "6px 0 0", letterSpacing: 0.5 },
    inputArea: { padding: "24px 32px", background: "#fff", borderBottom: "3px solid #C4714A" },
    inputRow: { display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" },
    label: { display: "block", fontSize: 11, fontWeight: 500, color: "#6B6560", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 },
    input: { width: "100%", padding: "10px 14px", border: "1.5px solid #D6D0C8", borderRadius: 4, fontSize: 15, fontFamily: "'Jost'", outline: "none", boxSizing: "border-box" },
    fieldLabel: { fontSize: 10, fontWeight: 500, color: "#B8B2A8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.h1}>Brand Distribution Agent</h1>
        <p style={s.subtitle}>Incubation Pipeline · Bloomingdale&apos;s · Summer 2026</p>
      </div>

      <div style={s.inputArea}>
        <div style={s.inputRow}>
          <div style={{ flex: "1 1 240px" }}>
            <label style={s.label}>Brand Name *</label>
            <input
              ref={inputRef}
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Dauphinette"
              style={s.input}
            />
          </div>
          <div style={{ flex: "1 1 240px" }}>
            <label style={s.label}>Website (optional)</label>
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. dauphinette.com"
              style={s.input}
            />
          </div>
          <button
            onClick={handleLookup}
            disabled={loading || !brandName.trim()}
            style={{
              padding: "10px 28px", background: loading ? "#B8B2A8" : "#0F1A2E", color: "#fff",
              border: "none", borderRadius: 4, fontSize: 14, fontFamily: "'Jost'", fontWeight: 500,
              cursor: loading ? "wait" : "pointer", opacity: !brandName.trim() ? 0.4 : 1,
              transition: "all 0.2s", whiteSpace: "nowrap",
            }}
          >
            {loading ? "Researching…" : "Look Up"}
          </button>
        </div>
        {loading && (
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 16, height: 16, border: "2.5px solid #D6D0C8", borderTopColor: "#C4714A",
                borderRadius: "50%", animation: "spin 0.8s linear infinite",
              }}
            />
            <span style={{ fontSize: 13, color: "#6B6560" }}>Searching the web for {brandName}…</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
      </div>

      {error && (
        <div style={{ margin: "16px 32px", padding: "12px 16px", background: "#F8D7DA", borderRadius: 4, color: "#721C24", fontSize: 14 }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ margin: "24px 32px" }}>
          <div style={{ background: "#fff", borderRadius: 6, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ padding: "16px 20px", background: "#0F1A2E", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <span style={{ fontFamily: "'Cormorant Garamond'", fontSize: 20, fontWeight: 600, color: "#fff" }}>{result.brand}</span>
                {result.website && <span style={{ fontSize: 13, color: "#E8A882", marginLeft: 12 }}>{result.website}</span>}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {result.confidence && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 3, textTransform: "uppercase", letterSpacing: 0.8,
                    background: confColor(result.confidence).bg, color: confColor(result.confidence).fg,
                  }}>
                    {result.confidence} confidence
                  </span>
                )}
                <button
                  onClick={() => copyRow(result)}
                  style={{
                    padding: "6px 14px", background: copied === result.brand ? "#D4EDDA" : "#C4714A",
                    color: copied === result.brand ? "#155724" : "#fff", border: "none", borderRadius: 4,
                    fontSize: 12, fontFamily: "'Jost'", fontWeight: 500, cursor: "pointer",
                  }}
                >
                  {copied === result.brand ? "Copied!" : "Copy for Excel"}
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 0 }}>
              {[
                { label: "Year Founded", value: result.year_founded || "Unknown" },
                { label: "US Distribution", value: result.us_distribution || "Unknown", tag: true },
                { label: "US Retail Partners", value: result.us_retail_partners || "None found" },
                { label: "Intl Distribution", value: result.intl_distribution || "None found" },
              ].map((field, i) => (
                <div key={i} style={{ padding: "16px 20px", borderRight: "1px solid #F0EDE8", borderBottom: "1px solid #F0EDE8" }}>
                  <div style={s.fieldLabel}>{field.label}</div>
                  {field.tag ? (
                    <span style={{
                      display: "inline-block", fontSize: 13, fontWeight: 500, padding: "3px 10px", borderRadius: 3,
                      background: distColor(field.value).bg, color: distColor(field.value).fg,
                    }}>
                      {field.value}
                    </span>
                  ) : (
                    <div style={{ fontSize: 14, color: "#1A1A1A", lineHeight: 1.5 }}>{String(field.value)}</div>
                  )}
                </div>
              ))}
            </div>

            {result.sources && (
              <div style={{ padding: "10px 20px", background: "#F7F3ED", fontSize: 12, color: "#6B6560" }}>
                <strong>Sources:</strong> {result.sources}
              </div>
            )}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div style={{ margin: "16px 32px 32px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontFamily: "'Cormorant Garamond'", fontSize: 18, fontWeight: 600, color: "#1B2A4A", margin: 0, borderBottom: "2px solid #C4714A", paddingBottom: 8, display: "inline-block" }}>
              All Lookups ({history.length})
            </h3>
            {history.length > 1 && (
              <button
                onClick={copyAllRows}
                style={{
                  padding: "6px 16px", background: copied === "__all__" ? "#D4EDDA" : "#0F1A2E",
                  color: copied === "__all__" ? "#155724" : "#fff", border: "none", borderRadius: 4,
                  fontSize: 12, fontFamily: "'Jost'", fontWeight: 500, cursor: "pointer",
                }}
              >
                {copied === "__all__" ? "All Copied!" : "Copy All for Excel"}
              </button>
            )}
          </div>
          <div style={{ background: "#fff", borderRadius: 6, overflow: "auto", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 700 }}>
              <thead>
                <tr style={{ background: "#2C3E5A", color: "#fff" }}>
                  {["Brand", "Year", "US Distribution", "US Retail Partners", "Intl Distribution", "Conf.", ""].map((h, i) => (
                    <th key={i} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((entry, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "#FDFCFA" : "#F7F3ED", borderBottom: "1px solid #F0EDE8" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 500, color: "#1B2A4A", whiteSpace: "nowrap" }}>{entry.brand}</td>
                    <td style={{ padding: "10px 14px" }}>{entry.year_founded || "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 3, whiteSpace: "nowrap", background: distColor(entry.us_distribution).bg, color: distColor(entry.us_distribution).fg }}>
                        {entry.us_distribution}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", maxWidth: 200 }}>{entry.us_retail_partners || "—"}</td>
                    <td style={{ padding: "10px 14px", maxWidth: 200 }}>{entry.intl_distribution || "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 3, background: confColor(entry.confidence).bg, color: confColor(entry.confidence).fg }}>
                        {entry.confidence}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <button
                        onClick={() => copyRow(entry)}
                        style={{ padding: "4px 10px", background: copied === entry.brand ? "#D4EDDA" : "#E9E5E0", color: copied === entry.brand ? "#155724" : "#5A5550", border: "none", borderRadius: 3, fontSize: 11, cursor: "pointer", fontFamily: "'Jost'", whiteSpace: "nowrap" }}
                      >
                        {copied === entry.brand ? "Copied!" : "Copy"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {history.length === 0 && !loading && !error && (
        <div style={{ textAlign: "center", padding: "60px 32px", color: "#B8B2A8" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
          <p style={{ fontSize: 15, margin: 0 }}>Enter a brand name to research its distribution profile</p>
          <p style={{ fontSize: 13, marginTop: 6, color: "#D6D0C8" }}>
            Results map directly to your tracker: Year Founded, US Distribution, US Retail Partners, Intl Distribution
          </p>
          <p style={{ fontSize: 12, marginTop: 16, color: "#D6D0C8" }}>
            &quot;Copy for Excel&quot; copies as tab-separated values — paste into the Year Founded cell and it fills all four columns
          </p>
        </div>
      )}
    </div>
  );
}
