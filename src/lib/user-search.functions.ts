import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Look up another user by their exact email address.
 *
 * Runs on the server with the admin client so we can find the user without
 * exposing the profiles.email column through RLS. Requires an authenticated
 * caller, and never returns email addresses.
 */
export const searchUsersByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ email: z.string().trim().min(3).max(320) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, avatar_url")
      .ilike("email", data.email.toLowerCase())
      .neq("id", context.userId)
      .limit(10);
    if (error) throw error;
    return rows ?? [];
  });