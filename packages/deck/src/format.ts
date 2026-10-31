// A guess card's `fmt` is a template, not a function: `{v}` is the number as written,
// `{v:N}` the number with N decimals (0–20). The template is only ever read as text.
const PLACEHOLDER = /\{v(?::(\d{1,2}))?\}/g;

export function formatValue(template: string | undefined, v: number): string {
  if (template == null) return String(v);
  return template.replace(PLACEHOLDER, (whole, digits?: string) => {
    if (digits == null) return String(v);
    const n = Number(digits);
    return n <= 20 ? v.toFixed(n) : whole;
  });
}
