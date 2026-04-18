'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, Plus, Trash2, X, Image as ImageIcon, Tag, Brain, Calendar, DollarSign, BarChart3, Activity, Sparkles, Zap, LineChart as LineIcon, Flame, LogOut, Cloud, Wifi, WifiOff, Lock, Shield, Target, User } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { supabase, formatData, type Trade, type Profile, type MonthlyCredit } from '@/lib/supabase';
import AccountSettings from './AccountSettings';

const C = {
  bg: '#000000', primary: '#E5FF00', win: '#39FF14', loss: '#FF003C',
  accent: '#00E5FF', muted: '#888888', panel: '#0a0a00', panelLight: '#1a1a00',
};

const PAIRS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'XAU/USD', 'Other'];
const STRATEGIES = ['Breakout', 'Trend Follow', 'Mean Reversion', 'Support/Resistance', 'News Trade', 'Scalp', 'Swing', 'Order Block', 'Liquidity Grab', 'Fibonacci'];
const EMOTIONS = [
  { label: 'Calm', emoji: '😌', color: '#39FF14' }, { label: 'Confident', emoji: '💪', color: '#39FF14' },
  { label: 'Patient', emoji: '🧘', color: '#00E5FF' }, { label: 'FOMO', emoji: '😰', color: '#FFA500' },
  { label: 'Greedy', emoji: '🤑', color: '#FF003C' }, { label: 'Fearful', emoji: '😨', color: '#A020F0' },
  { label: 'Revenge', emoji: '😤', color: '#FF003C' }, { label: 'Tilted', emoji: '🤯', color: '#FF003C' },
];
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const PAIR_COLORS = ['#E5FF00', '#39FF14', '#00E5FF', '#FF003C', '#FFA500', '#A020F0', '#FF69B4', '#FFFFFF'];

const AI_COST_MB = 4;
const FORECAST_COST_MB = 20;

function getPipInfo(pair: string, exitPrice: number, lotSize: number) {
  const isJPY = pair.includes('JPY'), isXAU = pair.includes('XAU');
  let pipSize: number, pipValue: number;
  if (isXAU) { pipSize = 0.10; pipValue = lotSize * 10; }
  else if (isJPY) { pipSize = 0.01; pipValue = exitPrice ? (0.01 / exitPrice) * lotSize * 100000 : lotSize * 9.3; }
  else { pipSize = 0.0001; pipValue = pair.endsWith('/USD') ? lotSize * 10 : (exitPrice ? (0.0001 / exitPrice) * lotSize * 100000 : lotSize * 10); }
  return { pipSize, pipValue };
}

function calcPnL(form: any) {
  const entry = parseFloat(form.entry), exit = parseFloat(form.exit), size = parseFloat(form.size);
  if (!entry || !exit || !size) return { pips: null, pnl: null };
  const { pipSize, pipValue } = getPipInfo(form.pair, exit, size);
  const rawDiff = form.direction === 'Long' ? exit - entry : entry - exit;
  const pips = rawDiff / pipSize;
  return { pips: Number(pips.toFixed(1)), pnl: Number((pips * pipValue).toFixed(2)) };
}

