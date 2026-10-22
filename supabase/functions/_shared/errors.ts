// supabase/functions/_shared/errors.ts
// Content-free error summaries for Edge Function logs: an error code or name
// only, never message text, row data, tokens or raw error objects.

export function errorSummary(e: unknown): string {
  if (e && typeof e === "object") {
    const o = e as { code?: unknown; name?: unknown };
    if (typeof o.code === "string" && o.code) return o.code;
    if (typeof o.name === "string" && o.name) return o.name;
  }
  return "unknown_error";
}
