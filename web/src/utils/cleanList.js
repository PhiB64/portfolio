export function cleanList(raw, { maxItems, allowDigits = true } = {}) {
  if (!Array.isArray(raw)) return [];

  const cleaned = raw
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .filter((s) => s.length >= 2)
    .filter((s) => s.length <= 42)
    .filter((s) => !s.includes("@"));

  const withoutDigits = allowDigits
    ? cleaned
    : cleaned.filter((s) => !/\d/.test(s));
  return typeof maxItems === "number"
    ? withoutDigits.slice(0, maxItems)
    : withoutDigits;
}
