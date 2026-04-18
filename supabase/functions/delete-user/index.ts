// supabase/functions/delete-user/index.ts
// Admin-only: completely delete a user (auth + all related data)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'No auth' }), { status: 401, headers: corsHeaders });

    // Use service role to bypass RLS for admin operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify the caller is an admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers: corsHeaders });

    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: corsHeaders });

    const { user_id_to_delete } = await req.json();
    if (!user_id_to_delete) return new Response(JSON.stringify({ error: 'Missing user_id_to_delete' }), { status: 400, headers: corsHeaders });

    // Don't let admin delete themselves
    if (user_id_to_delete === user.id) {
      return new Response(JSON.stringify({ error: 'Cannot delete your own admin account' }), { status: 400, headers: corsHeaders });
    }

    // Use admin client (service role) to delete user
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Cascade deletes: profile, trades, monthly_credits, credit_transactions all reference user_id with on delete cascade
    // Deleting from auth.users will trigger the cascade
    const { error } = await adminClient.auth.admin.deleteUser(user_id_to_delete);
    if (error) throw error;

    return new Response(JSON.stringify({ success: true, deleted: user_id_to_delete }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), { status: 500, headers: corsHeaders });
  }
});
