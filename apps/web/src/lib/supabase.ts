// apps/web/src/lib/supabase.ts
// Single web initialization point linking Vite environment config into the shared API client.

import { initSafeSpaceClient } from "@safespace/api-client";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (supabaseUrl && supabaseAnonKey) {
  initSafeSpaceClient({
    supabaseUrl,
    supabaseAnonKey,
  });
} else {
  console.warn(
    "[SafeSpace Configuration Notice] Missing Supabase environment credentials.\n" +
    "VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is undefined.\n" +
    "Please create 'apps/web/.env.local' with your valid Supabase URL and Anon Key."
  );
}