export default function FXJournal({ user, profile, onSignOut, onAdmin }: { user: any; profile: Profile | null; onSignOut: () => void; onAdmin?: () => void }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [credit, setCredit] = useState<MonthlyCredit | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [tab, setTab] = useState('dashboard');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    fetchAll();
    const channel = supabase.channel('changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: `user_id=eq.${user.id}` }, () => fetchTrades())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_credits', filter: `user_id=eq.${user.id}` }, () => fetchCredit())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user.id]);

  const fetchAll = async () => { await Promise.all([fetchTrades(), fetchCredit()]); setLoading(false); };
  const fetchTrades = async () => {
    const { data } = await supabase.from('trades').select('*').order('date', { ascending: false }).order('created_at', { ascending: false });
    if (data) setTrades(data);
  };
  const fetchCredit = async () => {
    await supabase.rpc('get_or_create_monthly_credit', { p_user_id: user.id });
    const ym = new Date().toISOString().slice(0, 7);
    const { data } = await supabase.from('monthly_credits').select('*').eq('user_id', user.id).eq('year_month', ym).single();
    if (data) setCredit(data);
  };

  const addTrade = async (trade: Trade) => {
    setSyncing(true);
    const { error } = await supabase.from('trades').insert({ ...trade, user_id: user.id });
    if (error) alert('SAVE FAILED: ' + error.message);
    setShowForm(false); setSyncing(false); fetchTrades();
  };
  const deleteTrade = async (id: string) => {
    setSyncing(true);
    await supabase.from('trades').delete().eq('id', id);
    setSelectedTrade(null); setSyncing(false); fetchTrades();
  };

  const stats = useMemo(() => computeStats(trades), [trades]);
  const isAdmin = !!profile?.is_admin;
  const remaining = isAdmin ? Infinity : (credit ? credit.mb_total - credit.mb_used : 0);
  const eligible = isAdmin || (profile?.deposit_verified && (credit?.lots_this_month || 0) >= 1);

  // Force-logout if account is deactivated
  useEffect(() => {
    if (profile?.deactivated) {
      alert('YOUR ACCOUNT HAS BEEN DEACTIVATED. CONTACT ADMIN.');
      onSignOut();
    }
  }, [profile?.deactivated]);

  if (loading) return <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.primary, fontFamily: "'Press Start 2P', monospace", fontSize: '14px' }}>LOADING...</div>;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.primary, fontFamily: "'VT323', monospace", paddingBottom: '60px' }}>
      <style>{styles}</style>
      <div className="scanlines" />

      <header className="pixel-bg-grid" style={{ borderBottom: `3px solid ${C.primary}`, padding: '16px 24px', position: 'sticky', top: 0, background: C.bg, zIndex: 10 }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <img src="/logo.jpeg" alt="bull" style={{ width: '52px', height: '52px', imageRendering: 'pixelated', border: `2px solid ${C.primary}` }} />
            <div>
              <h1 className="pixel-font" style={{ margin: 0, fontSize: '18px', color: C.primary, textShadow: `3px 3px 0 #555` }}>DML FX</h1>
              <div className="pixel-font" style={{ fontSize: '7px', color: C.muted, letterSpacing: '2px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ◆ TRADING JOURNAL <Cloud size={9} className={syncing ? 'blink' : ''} style={{ color: syncing ? '#FFA500' : C.win }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <DataIndicator credit={credit} eligible={!!eligible} isAdmin={isAdmin} />
            <button className="pixel-btn" onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={14} /> NEW</button>
            <button className="pixel-btn pixel-btn-secondary" onClick={() => setShowSettings(true)} style={{ padding: '12px' }} title="Account"><User size={14} /></button>
            {onAdmin && <button className="pixel-btn pixel-btn-secondary" onClick={onAdmin} style={{ padding: '12px' }} title="Admin"><Shield size={14} /></button>}
            <button className="pixel-btn pixel-btn-secondary" onClick={onSignOut} style={{ padding: '12px' }} title="Sign out"><LogOut size={14} /></button>
          </div>
        </div>
        <div style={{ maxWidth: '1280px', margin: '14px auto 0', display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {[['dashboard', 'STATS', BarChart3], ['analytics', 'ANALYZE', Activity], ['insights', 'AI INSIGHT', Sparkles], ['forecast', 'FORECAST', Zap], ['trades', 'LOG', LineIcon]].map(([k, label, Icon]: any) => (
            <button key={k} className={`tab-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
              <Icon size={11} /> {label}
              {(k === 'insights' || k === 'forecast') && !eligible && <Lock size={9} style={{ marginLeft: '4px' }} />}
            </button>
          ))}
        </div>
      </header>

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px', position: 'relative', zIndex: 2 }}>
        {tab === 'dashboard' && <Dashboard stats={stats} trades={trades} onSelect={setSelectedTrade} />}
        {tab === 'analytics' && <Analytics stats={stats} />}
        {tab === 'insights' && <AIInsights trades={trades} stats={stats} eligible={!!eligible} remaining={remaining} credit={credit} profile={profile} onCreditUpdate={fetchCredit} />}
        {tab === 'forecast' && <Forecast stats={stats} eligible={!!eligible} remaining={remaining} credit={credit} profile={profile} onCreditUpdate={fetchCredit} />}
        {tab === 'trades' && <TradesList trades={trades} onSelect={setSelectedTrade} />}
      </main>

      {showForm && <TradeForm onSave={addTrade} onClose={() => setShowForm(false)} />}
      {selectedTrade && <TradeDetail trade={selectedTrade} onClose={() => setSelectedTrade(null)} onDelete={deleteTrade} />}
      {showSettings && <AccountSettings user={user} profile={profile} credit={credit} onClose={() => setShowSettings(false)} onSignOut={onSignOut} />}

      <footer style={{ borderTop: `2px dashed ${C.muted}`, padding: '20px 24px', marginTop: '40px', textAlign: 'center', fontFamily: "'VT323', monospace", color: C.muted, fontSize: '14px', lineHeight: 1.6, position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '8px', color: C.primary, letterSpacing: '2px', marginBottom: '8px' }}>◆ DML FX ◆</div>
          <div>© 2025–2026 DML FX · ALL RIGHTS RESERVED</div>
          <div style={{ marginTop: '4px' }}>PROPERTY OF DML FX · UNAUTHORIZED USE PROHIBITED</div>
          <div style={{ marginTop: '10px', fontSize: '11px', color: '#444', letterSpacing: '1px' }}>VERSION 2.05 · BUILD #15 · EST 2025 · UPDATED 2026</div>
        </div>
      </footer>
    </div>
  );
}

function DataIndicator({ credit, eligible, isAdmin }: { credit: MonthlyCredit | null; eligible: boolean; isAdmin?: boolean }) {
  if (isAdmin) {
    return (
      <div title="Admin · Unlimited" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', border: `2px solid ${C.primary}`, background: C.bg }}>
        <Wifi size={14} color={C.primary} />
        <div>
          <div className="pixel-font" style={{ fontSize: '7px', color: C.muted, letterSpacing: '1px' }}>DATA</div>
          <div className="mono" style={{ fontSize: '13px', fontWeight: 700, color: C.primary }}>∞ UNLIMITED</div>
        </div>
      </div>
    );
  }
  if (!credit) return null;
  const remaining = credit.mb_total - credit.mb_used;
  const pct = credit.mb_total ? (remaining / credit.mb_total) * 100 : 0;
  const color = !eligible ? C.muted : remaining > 100 ? C.win : remaining > 20 ? '#FFA500' : C.loss;
  return (
    <div title={eligible ? `${formatData(remaining)} remaining this month` : 'Locked - need deposit + 1 lot'} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', border: `2px solid ${color}`, background: C.bg }}>
      {eligible ? <Wifi size={14} color={color} /> : <WifiOff size={14} color={color} />}
      <div>
        <div className="pixel-font" style={{ fontSize: '7px', color: C.muted, letterSpacing: '1px' }}>DATA</div>
        <div className="mono" style={{ fontSize: '13px', fontWeight: 700, color }}>{eligible ? formatData(remaining) : 'LOCKED'}</div>
      </div>
      {eligible && (
        <div style={{ width: '40px', height: '6px', background: '#222', position: 'relative' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color }} />
        </div>
      )}
    </div>
  );
}

function LockedBanner({ credit, profile }: { credit: MonthlyCredit | null; profile: Profile | null }) {
  const depositOk = profile?.deposit_verified;
  const lotsOk = (credit?.lots_this_month || 0) >= 1;
  return (
    <div className="pixel-card" style={{ padding: '32px', textAlign: 'center', borderColor: '#FFA500', boxShadow: '6px 6px 0 #553300' }}>
      <Lock size={48} style={{ color: '#FFA500', marginBottom: '16px' }} />
      <h2 className="pixel-font" style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#FFA500' }}>► AI FEATURES LOCKED</h2>
      <div className="vt" style={{ fontSize: '17px', color: '#ddd', marginBottom: '24px', maxWidth: '500px', margin: '0 auto 24px' }}>
        {'>'} UNLOCK BY MEETING ALL REQUIREMENTS BELOW
      </div>
      <div style={{ display: 'grid', gap: '10px', maxWidth: '500px', margin: '0 auto', textAlign: 'left' }}>
        <Requirement done={!!profile?.mt5_account} label="LINK MT5 ACCOUNT" detail={profile?.mt5_account || 'Not linked'} />
        <Requirement done={!!depositOk} label="DEPOSIT $1,000 USD" detail={depositOk ? 'Verified ✓' : 'Pending admin verification'} />
        <Requirement done={lotsOk} label="TRADE 1+ LOT THIS MONTH" detail={`${(credit?.lots_this_month || 0).toFixed(2)} / 1.00 lots`} />
      </div>
      <div className="vt" style={{ marginTop: '24px', fontSize: '15px', color: C.muted }}>
        {'>'} EARN 1 GB DATA PER LOT TRADED · MAX 5 GB / MONTH · RESETS MONTHLY
      </div>
    </div>
  );
}

function Requirement({ done, label, detail }: { done: boolean; label: string; detail: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', border: `2px solid ${done ? C.win : C.muted}`, background: C.bg }}>
      <div style={{ width: '24px', height: '24px', background: done ? C.win : '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 700 }}>{done ? '✓' : '○'}</div>
      <div style={{ flex: 1 }}>
        <div className="pixel-font" style={{ fontSize: '9px', color: done ? C.win : C.primary, letterSpacing: '1px' }}>{label}</div>
        <div className="vt" style={{ fontSize: '14px', color: C.muted, marginTop: '2px' }}>{detail}</div>
      </div>
    </div>
  );
}

function computeStats(trades: Trade[]): any {
  if (trades.length === 0) return null;
  const closed = trades.filter((t) => t.pnl !== null && t.pnl !== undefined && t.pnl !== '');
  if (closed.length === 0) return { empty: true, total: trades.length };
  const wins = closed.filter((t) => Number(t.pnl) > 0), losses = closed.filter((t) => Number(t.pnl) < 0);
  const totalPnl = closed.reduce((s, t) => s + Number(t.pnl), 0);
  const winRate = (wins.length / closed.length) * 100;
  const avgWin = wins.length ? wins.reduce((s, t) => s + Number(t.pnl), 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + Number(t.pnl), 0) / losses.length) : 0;
  const profitFactor = avgLoss && losses.length ? (avgWin * wins.length) / (avgLoss * losses.length) : 0;
  const rrTrades = closed.filter((t) => t.rr);
  const avgRR = rrTrades.length ? rrTrades.reduce((s, t) => s + Number(t.rr), 0) / rrTrades.length : 0;
  let cum = 0;
  const equity = [...closed].reverse().map((t, i) => { cum += Number(t.pnl); return { idx: i + 1, equity: cum, date: t.date }; });
  const groupBy = (key: string) => {
    const map: any = {};
    closed.forEach((t: any) => { const k = t[key] || 'Unknown'; if (!map[k]) map[k] = { name: k, count: 0, wins: 0, pnl: 0 }; map[k].count++; map[k].pnl += Number(t.pnl); if (Number(t.pnl) > 0) map[k].wins++; });
    return Object.values(map).map((g: any) => ({ ...g, winRate: (g.wins / g.count) * 100 })).sort((a: any, b: any) => b.count - a.count);
  };
  const byPair = groupBy('pair'), byStrategy = groupBy('strategy'), byEmotion = groupBy('emotion');
  const dowMap: any = {};
  closed.forEach((t) => { if (!t.date) return; const d = new Date(t.date).getDay(); if (!dowMap[d]) dowMap[d] = { day: DAYS[d], count: 0, pnl: 0, wins: 0 }; dowMap[d].count++; dowMap[d].pnl += Number(t.pnl); if (Number(t.pnl) > 0) dowMap[d].wins++; });
  const byDay = DAYS.map((_, i) => dowMap[i] || { day: DAYS[i], count: 0, pnl: 0, wins: 0 }).map((g: any) => ({ ...g, winRate: g.count ? (g.wins / g.count) * 100 : 0 }));
  let curStreak = 0, maxWinStreak = 0, maxLossStreak = 0;
  let streakType: boolean | null = null;
  [...closed].reverse().forEach((t) => {
    const w = Number(t.pnl) > 0;
    if (streakType === null) { streakType = w; curStreak = 1; }
    else if (streakType === w) curStreak++;
    else { streakType = w; curStreak = 1; }
    if (w) maxWinStreak = Math.max(maxWinStreak, curStreak); else maxLossStreak = Math.max(maxLossStreak, curStreak);
  });
  return { totalPnl, winRate, wins: wins.length, losses: losses.length, avgWin, avgLoss, profitFactor, avgRR, equity, byPair, byStrategy, byEmotion, byDay, total: closed.length, maxWinStreak, maxLossStreak };
}

function Dashboard({ stats, trades, onSelect }: any) {
  if (!stats || stats.empty) return (
    <div className="pixel-card" style={{ padding: '60px', textAlign: 'center' }}>
      <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎮</div>
      <h2 className="pixel-font" style={{ margin: '0 0 8px 0', fontSize: '14px', color: C.primary }}>NO TRADES YET</h2>
      <p className="vt" style={{ color: C.muted, margin: 0, fontSize: '18px' }}>{'>'} INSERT FIRST TRADE TO BEGIN</p>
    </div>
  );
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <StatCard icon={<DollarSign size={14} />} label="NET P&L" value={`${stats.totalPnl >= 0 ? '+' : ''}$${stats.totalPnl.toFixed(2)}`} color={stats.totalPnl >= 0 ? C.win : C.loss} big />
        <StatCard icon={<Target size={14} />} label="WIN RATE" value={`${stats.winRate.toFixed(1)}%`} sub={`${stats.wins}W / ${stats.losses}L`} color={C.primary} />
        <StatCard icon={<Activity size={14} />} label="P. FACTOR" value={stats.profitFactor.toFixed(2)} color={C.accent} />
        <StatCard icon={<BarChart3 size={14} />} label="AVG R:R" value={stats.avgRR ? stats.avgRR.toFixed(2) : '—'} color="#A020F0" />
        <StatCard icon={<TrendingUp size={14} />} label="TRADES" value={stats.total} color={C.win} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div className="pixel-card" style={{ padding: '20px' }}>
          <h3 className="pixel-font" style={{ margin: '0 0 16px 0', fontSize: '11px', color: C.primary }}>► EQUITY CURVE</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={stats.equity}>
              <CartesianGrid stroke={C.muted} strokeDasharray="2 4" opacity={0.3} />
              <XAxis dataKey="idx" stroke={C.muted} fontSize={11} fontFamily="'VT323', monospace" />
              <YAxis stroke={C.muted} fontSize={11} fontFamily="'VT323', monospace" />
              <Tooltip contentStyle={{ background: C.bg, border: `2px solid ${C.primary}`, borderRadius: 0, fontFamily: "'VT323', monospace", color: C.primary }} />
              <Line type="stepAfter" dataKey="equity" stroke={C.primary} strokeWidth={3} dot={{ fill: C.primary, r: 4, stroke: '#000' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="pixel-card" style={{ padding: '20px' }}>
          <h3 className="pixel-font" style={{ margin: '0 0 16px 0', fontSize: '11px', color: C.primary }}>► PAIRS</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={stats.byPair} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: any) => e.name} stroke={C.bg} strokeWidth={2}>
                {stats.byPair.map((_: any, i: number) => <Cell key={i} fill={PAIR_COLORS[i % PAIR_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: C.bg, border: `2px solid ${C.primary}`, borderRadius: 0, fontFamily: "'VT323', monospace", color: C.primary }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="pixel-card" style={{ padding: '20px' }}>
        <h3 className="pixel-font" style={{ margin: '0 0 16px 0', fontSize: '11px', color: C.primary }}>► RECENT TRADES</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {trades.slice(0, 5).map((t: Trade) => <TradeRow key={t.id} trade={t} onClick={() => onSelect(t)} />)}
        </div>
      </div>
    </>
  );
}

function Analytics({ stats }: any) {
  if (!stats || stats.empty) return <EmptyState msg="LOG TRADES TO UNLOCK STATS" />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="pixel-card" style={{ padding: '20px' }}><h3 className="pixel-font" style={{ margin: '0 0 16px', fontSize: '11px', color: C.primary }}>► WIN RATE BY PAIR</h3><BreakdownTable data={stats.byPair} /></div>
      <div className="pixel-card" style={{ padding: '20px' }}><h3 className="pixel-font" style={{ margin: '0 0 16px', fontSize: '11px', color: C.primary }}>► WIN RATE BY STRATEGY</h3><BreakdownTable data={stats.byStrategy} /></div>
      <div className="pixel-card" style={{ padding: '20px' }}><h3 className="pixel-font" style={{ margin: '0 0 16px', fontSize: '11px', color: C.primary }}>► PERFORMANCE BY EMOTION</h3><BreakdownTable data={stats.byEmotion} emotion /></div>
      <div className="pixel-card" style={{ padding: '20px' }}>
        <h3 className="pixel-font" style={{ margin: '0 0 16px', fontSize: '11px', color: C.primary }}>► DAY HEATMAP</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
          {stats.byDay.map((d: any) => {
            const intensity = Math.min(Math.abs(d.pnl) / 100, 1);
            const bg = d.pnl > 0 ? `rgba(57, 255, 20, ${0.15 + intensity * 0.5})` : d.pnl < 0 ? `rgba(255, 0, 60, ${0.15 + intensity * 0.5})` : C.bg;
            return (
              <div key={d.day} style={{ padding: '14px 6px', background: bg, border: `2px solid ${d.pnl > 0 ? C.win : d.pnl < 0 ? C.loss : C.muted}`, textAlign: 'center' }}>
                <div className="pixel-font" style={{ fontSize: '8px', color: C.primary }}>{d.day}</div>
                <div className="mono" style={{ fontSize: '14px', fontWeight: 700, marginTop: '6px', color: d.pnl > 0 ? C.win : d.pnl < 0 ? C.loss : C.muted }}>{d.count ? `${d.pnl >= 0 ? '+' : ''}$${d.pnl.toFixed(0)}` : '—'}</div>
                <div className="vt" style={{ fontSize: '13px', color: C.muted, marginTop: '2px' }}>{d.count}x</div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <StatCard icon={<Flame size={14} />} label="MAX WIN STREAK" value={stats.maxWinStreak} color={C.win} />
        <StatCard icon={<TrendingDown size={14} />} label="MAX LOSS STREAK" value={stats.maxLossStreak} color={C.loss} />
      </div>
    </div>
  );
}

function BreakdownTable({ data, emotion }: any) {
  if (!data || data.length === 0) return <div className="vt" style={{ color: C.muted, textAlign: 'center', padding: '12px', fontSize: '16px' }}>NO DATA</div>;
  const maxCount = Math.max(...data.map((d: any) => d.count));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {data.map((d: any) => {
        const em = emotion ? EMOTIONS.find((e) => e.label === d.name) : null;
        return (
          <div key={d.name} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 70px 80px', gap: '10px', alignItems: 'center' }}>
            <div className="vt" style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px', color: C.primary, textTransform: 'uppercase' }}>{em && <span>{em.emoji}</span>}{d.name}</div>
            <div style={{ background: C.bg, height: '20px', position: 'relative', overflow: 'hidden', border: `1px solid ${C.muted}` }}>
              <div style={{ width: `${(d.count / maxCount) * 100}%`, height: '100%', background: d.pnl >= 0 ? C.win : C.loss }} />
              <div className="mono" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: '11px', fontWeight: 700, color: '#000', mixBlendMode: 'difference' }}>{d.count} TRADES</div>
            </div>
            <div className="mono" style={{ fontSize: '12px', fontWeight: 700, color: d.winRate >= 50 ? C.win : C.loss, textAlign: 'right' }}>{d.winRate.toFixed(0)}%</div>
            <div className="mono" style={{ fontSize: '13px', fontWeight: 700, color: d.pnl >= 0 ? C.win : C.loss, textAlign: 'right' }}>{d.pnl >= 0 ? '+' : ''}${d.pnl.toFixed(0)}</div>
          </div>
        );
      })}
    </div>
  );
}

function AIInsights({ trades, stats, eligible, remaining, credit, profile, onCreditUpdate }: any) {
  const [insights, setInsights] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isAdmin = !!profile?.is_admin;

  if (!eligible) return <LockedBanner credit={credit} profile={profile} />;

  const generate = async () => {
    if (!stats || stats.empty) { setError('NEED CLOSED TRADES FIRST'); return; }
    if (remaining < AI_COST_MB) { setError(`INSUFFICIENT DATA. NEED ${AI_COST_MB} MB, HAVE ${remaining} MB`); return; }
    setLoading(true); setError(''); setInsights('');
    const summary = {
      totalTrades: stats.total, winRate: stats.winRate.toFixed(1), netPnL: stats.totalPnl.toFixed(2),
      profitFactor: stats.profitFactor.toFixed(2), avgRR: stats.avgRR.toFixed(2),
      byPair: stats.byPair.map((p: any) => ({ pair: p.name, count: p.count, winRate: p.winRate.toFixed(0), pnl: p.pnl.toFixed(0) })),
      byStrategy: stats.byStrategy.map((s: any) => ({ strategy: s.name, count: s.count, winRate: s.winRate.toFixed(0), pnl: s.pnl.toFixed(0) })),
      byEmotion: stats.byEmotion.map((e: any) => ({ emotion: e.name, count: e.count, winRate: e.winRate.toFixed(0), pnl: e.pnl.toFixed(0) })),
      byDay: stats.byDay.filter((d: any) => d.count > 0).map((d: any) => ({ day: d.day, count: d.count, winRate: d.winRate.toFixed(0), pnl: d.pnl.toFixed(0) })),
      recentNotes: trades.slice(0, 10).map((t: Trade) => t.notes).filter(Boolean),
    };
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai-insights`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ summary }),
      });
      const data = await res.json();
      if (data.error === 'INSUFFICIENT_DATA') throw new Error(`NEED ${data.cost_mb} MB`);
      if (data.error) throw new Error(data.error.message || data.error);
      const text = data.content.filter((i: any) => i.type === 'text').map((i: any) => i.text).join('\n');
      setInsights(text);
      onCreditUpdate();
    } catch (e: any) { setError((e.message || 'FAILED').toUpperCase()); }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="pixel-card pixel-card-cyan" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ width: '44px', height: '44px', background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${C.primary}` }}><Sparkles size={22} color="#000" /></div>
          <div style={{ flex: 1 }}>
            <h2 className="pixel-font" style={{ margin: 0, fontSize: '13px', color: C.accent }}>AI COACH</h2>
            <p className="vt" style={{ margin: '4px 0 0 0', fontSize: '15px', color: C.muted }}>{'>'} ANALYZE STRENGTHS & LEAKS · {isAdmin ? 'FREE (ADMIN)' : `COST: ${AI_COST_MB} MB`}</p>
          </div>
        </div>
        <button className="pixel-btn pixel-btn-cyan" onClick={generate} disabled={loading || (!isAdmin && remaining < AI_COST_MB)} style={{ width: '100%', padding: '14px' }}>
          {loading ? <span className="blink">▓ ANALYZING ▓</span> : `► RUN ANALYSIS${isAdmin ? '' : ` (${AI_COST_MB} MB)`}`}
        </button>
        {error && <div style={{ marginTop: '12px', padding: '10px', background: '#330011', border: `2px solid ${C.loss}`, color: C.loss, fontSize: '13px', fontFamily: "'Press Start 2P', monospace" }}>! {error}</div>}
      </div>
      {insights && <div className="pixel-card" style={{ padding: '24px' }}><MarkdownLite text={insights} /></div>}
    </div>
  );
}

function Forecast({ stats, eligible, remaining, credit, profile, onCreditUpdate }: any) {
  const [pair, setPair] = useState('EUR/USD');
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isAdmin = !!profile?.is_admin;

  if (!eligible) return <LockedBanner credit={credit} profile={profile} />;

  const analyze = async () => {
    if (remaining < FORECAST_COST_MB) { setError(`INSUFFICIENT DATA. NEED ${FORECAST_COST_MB} MB, HAVE ${remaining} MB`); return; }
    setLoading(true); setError(''); setAnalysis('');
    const userContext = stats && !stats.empty ? {
      yourStatsOnThisPair: stats.byPair.find((p: any) => p.name === pair) || 'Never traded this pair',
      overallWinRate: stats.winRate.toFixed(1) + '%',
      preferredStrategies: stats.byStrategy.slice(0, 3).map((s: any) => s.name),
    } : null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/forecast`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ pair, userContext }),
      });
      const data = await res.json();
      if (data.error === 'INSUFFICIENT_DATA') throw new Error(`NEED ${data.cost_mb} MB`);
      if (data.error) throw new Error(data.error.message || data.error);
      const text = data.content.filter((i: any) => i.type === 'text').map((i: any) => i.text).join('\n');
      setAnalysis(text);
      onCreditUpdate();
    } catch (e: any) { setError((e.message || 'FAILED').toUpperCase()); }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="pixel-card" style={{ padding: '24px', borderColor: '#FFA500', boxShadow: '6px 6px 0 #553300' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ width: '44px', height: '44px', background: '#FFA500', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${C.primary}` }}><Zap size={22} color="#000" /></div>
          <div style={{ flex: 1 }}>
            <h2 className="pixel-font" style={{ margin: 0, fontSize: '13px', color: '#FFA500' }}>LIVE FORECAST</h2>
            <p className="vt" style={{ margin: '4px 0 0 0', fontSize: '15px', color: C.muted }}>{'>'} REAL-TIME PRICE + AI · {isAdmin ? 'FREE (ADMIN)' : `COST: ${FORECAST_COST_MB} MB`}</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px' }}>
          <select className="pixel-select" value={pair} onChange={(e) => setPair(e.target.value)}>
            {PAIRS.filter((p) => p !== 'Other').map((p) => <option key={p}>{p}</option>)}
          </select>
          <button className="pixel-btn" onClick={analyze} disabled={loading || (!isAdmin && remaining < FORECAST_COST_MB)} style={{ background: '#FFA500', boxShadow: '4px 4px 0 #553300' }}>
            {loading ? <span className="blink">▓▓▓</span> : `► ANALYZE${isAdmin ? '' : ` (${FORECAST_COST_MB} MB)`}`}
          </button>
        </div>
        {error && <div style={{ marginTop: '12px', padding: '10px', background: '#330011', border: `2px solid ${C.loss}`, color: C.loss, fontSize: '13px', fontFamily: "'Press Start 2P', monospace" }}>! {error}</div>}
      </div>
      {analysis && (
        <div className="pixel-card" style={{ padding: '24px' }}>
          <MarkdownLite text={analysis} />
          <div style={{ marginTop: '20px', padding: '12px', background: '#221100', border: `2px solid #FFA500`, fontSize: '14px', color: '#FFA500', fontFamily: "'VT323', monospace" }}>⚠ EDUCATIONAL ONLY. NOT FINANCIAL ADVICE.</div>
        </div>
      )}
    </div>
  );
}

