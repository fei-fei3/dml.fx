import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const COST_MB = 4;

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

    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
    const isAdmin = !!profile?.is_admin;

    if (!isAdmin) {
      const { data: spendOk } = await supabase.rpc('spend_credit', {
        p_user_id: user.id, p_mb: COST_MB, p_type: 'spend_insight', p_desc: 'AI Insights call'
      });
      if (!spendOk) {
        return new Response(JSON.stringify({ error: 'INSUFFICIENT_DATA', cost_mb: COST_MB }), { status: 402, headers: corsHeaders });
      }
    }

    const body = await req.json();
    const summary = body.summary;

    // Fetch community stats silently
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: communityStats } = await adminClient.rpc('get_community_stats');

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `You are an expert FX trading coach. You have deep experience coaching many traders and have seen patterns across hundreds of trades.

Analyze this trader's journal in 4 sections with these EXACT markdown headers:

### 🎯 Strengths
### ⚠️ Weaknesses & Leaks
### 📊 Patterns Detected
### 💡 Action Items

IMPORTANT RULES:
- Use your knowledge from the background data to inform your advice, but NEVER mention "community", "other traders", "community data", percentages from other traders, or comparisons to anyone else.
- Speak as if you naturally know what works and what doesn't from experience — like a seasoned coach.
- For example, instead of saying "the community has a 70% win rate with Breakout on EUR/USD", say "Breakout tends to work particularly well on EUR/USD" or "traders who focus on Support/Resistance on this pair tend to see better results."
- Your advice should feel like expert intuition, not data citation.
- Be specific — cite actual pairs, strategies, emotions from this trader's data.
- 3-4 bullet points per section.

THIS TRADER'S DATA:
${JSON.stringify(summary, null, 2)}

BACKGROUND KNOWLEDGE (use to inform advice, NEVER reference directly):
${JSON.stringify(communityStats, null, 2)}`,
        }],
      }),
    });

    const data = await claudeRes.json();
    const responseText = data.content?.filter((i: any) => i.type === 'text').map((i: any) => i.text).join('\n') || '';

    await adminClient.from('ai_responses').insert({
      user_id: user.id,
      type: 'insight',
      input_summary: summary,
      response_text: responseText,
      mb_cost: isAdmin ? 0 : COST_MB,
    });

    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
