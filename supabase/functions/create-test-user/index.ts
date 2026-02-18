import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const email = "testmember@sandyrotary.test";
    const password = "TestPassword123";

    // Check if already exists
    const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const existing = list?.users?.find((u) => u.email === email);
    if (existing) {
      // Update password to ensure it's correct
      await supabase.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
      });
      return new Response(JSON.stringify({ success: true, user_id: existing.id, updated: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use signUp which goes through normal auth flow and fires triggers properly
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: signUpData, error: signUpError } = await anonClient.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      return new Response(JSON.stringify({ error: signUpError.message, step: "signup" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = signUpData.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "No user ID returned from signUp" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Confirm email via admin
    const { error: confirmError } = await supabase.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });

    if (confirmError) {
      return new Response(JSON.stringify({ error: confirmError.message, step: "confirm", user_id: userId }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
