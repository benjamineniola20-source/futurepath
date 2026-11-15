import { createClient } from "@supabase/supabase-js";

// The publishable key is designed for browser use. Access is protected by database RLS.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://syiqilbfkepucmfmbksj.supabase.co";
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_0KpnWagw11NZYrhTb1GlXQ_USGabiKG";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
