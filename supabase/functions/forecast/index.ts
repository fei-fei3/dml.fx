import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const COST_MB = 20;

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
        p_user_id: user.id, p_mb: COST_MB, p_type: 'spend_forecast', p_desc: 'Live forecast call'
      });
      if (!spendOk) {
        return new Response(JSON.stringify({ error: 'INSUFFICIENT_DATA', cost_mb: COST_MB }), { status: 402, headers: corsHeaders });
      }
    }

    const { pair, userContext } = await req.json();

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Get pair-specific background data
    const { data: pairTrades } = await adminClient.from('trades').select('pnl, direction, strategy, emotion')
      .eq('pair', pair).not('pnl', 'is', null);

    let pairBackground: any = null;
    if (pairTrades && pairTrades.length > 0) {
      const wins = pairTrades.filter(t => Number(t.pnl) > 0);
      const byStrategy: any = {};
      const byDirection: any = {};
      pairTrades.forEach((t: any) => {
        if (t.strategy) {
          if (!byStrategy[t.strategy]) byStrategy[t.strategy] = { count: 0, wins: 0 };
          byStrategy[t.strategy].count++;
          if (Number(t.pnl) > 0) byStrategy[t.strategy].wins++;
        }
        if (!byDirection[t.direction]) byDirection[t.direction] = { count: 0, wins: 0 };
        byDirection[t.direction].count++;
        if (Number(t.pnl) > 0) byDirection[t.direction].wins++;
      });

      pairBackground = {
        total_trades_seen: pairTrades.length,
        overall_win_rate: ((wins.length / pairTrades.length) * 100).toFixed(1),
        direction_performance: byDirection,
        strategy_performance: Object.entries(byStrategy)
          .map(([k, v]: any) => ({ strategy: k, trades: v.count, win_rate: ((v.wins / v.count) * 100).toFixed(0) }))
          .sort((a: any, b: any) => b.trades - a.trades),
      };
    }

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1800,
        messages: [{
          role: 'user',
          content: `You are an experienced FX market analyst. You have deep knowledge from analyzing many traders' performance on various pairs. Search the web for the current price and latest news for ${pair}, then provide analysis.

Use these EXACT headers:

### 💵 Current Price
[Current price from web search]

### 📰 Recent News & Catalysts
[2-3 recent news items driving the pair]

### 📈 Technical Outlook
[Short-term bias, key levels to watch]

### 🎯 Personalized View
[Tailored advice for this trader based on their history and your experience]

IMPORTANT RULES:
- Use your background knowledge to inform which strategies and directions tend to work well on this pair, but NEVER say "other traders", "community", "data shows", or cite statistics from the background data.
- Speak naturally as an experienced analyst — e.g. "Breakout strategies tend to perform well on ${pair}" rather than "traders have a 70% win rate with Breakout."
- Your advice should feel like expert intuition, not data reporting.
- Add disclaimer: educational only, not financial advice.

THIS TRADER'S PROFILE:
${JSON.stringify(userContext, null, 2)}

BACKGROUND KNOWLEDGE ON ${pair} (use to inform advice, NEVER reference directly):
${pairBackground ? JSON.stringify(pairBackground, null, 2) : 'Limited background data on this pair — rely on market analysis.'}`,
        }],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      }),
    });

    const data = await claudeRes.json();
    const responseText = data.content?.filter((i: any) => i.type === 'text').map((i: any) => i.text).join('\n') || '';

    await adminClient.from('ai_responses').insert({
      user_id: user.id,
      type: 'forecast',
      pair: pair,
      input_summary: userContext,
      response_text: responseText,
      mb_cost: isAdmin ? 0 : COST_MB,
    });

    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
