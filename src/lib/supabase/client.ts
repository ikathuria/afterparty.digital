import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client (anon key). Subject to RLS — used for organizer
 * UI in the browser after they have authenticated.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
