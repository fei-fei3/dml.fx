'use client';

import { useState, useEffect } from 'react';
import { supabase, formatData, type Profile, type MonthlyCredit } from '@/lib/supabase';
import { X, User, Lock, Wifi, MessageCircle, Instagram, ExternalLink, CheckCircle, XCircle, LogOut, Calendar } from 'lucide-react';

const C = { bg: '#000', primary: '#E5FF00', win: '#39FF14', loss: '#FF003C', accent: '#00E5FF', muted: '#888' };

export default function AccountSettings({ user, profile, credit, onClose, onSignOut }: { user: any; profile: Profile | null; credit: MonthlyCredit | null; onClose: () => void; onSignOut: () => void }) {
  const [tab, setTab] = useState<'profile' | 'password' | 'data' | 'support'>('profile');

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '640px', maxHeight: '92vh', overflowY: 'auto', background: C.bg, border: `3px solid ${C.primary}`, boxShadow: `8px 8px 0 #555`, fontFamily: "'VT323', monospace", color: C.primary }}>
        <style>{`
          .as-tab { background: ${C.bg}; color: ${C.muted}; border: 2px solid ${C.muted}; padding: 8px 12px; font-family: 'Press Start 2P', monospace; font-size: 8px; cursor: pointer; flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; }
          .as-tab:hover { color: ${C.primary}; border-color: ${C.primary}; }
          .as-tab.active { background: ${C.primary}; color: #000; border-color: ${C.primary}; }
          .as-input { background: ${C.bg}; border: 2px solid ${C.primary}; color: ${C.primary}; padding: 10px 12px; font-family: 'VT323', monospace; font-size: 17px; width: 100%; outline: none; letter-spacing: 1px; }
          .as-input:focus { background: #1a1a00; border-color: ${C.accent}; }
          .as-label { font-family: 'Press Start 2P', monospace; font-size: 8px; color: ${C.primary}; letter-spacing: 1px; margin-bottom: 6px; display: block; }
          .as-btn { background: ${C.primary}; color: #000; border: none; padding: 12px 16px; font-family: 'Press Start 2P', monospace; font-size: 10px; cursor: pointer; box-shadow: 4px 4px 0 #555; transition: all 0.05s; width: 100%; }
          .as-btn:hover:not(:disabled) { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 #555; }
          .as-btn:disabled { background: #444; color: #888; cursor: not-allowed; }
          .as-btn-secondary { background: ${C.bg}; color: ${C.primary}; border: 2px solid ${C.primary}; }
          .as-btn-danger { background: ${C.loss}; color: #000; box-shadow: 4px 4px 0 #550011; }
          .social-btn { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: ${C.bg}; border: 2px solid ${C.muted}; cursor: pointer; transition: all 0.1s; text-decoration: none; color: ${C.primary}; }
          .social-btn:hover { border-color: ${C.primary}; transform: translateX(4px); }
        `}</style>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `2px solid ${C.primary}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: "'Press Start 2P', monospace", fontSize: '14px', color: C.primary }}>► ACCOUNT</h2>
            <div style={{ fontSize: '14px', color: C.muted, marginTop: '4px' }}>{user.email}</div>
          </div>
          <button className="as-btn-secondary" onClick={onClose} style={{ padding: '8px 12px', cursor: 'pointer', fontFamily: "'Press Start 2P', monospace", fontSize: '10px' }}><X size={14} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '6px', padding: '14px 24px 0 24px' }}>
          <button className={`as-tab ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}><User size={11} /> PROFILE</button>
          <button className={`as-tab ${tab === 'password' ? 'active' : ''}`} onClick={() => setTab('password')}><Lock size={11} /> PASSWORD</button>
          <button className={`as-tab ${tab === 'data' ? 'active' : ''}`} onClick={() => setTab('data')}><Wifi size={11} /> DATA</button>
          <button className={`as-tab ${tab === 'support' ? 'active' : ''}`} onClick={() => setTab('support')}><MessageCircle size={11} /> SUPPORT</button>
        </div>

        {/* Tab content */}
        <div style={{ padding: '24px' }}>
          {tab === 'profile' && <ProfileTab user={user} profile={profile} onSignOut={onSignOut} />}
          {tab === 'password' && <PasswordTab />}
          {tab === 'data' && <DataTab credit={credit} profile={profile} />}
          {tab === 'support' && <SupportTab />}
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ user, profile, onSignOut }: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Field label="EMAIL" value={user.email} />
      <Field label="MT5 ACCOUNT" value={profile?.mt5_account || '—'} />
      <Field label="MEMBER SINCE" value={user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'} />
      <Field label="DEPOSIT STATUS" value={profile?.deposit_verified ? 'VERIFIED ✓' : 'PENDING'} color={profile?.deposit_verified ? C.win : '#FFA500'} />
      <button className="as-btn-danger" onClick={() => { if (confirm('SIGN OUT?')) onSignOut(); }} style={{ marginTop: '8px', cursor: 'pointer', padding: '12px 16px', fontFamily: "'Press Start 2P', monospace", fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <LogOut size={14} /> SIGN OUT
      </button>
    </div>
  );
}

function PasswordTab() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError(''); setDone(false);
    if (next.length < 6) { setError('PASSWORD MUST BE 6+ CHARACTERS'); return; }
    if (next !== confirm) { setError('PASSWORDS DO NOT MATCH'); return; }
    setLoading(true);
    // Verify current password by re-authenticating
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      const { error: signErr } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
      if (signErr) { setError('CURRENT PASSWORD INCORRECT'); setLoading(false); return; }
    }
    const { error } = await supabase.auth.updateUser({ password: next });
    setLoading(false);
    if (error) setError(error.message.toUpperCase());
    else { setDone(true); setCurrent(''); setNext(''); setConfirm(''); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div><label className="as-label">CURRENT PASSWORD</label><input className="as-input" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
      <div><label className="as-label">NEW PASSWORD</label><input className="as-input" type="password" value={next} onChange={(e) => setNext(e.target.value)} /></div>
      <div><label className="as-label">CONFIRM NEW PASSWORD</label><input className="as-input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
      {error && <div style={{ padding: '10px', background: '#330011', border: `2px solid ${C.loss}`, color: C.loss, fontSize: '12px', fontFamily: "'Press Start 2P', monospace" }}>! {error}</div>}
      {done && <div style={{ padding: '10px', background: '#003311', border: `2px solid ${C.win}`, color: C.win, fontSize: '12px', fontFamily: "'Press Start 2P', monospace" }}>✓ PASSWORD UPDATED</div>}
      <button className="as-btn" onClick={submit} disabled={loading || !current || !next || !confirm} style={{ cursor: 'pointer' }}>{loading ? 'UPDATING...' : '► UPDATE PASSWORD'}</button>
    </div>
  );
}

