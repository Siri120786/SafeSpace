// supabase/functions/_shared/http.ts
// The web app calls Edge Functions cross-origin from the browser, so every
// function must answer the CORS preflight and include these headers.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // TODO: restrict to your deployed web origin(s) before production
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function preflight(req: Request): Response | null {
  return req.method === "OPTIONS" ? new Response("ok", { headers: corsHeaders }) : null;
}