function MarkdownLite({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="vt" style={{ lineHeight: 1.6, fontSize: '17px', color: '#ddd' }}>
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <h3 key={i} className="pixel-font" style={{ margin: '20px 0 10px', fontSize: '11px', color: C.primary }}>► {line.slice(4).toUpperCase()}</h3>;
        if (line.startsWith('## ')) return <h2 key={i} className="pixel-font" style={{ margin: '20px 0 10px', fontSize: '13px', color: C.primary }}>{line.slice(3).toUpperCase()}</h2>;
        if (line.startsWith('- ') || line.startsWith('* ')) return <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}><span style={{ color: C.accent }}>▸</span><span>{formatBold(line.slice(2))}</span></div>;
        if (line.trim() === '') return <div key={i} style={{ height: '8px' }} />;
        return <div key={i} style={{ marginBottom: '4px' }}>{formatBold(line)}</div>;
      })}
    </div>
  );
}

function formatBold(text: string): any {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((p, i) => i % 2 === 1 ? <strong key={i} style={{ color: C.primary }}>{p}</strong> : <span key={i}>{p}</span>);
}

function TradesList({ trades, onSelect }: any) {
  if (trades.length === 0) return <EmptyState msg="NO TRADES LOGGED" />;
  return (
    <div className="pixel-card" style={{ padding: '20px' }}>
      <h3 className="pixel-font" style={{ margin: '0 0 16px 0', fontSize: '11px', color: C.primary }}>► ALL TRADES ({trades.length})</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{trades.map((t: Trade) => <TradeRow key={t.id} trade={t} onClick={() => onSelect(t)} />)}</div>
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return <div className="pixel-card" style={{ padding: '60px', textAlign: 'center' }}><div style={{ fontSize: '64px', marginBottom: '12px' }}>👾</div><p className="pixel-font" style={{ color: C.muted, margin: 0, fontSize: '11px' }}>{msg}</p></div>;
}

function StatCard({ icon, label, value, sub, color, big }: any) {
  return (
    <div className="pixel-card" style={{ padding: '16px', borderColor: color, boxShadow: `4px 4px 0 #333` }}>
      <div className="pixel-font" style={{ display: 'flex', alignItems: 'center', gap: '6px', color, fontSize: '8px', marginBottom: '10px', letterSpacing: '1px' }}>{icon} {label}</div>
      <div className="mono" style={{ fontSize: big ? '24px' : '20px', fontWeight: 700, color }}>{value}</div>
      {sub && <div className="vt" style={{ fontSize: '14px', color: C.muted, marginTop: '4px' }}>{sub}</div>}
    </div>
  );
}

function TradeRow({ trade, onClick }: any) {
  const pnl = Number(trade.pnl), isWin = pnl > 0;
  const hasPnl = trade.pnl !== null && trade.pnl !== '' && trade.pnl !== undefined;
  const emotion = EMOTIONS.find((e) => e.label === trade.emotion);
  return (
    <div onClick={onClick} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto', gap: '14px', alignItems: 'center', padding: '12px 14px', background: C.bg, border: `2px solid ${C.muted}`, cursor: 'pointer' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.primary; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.muted; }}>
      <div style={{ width: '32px', height: '32px', background: trade.direction === 'Long' ? C.win : C.loss, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>{trade.direction === 'Long' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}</div>
      <div>
        <div className="mono" style={{ fontWeight: 700, fontSize: '14px', color: C.primary }}>{trade.pair}</div>
        <div className="vt" style={{ fontSize: '14px', color: C.muted, marginTop: '2px', textTransform: 'uppercase' }}>{trade.date} · {trade.strategy}</div>
      </div>
      {emotion && <div title={emotion.label} style={{ fontSize: '20px' }}>{emotion.emoji}</div>}
      {trade.rr && <div className="mono" style={{ fontSize: '12px', color: '#A020F0', padding: '4px 8px', border: `2px solid #A020F0`, fontWeight: 700 }}>{trade.rr}R</div>}
      <div className="mono" style={{ fontSize: '15px', fontWeight: 700, color: !hasPnl ? C.muted : isWin ? C.win : C.loss, minWidth: '90px', textAlign: 'right' }}>{!hasPnl ? 'OPEN' : `${isWin ? '+' : ''}$${pnl.toFixed(2)}`}</div>
    </div>
  );
}

function TradeForm({ onSave, onClose }: any) {
  const [form, setForm] = useState<any>({ date: new Date().toISOString().slice(0, 10), pair: 'EUR/USD', direction: 'Long', entry: '', exit: '', stop_loss: '', take_profit: '', size: '', pnl: '', rr: '', strategy: 'Breakout', emotion: 'Calm', notes: '', screenshot: '' });
  const [pnlManual, setPnlManual] = useState(false);
  const { pips, pnl: autoPnl } = useMemo(() => calcPnL(form), [form.entry, form.exit, form.size, form.direction, form.pair]);
  useEffect(() => { if (!pnlManual && autoPnl !== null) setForm((f: any) => ({ ...f, pnl: String(autoPnl) })); }, [autoPnl, pnlManual]);

  const handleImage = (e: any) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev: any) => setForm({ ...form, screenshot: ev.target.result });
    reader.readAsDataURL(file);
  };
  const submit = () => {
    if (!form.pair || !form.entry) return;
    const cleaned: any = { ...form };
    ['entry', 'exit', 'stop_loss', 'take_profit', 'size', 'pnl', 'rr'].forEach((k) => { cleaned[k] = cleaned[k] === '' ? null : Number(cleaned[k]); });
    onSave(cleaned);
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
      <div onClick={(e) => e.stopPropagation()} className="pixel-card" style={{ width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 className="pixel-font" style={{ margin: 0, fontSize: '14px', color: C.primary }}>► NEW TRADE</h2>
          <button className="pixel-btn pixel-btn-secondary" onClick={onClose} style={{ padding: '8px 12px' }}><X size={14} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div><label className="pixel-label">DATE</label><input className="pixel-input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          <div><label className="pixel-label">PAIR</label><select className="pixel-select" value={form.pair} onChange={(e) => setForm({ ...form, pair: e.target.value })}>{PAIRS.map((p) => <option key={p}>{p}</option>)}</select></div>
          <div><label className="pixel-label">DIRECTION</label><select className="pixel-select" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}><option>Long</option><option>Short</option></select></div>
          <div><label className="pixel-label">SIZE (LOTS)</label><input className="pixel-input" type="number" step="0.01" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="0.10" /></div>
          <div><label className="pixel-label">ENTRY</label><input className="pixel-input" type="number" step="0.00001" value={form.entry} onChange={(e) => setForm({ ...form, entry: e.target.value })} placeholder="1.08500" /></div>
          <div><label className="pixel-label">EXIT</label><input className="pixel-input" type="number" step="0.00001" value={form.exit} onChange={(e) => setForm({ ...form, exit: e.target.value })} /></div>
          <div><label className="pixel-label">STOP LOSS</label><input className="pixel-input" type="number" step="0.00001" value={form.stop_loss} onChange={(e) => setForm({ ...form, stop_loss: e.target.value })} /></div>
          <div><label className="pixel-label">TAKE PROFIT</label><input className="pixel-input" type="number" step="0.00001" value={form.take_profit} onChange={(e) => setForm({ ...form, take_profit: e.target.value })} /></div>
          <div>
            <label className="pixel-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>P&L $ {!pnlManual && pips !== null && <span style={{ color: C.win }}>· AUTO</span>}{pnlManual && <span style={{ color: '#FFA500' }}>· MANUAL</span>}</span>
              {pnlManual && <button onClick={() => setPnlManual(false)} style={{ background: 'transparent', border: 'none', color: C.accent, fontSize: '7px', cursor: 'pointer', fontFamily: "'Press Start 2P', monospace" }}>↻ RESET</button>}
            </label>
            <input className="pixel-input" type="number" step="0.01" value={form.pnl} onChange={(e) => { setPnlManual(true); setForm({ ...form, pnl: e.target.value }); }} placeholder="Blank if open" style={{ borderColor: pnlManual ? '#FFA500' : pips !== null ? C.win : C.primary }} />
          </div>
          <div><label className="pixel-label">R MULTIPLE</label><input className="pixel-input" type="number" step="0.1" value={form.rr} onChange={(e) => setForm({ ...form, rr: e.target.value })} placeholder="2.5" /></div>
          <div><label className="pixel-label">STRATEGY</label><select className="pixel-select" value={form.strategy} onChange={(e) => setForm({ ...form, strategy: e.target.value })}>{STRATEGIES.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label className="pixel-label">EMOTION</label><select className="pixel-select" value={form.emotion} onChange={(e) => setForm({ ...form, emotion: e.target.value })}>{EMOTIONS.map((e) => <option key={e.label}>{e.label}</option>)}</select></div>
        </div>
        {pips !== null && (
          <div style={{ marginTop: '16px', padding: '14px', background: C.bg, border: `2px solid ${C.accent}`, display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}><div className="pixel-font" style={{ fontSize: '8px', color: C.accent }}>PIPS</div><div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: pips >= 0 ? C.win : C.loss, marginTop: '4px' }}>{pips >= 0 ? '+' : ''}{pips}</div></div>
            <div style={{ width: '2px', height: '36px', background: C.accent }} />
            <div style={{ textAlign: 'center' }}><div className="pixel-font" style={{ fontSize: '8px', color: C.accent }}>CALC P&L</div><div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: (autoPnl ?? 0) >= 0 ? C.win : C.loss, marginTop: '4px' }}>{(autoPnl ?? 0) >= 0 ? '+' : ''}${autoPnl}</div></div>
          </div>
        )}
        <div style={{ marginTop: '14px' }}><label className="pixel-label">NOTES</label><textarea className="pixel-textarea" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Setup, reasoning, mistakes, lessons..." style={{ resize: 'vertical' }} /></div>
        <div style={{ marginTop: '14px' }}><label className="pixel-label">CHART SCREENSHOT</label><input className="pixel-input" type="file" accept="image/*" onChange={handleImage} style={{ padding: '8px', fontSize: '14px' }} />{form.screenshot && <img src={form.screenshot} alt="chart" style={{ marginTop: '10px', maxWidth: '100%', maxHeight: '200px', border: `2px solid ${C.primary}`, imageRendering: 'pixelated' }} />}</div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}><button className="pixel-btn pixel-btn-secondary" onClick={onClose} style={{ flex: 1 }}>CANCEL</button><button className="pixel-btn" onClick={submit} style={{ flex: 2 }}>► SAVE TRADE</button></div>
      </div>
    </div>
  );
}