function DataTab({ credit, profile }: any) {
  const remaining = credit ? credit.mb_total - credit.mb_used : 0;
  const total = credit?.mb_total || 0;
  const pct = total ? (remaining / total) * 100 : 0;
  const color = remaining > 100 ? C.win : remaining > 20 ? '#FFA500' : C.loss;
  const ym = credit?.year_month || new Date().toISOString().slice(0, 7);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ padding: '20px', background: C.bg, border: `3px solid ${color}`, textAlign: 'center' }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '8px', color: C.muted, letterSpacing: '2px', marginBottom: '8px' }}>► DATA REMAINING</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '36px', fontWeight: 700, color }}>{formatData(remaining)}</div>
        <div style={{ fontSize: '14px', color: C.muted, marginTop: '6px' }}>OF {formatData(total)}</div>
        <div style={{ marginTop: '14px', height: '12px', background: '#222', border: `1px solid ${C.muted}`, position: 'relative' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <Stat label="LOTS THIS MONTH" value={Number(credit?.lots_this_month || 0).toFixed(2)} color={C.win} />
        <Stat label="GB EARNED" value={`${credit?.gb_earned || 0} / 5`} color={C.primary} />
        <Stat label="MB USED" value={formatData(credit?.mb_used || 0)} color="#FFA500" />
        <Stat label="ADMIN BONUS" value={formatData(credit?.admin_bonus_mb || 0)} color={C.accent} />
      </div>

      <div style={{ padding: '14px', background: C.bg, border: `2px dashed ${C.muted}`, fontSize: '14px', lineHeight: 1.6 }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '8px', color: C.primary, marginBottom: '8px' }}>► HOW IT WORKS</div>
        <div style={{ color: '#ccc' }}>
          {'>'} TRADE 1 LOT VIA AIMS = +1 GB DATA<br />
          {'>'} AI INSIGHT = 4 MB · FORECAST = 20 MB<br />
          {'>'} MAX 5 GB / MONTH · RESETS ON 1ST<br />
          {'>'} CURRENT PERIOD: {ym}
        </div>
      </div>

      {!profile?.deposit_verified && (
        <div style={{ padding: '14px', background: '#221100', border: `2px solid #FFA500`, fontSize: '14px', color: '#FFA500' }}>
          ⚠ DEPOSIT NOT VERIFIED. CONTACT ADMIN TO ACTIVATE.
        </div>
      )}
    </div>
  );
}

function SupportTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ fontSize: '15px', color: '#ccc', marginBottom: '8px', lineHeight: 1.6 }}>
        {'>'} NEED HELP? REACH OUT VIA TELEGRAM OR FOLLOW US FOR UPDATES, MARKET INSIGHTS & MORE.
      </div>

      <a className="social-btn" href="https://t.me/dml_admin" target="_blank" rel="noopener noreferrer">
        <div style={{ width: '40px', height: '40px', background: '#0088cc', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${C.primary}` }}>
          <MessageCircle size={20} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '10px', color: C.primary }}>CONTACT ADMIN</div>
          <div style={{ fontSize: '15px', color: C.muted, marginTop: '2px' }}>TELEGRAM @dml_admin</div>
        </div>
        <ExternalLink size={16} color={C.muted} />
      </a>

      <a className="social-btn" href="https://instagram.com/dml.fx" target="_blank" rel="noopener noreferrer">
        <div style={{ width: '40px', height: '40px', background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${C.primary}` }}>
          <Instagram size={20} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '10px', color: C.primary }}>FOLLOW US</div>
          <div style={{ fontSize: '15px', color: C.muted, marginTop: '2px' }}>INSTAGRAM @dml.fx</div>
        </div>
        <ExternalLink size={16} color={C.muted} />
      </a>

      <div style={{ padding: '14px', background: C.bg, border: `2px dashed ${C.muted}`, fontSize: '14px', color: '#ccc', lineHeight: 1.6, marginTop: '10px' }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '8px', color: C.primary, marginBottom: '8px' }}>► COMMON QUESTIONS</div>
        <div>{'>'} <span style={{ color: C.accent }}>Why are AI features locked?</span> Need verified $1k deposit + 1 lot traded this month.</div>
        <div style={{ marginTop: '6px' }}>{'>'} <span style={{ color: C.accent }}>How fast does data refresh?</span> Lots are imported by admin daily/weekly.</div>
        <div style={{ marginTop: '6px' }}>{'>'} <span style={{ color: C.accent }}>Lost MT5 access?</span> Contact admin via Telegram above.</div>
      </div>

      <div style={{ textAlign: 'center', fontSize: '13px', color: C.muted, marginTop: '8px', padding: '10px', borderTop: `1px dashed #444` }}>
        DML FX // EST 2025 · v2.05
      </div>
    </div>
  );
}

function Field({ label, value, color }: any) {
  return (
    <div style={{ padding: '10px 14px', background: C.bg, border: `2px solid ${C.muted}` }}>
      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '7px', color: C.primary, letterSpacing: '1px' }}>{label}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', fontWeight: 700, marginTop: '4px', color: color || C.primary }}>{value}</div>
    </div>
  );
}

function Stat({ label, value, color }: any) {
  return (
    <div style={{ padding: '14px', background: C.bg, border: `2px solid ${color}`, textAlign: 'center' }}>
      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '7px', color: C.muted, letterSpacing: '1px' }}>{label}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '18px', fontWeight: 700, color, marginTop: '6px' }}>{value}</div>
    </div>
  );
}
