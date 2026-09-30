// packages/api-client/src/supabaseClient.ts
// Single client factory imported by apps/web and apps/mobile.

import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface SafeSpaceClientConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

let client: SupabaseClient | null = null;

export function initSafeSpaceClient(config: SafeSpaceClientConfig): SupabaseClient {
  if (!config || !config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error(
      "SafeSpace Supabase Client Initialization Error: Missing environment credentials.\n" +
      "Both 'supabaseUrl' (VITE_SUPABASE_URL) and 'supabaseAnonKey' (VITE_SUPABASE_ANON_KEY) must be defined.\n" +
      "Please configure valid Supabase credentials in apps/web/.env.local."
    );
  }
  client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return client;
}

export function getSafeSpaceClient(): SupabaseClient {
  if (!client) {
    throw new Error(
      "SafeSpace Supabase Client Error: Client is uninitialized.\n" +
      "Missing required environment configuration (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).\n" +
      "Please configure your credentials in apps/web/.env.local."
    );
  }
  return client;
}