function TradeDetail({ trade, onClose, onDelete }: any) {
  const pnl = Number(trade.pnl);
  const hasPnl = trade.pnl !== null && trade.pnl !== '' && trade.pnl !== undefined;
  const emotion = EMOTIONS.find((e) => e.label === trade.emotion);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
      <div onClick={(e) => e.stopPropagation()} className="pixel-card" style={{ width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div><div className="mono" style={{ fontSize: '24px', fontWeight: 700, color: C.primary }}>{trade.pair}</div><div className="vt" style={{ fontSize: '15px', color: C.muted, marginTop: '4px', textTransform: 'uppercase' }}>{trade.date} · {trade.direction}</div></div>
          <button className="pixel-btn pixel-btn-secondary" onClick={onClose} style={{ padding: '8px 12px' }}><X size={14} /></button>
        </div>
        {hasPnl && <div style={{ padding: '20px', background: C.bg, border: `3px solid ${pnl >= 0 ? C.win : C.loss}`, marginBottom: '16px', textAlign: 'center' }}><div className="mono" style={{ fontSize: '36px', fontWeight: 700, color: pnl >= 0 ? C.win : C.loss }}>{pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}</div>{trade.rr && <div className="pixel-font" style={{ fontSize: '10px', color: C.muted, marginTop: '6px' }}>{trade.rr}R</div>}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
          <DetailField label="ENTRY" value={trade.entry} mono /><DetailField label="EXIT" value={trade.exit || '—'} mono />
          <DetailField label="STOP LOSS" value={trade.stop_loss || '—'} mono /><DetailField label="TAKE PROFIT" value={trade.take_profit || '—'} mono />
          <DetailField label="SIZE" value={trade.size ? `${trade.size} LOTS` : '—'} /><DetailField label="STRATEGY" value={trade.strategy} />
        </div>
        {emotion && <div style={{ padding: '12px', background: C.bg, border: `2px solid ${emotion.color}`, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}><span style={{ fontSize: '28px' }}>{emotion.emoji}</span><div><div className="pixel-font" style={{ fontSize: '8px', color: emotion.color }}>EMOTION</div><div className="vt" style={{ fontSize: '18px', color: emotion.color, marginTop: '2px', textTransform: 'uppercase' }}>{emotion.label}</div></div></div>}
        {trade.notes && <div style={{ marginBottom: '16px' }}><div className="pixel-font" style={{ fontSize: '8px', color: C.primary, marginBottom: '8px' }}>NOTES</div><div className="vt" style={{ padding: '12px', background: C.bg, border: `2px solid ${C.primary}`, fontSize: '16px', lineHeight: 1.5, color: '#ddd' }}>{trade.notes}</div></div>}
        {trade.screenshot && <div style={{ marginBottom: '16px' }}><div className="pixel-font" style={{ fontSize: '8px', color: C.primary, marginBottom: '8px' }}>CHART</div><img src={trade.screenshot} alt="chart" style={{ width: '100%', border: `2px solid ${C.primary}`, imageRendering: 'pixelated' }} /></div>}
        <button className="pixel-btn pixel-btn-danger" onClick={() => { if (confirm('DELETE THIS TRADE?')) onDelete(trade.id); }} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Trash2 size={14} /> DELETE TRADE</button>
      </div>
    </div>
  );
}

function DetailField({ label, value, mono }: any) {
  return <div style={{ padding: '10px 12px', background: C.bg, border: `2px solid ${C.muted}` }}><div className="pixel-font" style={{ fontSize: '7px', color: C.primary, letterSpacing: '1px' }}>{label}</div><div className={mono ? 'mono' : 'vt'} style={{ fontSize: mono ? '15px' : '17px', fontWeight: 700, marginTop: '4px', color: C.primary, textTransform: mono ? 'none' : 'uppercase' }}>{value}</div></div>;
}

const styles = `
  * { box-sizing: border-box; }
  .pixel-bg-grid { background-image: linear-gradient(rgba(229,255,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(229,255,0,0.04) 1px, transparent 1px); background-size: 16px 16px; }
  .scanlines::before { content: ''; position: fixed; inset: 0; background: repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 3px); pointer-events: none; z-index: 50; }
  .pixel-font { font-family: 'Press Start 2P', monospace; }
  .vt { font-family: 'VT323', monospace; font-size: 18px; }
  .mono { font-family: 'JetBrains Mono', monospace; }
  .pixel-card { background: ${C.bg}; border: 3px solid ${C.primary}; box-shadow: 6px 6px 0 #333, 0 0 0 1px #000; position: relative; }
  .pixel-card-cyan { border-color: ${C.accent}; box-shadow: 6px 6px 0 #333; }
  .pixel-input, .pixel-select, .pixel-textarea { background: ${C.bg}; border: 2px solid ${C.primary}; color: ${C.primary}; padding: 10px 12px; font-family: 'VT323', monospace; font-size: 17px; width: 100%; outline: none; letter-spacing: 1px; text-transform: uppercase; }
  .pixel-input:focus, .pixel-select:focus, .pixel-textarea:focus { background: ${C.panelLight}; border-color: ${C.accent}; }
  .pixel-input::placeholder { color: #555; }
  .pixel-textarea { text-transform: none; }
  .pixel-label { font-family: 'Press Start 2P', monospace; font-size: 8px; color: ${C.primary}; letter-spacing: 1px; margin-bottom: 6px; display: block; }
  .pixel-btn { background: ${C.primary}; color: #000; border: none; padding: 12px 16px; font-family: 'Press Start 2P', monospace; font-size: 10px; cursor: pointer; letter-spacing: 1px; box-shadow: 4px 4px 0 #555; transition: all 0.05s; text-transform: uppercase; }
  .pixel-btn:hover:not(:disabled) { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 #555; }
  .pixel-btn:active:not(:disabled) { transform: translate(4px, 4px); box-shadow: 0 0 0 #555; }
  .pixel-btn:disabled { background: #444; color: #888; cursor: not-allowed; box-shadow: 4px 4px 0 #222; }
  .pixel-btn-secondary { background: ${C.bg}; color: ${C.primary}; border: 2px solid ${C.primary}; }
  .pixel-btn-danger { background: ${C.loss}; color: #000; box-shadow: 4px 4px 0 #550011; }
  .pixel-btn-cyan { background: ${C.accent}; color: #000; box-shadow: 4px 4px 0 #004455; }
  .tab-btn { background: ${C.bg}; color: ${C.muted}; border: 2px solid ${C.muted}; padding: 8px 14px; font-family: 'Press Start 2P', monospace; font-size: 9px; cursor: pointer; letter-spacing: 1px; display: flex; align-items: center; gap: 6px; white-space: nowrap; }
  .tab-btn:hover { color: ${C.primary}; border-color: ${C.primary}; }
  .tab-btn.active { background: ${C.primary}; color: #000; border-color: ${C.primary}; box-shadow: 3px 3px 0 #555; }
  ::-webkit-scrollbar { width: 12px; height: 12px; }
  ::-webkit-scrollbar-track { background: ${C.bg}; border: 1px solid ${C.muted}; }
  ::-webkit-scrollbar-thumb { background: ${C.primary}; border: 2px solid ${C.bg}; }
  .blink { animation: blink 1s steps(2) infinite; }
  @keyframes blink { 50% { opacity: 0.3; } }
`;
