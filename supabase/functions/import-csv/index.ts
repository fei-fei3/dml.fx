// supabase/functions/import-csv/index.ts
// Admin-only: parses AIMS CSV, inserts lot_imports, recalculates monthly credits
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers: corsHeaders });

    // Verify admin
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: corsHeaders });

    const { rows } = await req.json();
    // rows: [{ mt5_account, client_email, client_name, close_date, lots }]

    let inserted = 0, skipped = 0;
    const affectedAccounts = new Set<string>();

    for (const row of rows) {
      try {
        const { error } = await supabase.from('lot_imports').insert({
          mt5_account: row.mt5_account,
          client_email: row.client_email,
          client_name: row.client_name,
          close_date: row.close_date,
          lots: row.lots,
          imported_by: user.id,
        });
        if (error) {
          if (error.code === '23505') skipped++; // dup
          else throw error;
        } else {
          inserted++;
          affectedAccounts.add(row.mt5_account);
        }
      } catch (e) {
        console.error('row failed:', row, e);
        skipped++;
      }
    }

    // Recalculate monthly credit for each affected MT5 account
    const recalcResults = [];
    for (const acct of affectedAccounts) {
      await supabase.rpc('recalculate_monthly_credit', { p_mt5_account: acct });
      recalcResults.push(acct);
    }

    return new Response(JSON.stringify({
      inserted, skipped, recalculated: recalcResults.length,
      message: `${inserted} new rows imported, ${skipped} skipped (duplicates), ${recalcResults.length} accounts updated`
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
