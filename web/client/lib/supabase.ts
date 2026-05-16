import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://cwligyakhxevopxiksdm.supabase.co";
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_i4wnDsU7lbz8rYTuArLc6w_Y9RlCmWG";

const isDevelopment =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname.includes("fly.dev") ||
    window.location.hostname.includes("localhost:"));

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: !isDevelopment,
    persistSession: !isDevelopment,
    detectSessionInUrl: true,
  },
  db: {
    schema: "meerkat",
  },
  global: {
    headers: {
      "X-Client-Info": "supabase-js",
    },
  },
});
