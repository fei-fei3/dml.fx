'use client';

import { useState, useEffect } from 'react';
import { supabase, formatData } from '@/lib/supabase';
import { ArrowLeft, Upload, Users, CheckCircle, XCircle, Download, Brain, Zap } from 'lucide-react';

const C = { bg: '#000', primary: '#E5FF00', win: '#39FF14', loss: '#FF003C', accent: '#00E5FF', muted: '#888' };

type ParsedRow = { mt5_account: string; client_email: string; client_name: string; close_date: string; lots: number };

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminPanel({ onExit }: { onExit: () => void }) {
  const [tab, setTab] = useState<'import' | 'users' | 'ai_logs'>('import');

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.primary, fontFamily: "'VT323', monospace" }}>
      <style>{`
        .admin-card { background: #000; border: 3px solid ${C.primary}; box-shadow: 6px 6px 0 #333; padding: 20px; }
        .pixel-btn { background: ${C.primary}; color: #000; border: none; padding: 10px 14px; font-family: 'Press Start 2P', monospace; font-size: 10px; cursor: pointer; box-shadow: 4px 4px 0 #555; }
        .pixel-btn:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 #555; }
        .pixel-btn-secondary { background: #000; color: ${C.primary}; border: 2px solid ${C.primary}; }
        .pixel-btn-danger { background: ${C.loss}; color: #000; box-shadow: 4px 4px 0 #550011; }
        .pixel-btn-success { background: ${C.win}; color: #000; box-shadow: 4px 4px 0 #003311; }
        .pixel-btn:disabled { background: #444; color: #888; cursor: not-allowed; box-shadow: 4px 4px 0 #222; }
        .tab-btn { background: #000; color: ${C.muted}; border: 2px solid ${C.muted}; padding: 8px 14px; font-family: 'Press Start 2P', monospace; font-size: 9px; cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .tab-btn.active { background: ${C.primary}; color: #000; border-color: ${C.primary}; box-shadow: 3px 3px 0 #555; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #333; font-size: 14px; }
        th { font-family: 'Press Start 2P', monospace; font-size: 8px; color: ${C.primary}; letter-spacing: 1px; }
      `}</style>

      <header style={{ borderBottom: `3px solid ${C.primary}`, padding: '16px 24px', position: 'sticky', top: 0, background: '#000', zIndex: 10 }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ margin: 0, fontFamily: "'Press Start 2P', monospace", fontSize: '16px', color: C.primary, textShadow: '3px 3px 0 #555' }}>► ADMIN PANEL</h1>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '7px', color: C.muted, letterSpacing: '2px', marginTop: '6px' }}>DML FX // CONTROL CENTER</div>
          </div>
          <button className="pixel-btn pixel-btn-secondary" onClick={onExit} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ArrowLeft size={12} /> BACK TO APP
          </button>
        </div>
        <div style={{ maxWidth: '1280px', margin: '14px auto 0', display: 'flex', gap: '8px' }}>
          <button className={`tab-btn ${tab === 'import' ? 'active' : ''}`} onClick={() => setTab('import')}><Upload size={11} /> CSV IMPORT</button>
          <button className={`tab-btn ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}><Users size={11} /> USERS</button>
          <button className={`tab-btn ${tab === 'ai_logs' ? 'active' : ''}`} onClick={() => setTab('ai_logs')}><Brain size={11} /> AI LOGS</button>
        </div>
      </header>

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px' }}>
        {tab === 'import' && <ImportTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'ai_logs' && <AILogsTab />}
      </main>
    </div>
  );
}

function ImportTab() {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [filename, setFilename] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFile = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name); setResult(null);
    const text = await file.text();
    setRows(parseCSV(text));
  };

  const submit = async () => {
    setImporting(true);
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/import-csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      setResult(data);
      if (!data.error) setRows([]);
    } catch (e: any) { setResult({ error: e.message }); }
    setImporting(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="admin-card">
        <h2 style={{ margin: '0 0 16px 0', fontFamily: "'Press Start 2P', monospace", fontSize: '13px', color: C.primary }}>► UPLOAD AIMS CSV</h2>
        <div style={{ fontSize: '15px', color: C.muted, marginBottom: '14px' }}>{'>'} Download CSV from AIMS partner dashboard, drop here. Duplicates are auto-skipped.</div>
        <input type="file" accept=".csv" onChange={handleFile} style={{ background: C.bg, border: `2px solid ${C.primary}`, color: C.primary, padding: '10px', width: '100%', fontFamily: "'VT323', monospace", fontSize: '15px' }} />
        {filename && <div style={{ marginTop: '10px', fontSize: '14px', color: C.accent }}>► {filename} — {rows.length} rows parsed</div>}
      </div>
      {rows.length > 0 && (
        <div className="admin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontFamily: "'Press Start 2P', monospace", fontSize: '11px', color: C.primary }}>► PREVIEW ({rows.length} ROWS)</h3>
            <button className="pixel-btn pixel-btn-success" onClick={submit} disabled={importing}><Upload size={12} /> {importing ? 'IMPORTING...' : 'CONFIRM IMPORT'}</button>
          </div>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table><thead><tr><th>EMAIL</th><th>MT5</th><th>DATE</th><th>LOTS</th></tr></thead>
            <tbody>{rows.slice(0, 50).map((r, i) => <tr key={i}><td style={{ color: C.accent }}>{r.client_email}</td><td>{r.mt5_account}</td><td>{r.close_date}</td><td style={{ color: C.win, fontWeight: 700 }}>{r.lots}</td></tr>)}</tbody></table>
            {rows.length > 50 && <div style={{ color: C.muted, padding: '10px', fontSize: '13px' }}>... and {rows.length - 50} more</div>}
          </div>
        </div>
      )}
      {result && (
        <div className="admin-card" style={{ borderColor: result.error ? C.loss : C.win }}>
          <h3 style={{ margin: '0 0 10px 0', fontFamily: "'Press Start 2P', monospace", fontSize: '11px', color: result.error ? C.loss : C.win }}>{result.error ? '! ERROR' : '✓ IMPORT COMPLETE'}</h3>
          <div style={{ fontSize: '15px' }}>{result.error || result.message}</div>
        </div>
      )}
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);
  const load = async () => {
    setLoading(true);
    const ym = new Date().toISOString().slice(0, 7);
    const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    const { data: credits } = await supabase.from('monthly_credits').select('*').eq('year_month', ym);
    setUsers((profiles || []).map((p) => ({ ...p, credit: credits?.find((c) => c.user_id === p.id) })));
    setLoading(false);
  };

  const toggleDeposit = async (u: any) => {
    await supabase.from('profiles').update({ deposit_verified: !u.deposit_verified, deposit_verified_at: !u.deposit_verified ? new Date().toISOString() : null }).eq('id', u.id);
    load();
  };

  const grantBonus = async (u: any) => {
    const mb = parseInt(prompt(`Grant bonus MB to ${u.email}? (e.g., 1024 for 1 GB)`) || '0');
    if (!mb) return;
    const ym = new Date().toISOString().slice(0, 7);
    await supabase.rpc('get_or_create_monthly_credit', { p_user_id: u.id });
    const { data: existing } = await supabase.from('monthly_credits').select('*').eq('user_id', u.id).eq('year_month', ym).single();
    if (existing) {
      const newBonus = (existing.admin_bonus_mb || 0) + mb;
      await supabase.from('monthly_credits').update({ admin_bonus_mb: newBonus, mb_total: (existing.gb_earned * 1024) + newBonus }).eq('id', existing.id);
      await supabase.from('credit_transactions').insert({ user_id: u.id, year_month: ym, type: 'grant_admin', mb_delta: mb, description: `Admin bonus +${mb} MB` });
    }
    load();
  };

  const toggleDeactivate = async (u: any) => {
    if (u.is_admin) { alert('CANNOT DEACTIVATE AN ADMIN'); return; }
    if (!confirm(u.deactivated ? `Reactivate ${u.email}?` : `Deactivate ${u.email}?\n\nReversible.`)) return;
    await supabase.from('profiles').update({ deactivated: !u.deactivated, deactivated_at: !u.deactivated ? new Date().toISOString() : null }).eq('id', u.id);
    load();
  };

  const deleteUser = async (u: any) => {
    if (u.is_admin) { alert('CANNOT DELETE AN ADMIN'); return; }
    if (prompt(`PERMANENT DELETE: ${u.email}\n\nType DELETE to confirm:`) !== 'DELETE') return;
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ user_id_to_delete: u.id }),
    });
    const data = await res.json();
    alert(data.error ? 'FAILED: ' + data.error : 'USER DELETED');
    load();
  };

  const exportUsers = () => {
    downloadCSV('dml-fx-users.csv',
      ['Email', 'MT5', 'Admin', 'Deposit Verified', 'Deactivated', 'Lots This Month', 'MB Total', 'MB Used', 'MB Remaining'],
      users.map(u => {
        const c = u.credit || { lots_this_month: 0, mb_total: 0, mb_used: 0 };
        return [u.email, u.mt5_account || '', u.is_admin, u.deposit_verified, u.deactivated || false, Number(c.lots_this_month).toFixed(2), c.mb_total, c.mb_used, c.mb_total - c.mb_used];
      })
    );
  };

  const exportTrades = async () => {
    const { data } = await supabase.from('trades').select('*, profiles!inner(email, mt5_account)');
    if (!data || data.length === 0) { alert('NO TRADES TO EXPORT'); return; }
    downloadCSV('dml-fx-all-trades.csv',
      ['Email', 'MT5', 'Date', 'Pair', 'Direction', 'Entry', 'Exit', 'SL', 'TP', 'Size', 'PnL', 'R:R', 'Strategy', 'Emotion', 'Notes'],
      data.map((t: any) => [t.profiles?.email || '', t.profiles?.mt5_account || '', t.date, t.pair, t.direction, t.entry, t.exit, t.stop_loss, t.take_profit, t.size, t.pnl, t.rr, t.strategy, t.emotion, (t.notes || '').replace(/\n/g, ' ')])
    );
  };

  if (loading) return <div className="admin-card">LOADING USERS...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button className="pixel-btn" onClick={exportUsers} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Download size={12} /> EXPORT USERS CSV</button>
        <button className="pixel-btn" onClick={exportTrades} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: C.accent, boxShadow: '4px 4px 0 #004455' }}><Download size={12} /> EXPORT ALL TRADES CSV</button>
      </div>

      <div className="admin-card">
        <h2 style={{ margin: '0 0 16px 0', fontFamily: "'Press Start 2P', monospace", fontSize: '13px', color: C.primary }}>► USERS ({users.length})</h2>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>EMAIL</th><th>MT5</th><th>DEPOSIT</th><th>LOTS/MO</th><th>DATA</th><th>ACTIONS</th></tr></thead>
            <tbody>
              {users.map((u) => {
                const c = u.credit || { mb_total: 0, mb_used: 0, lots_this_month: 0 };
                const remaining = c.mb_total - c.mb_used;
                return (
                  <tr key={u.id} style={{ opacity: u.deactivated ? 0.5 : 1 }}>
                    <td style={{ color: C.accent }}>
                      {u.email}
                      {u.is_admin && <span style={{ marginLeft: 6, padding: '2px 6px', background: C.primary, color: '#000', fontSize: '9px', fontWeight: 700 }}>ADMIN</span>}
                      {u.deactivated && <span style={{ marginLeft: 6, padding: '2px 6px', background: C.loss, color: '#fff', fontSize: '9px', fontWeight: 700 }}>DEACTIVATED</span>}
                    </td>
                    <td>{u.mt5_account || '—'}</td>
                    <td>{u.deposit_verified ? <CheckCircle size={16} color={C.win} /> : <XCircle size={16} color={C.loss} />}</td>
                    <td style={{ color: C.win, fontWeight: 700 }}>{u.is_admin ? '∞' : Number(c.lots_this_month).toFixed(2)}</td>
                    <td style={{ color: u.is_admin ? C.primary : remaining > 0 ? C.win : C.muted, fontWeight: 700 }}>
                      {u.is_admin ? 'UNLIMITED' : `${formatData(remaining)} / ${formatData(c.mb_total)}`}
                    </td>
                    <td style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      <button className="pixel-btn pixel-btn-secondary" style={{ fontSize: '7px', padding: '5px 7px' }} onClick={() => toggleDeposit(u)}>{u.deposit_verified ? 'UNVERIFY' : 'VERIFY $1K'}</button>
                      <button className="pixel-btn" style={{ fontSize: '7px', padding: '5px 7px' }} onClick={() => grantBonus(u)} disabled={u.is_admin}>+ MB</button>
                      {!u.is_admin && (
                        <>
                          <button className="pixel-btn" style={{ fontSize: '7px', padding: '5px 7px', background: u.deactivated ? C.win : '#FFA500', boxShadow: '4px 4px 0 #553300' }} onClick={() => toggleDeactivate(u)}>{u.deactivated ? 'REACTIVATE' : 'DEACTIVATE'}</button>
                          <button className="pixel-btn pixel-btn-danger" style={{ fontSize: '7px', padding: '5px 7px' }} onClick={() => deleteUser(u)}>DELETE</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AILogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { load(); }, []);
  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('ai_responses').select('*, profiles!inner(email, mt5_account)').order('created_at', { ascending: false }).limit(100);
    setLogs(data || []);
    setLoading(false);
  };

  const exportLogs = () => {
    if (logs.length === 0) { alert('NO LOGS'); return; }
    downloadCSV('dml-fx-ai-logs.csv',
      ['Date', 'Email', 'Type', 'Pair', 'MB Cost', 'Response Preview'],
      logs.map(l => [
        new Date(l.created_at).toLocaleString(),
        l.profiles?.email || '',
        l.type.toUpperCase(),
        l.pair || '—',
        l.mb_cost,
        (l.response_text || '').slice(0, 200).replace(/\n/g, ' ')
      ])
    );
  };

  if (loading) return <div className="admin-card">LOADING AI LOGS...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '11px', color: C.primary }}>{logs.length} RESPONSES LOGGED</div>
        <button className="pixel-btn" onClick={exportLogs} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Download size={12} /> EXPORT AI LOGS</button>
      </div>

      {logs.length === 0 ? (
        <div className="admin-card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🤖</div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '11px', color: C.muted }}>NO AI RESPONSES YET</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {logs.map((log) => {
            const isOpen = expanded === log.id;
            const typeIcon = log.type === 'insight' ? '🧠' : '⚡';
            const typeColor = log.type === 'insight' ? C.accent : '#FFA500';
            return (
              <div key={log.id} className="admin-card" style={{ borderColor: typeColor, cursor: 'pointer', padding: isOpen ? '20px' : '14px' }} onClick={() => setExpanded(isOpen ? null : log.id)}>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto', gap: '12px', alignItems: 'center' }}>
                  <div style={{ fontSize: '24px' }}>{typeIcon}</div>
                  <div>
                    <div style={{ fontWeight: 700, color: C.accent, fontSize: '14px' }}>{log.profiles?.email}</div>
                    <div style={{ fontSize: '13px', color: C.muted, marginTop: '2px' }}>{new Date(log.created_at).toLocaleString()}</div>
                  </div>
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '8px', color: typeColor, padding: '4px 8px', border: `2px solid ${typeColor}` }}>
                    {log.type === 'insight' ? 'INSIGHT' : `FORECAST ${log.pair || ''}`}
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: log.mb_cost === 0 ? C.primary : C.muted }}>
                    {log.mb_cost === 0 ? 'FREE' : `${log.mb_cost} MB`}
                  </div>
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '8px', color: C.muted }}>{isOpen ? '▲' : '▼'}</div>
                </div>
                {isOpen && (
                  <div style={{ marginTop: '16px', padding: '16px', background: '#0a0a00', border: `1px solid #333`, fontSize: '14px', lineHeight: 1.6, color: '#ccc', whiteSpace: 'pre-wrap', maxHeight: '400px', overflowY: 'auto' }}>
                    {log.response_text || 'No response text'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/);
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 6) continue;
    const [name, email, _ref, mt4, closeDateRaw, lotsStr] = cols;
    const closeDate = closeDateRaw.slice(0, 10);
    const lots = parseFloat(lotsStr);
    if (!mt4 || !closeDate || isNaN(lots)) continue;
    rows.push({ mt5_account: mt4, client_email: email, client_name: name, close_date: closeDate, lots });
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) { result.push(cur); cur = ''; }
    else cur += ch;
  }
  result.push(cur);
  return result.map((s) => s.trim());
}
