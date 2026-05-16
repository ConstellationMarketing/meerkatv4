import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.VITE_SUPABASE_URL || "https://cwligyakhxevopxiksdm.supabase.co";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZG90ZHB6bWpibXN4dW5jZmRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NzM4ODMsImV4cCI6MjA3ODU0OTg4M30.aHMVupKq3oU9tqv5XUXkZXuqa33_5PR26XaOG6GcV7M";

export const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: "meerkat" } });
