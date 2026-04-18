'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    // Supabase password reset puts the user in a temporary session via URL fragment
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setHasSession(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const submit = async () => {
    setError('');
    if (password.length < 6) { setError('PASSWORD MUST BE 6+ CHARACTERS'); return; }
    if (password !== confirm) { setError('PASSWORDS DO NOT MATCH'); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) setError(error.message.toUpperCase());
    else setDone(true);
  };

  return (
    <div className="pixel-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: "'VT323', monospace", color: '#E5FF00' }}>
      <style>{`
        .pixel-bg { background: #000; background-image: linear-gradient(rgba(229,255,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(229,255,0,0.03) 1px, transparent 1px); background-size: 16px 16px; }
        .pixel-card { background: #000; border: 4px solid #E5FF00; box-shadow: 8px 8px 0 #E5FF00, 0 0 24px rgba(229,255,0,0.3); }
        .pixel-input { background: #000; border: 3px solid #E5FF00; color: #E5FF00; padding: 12px 14px; font-family: 'VT323', monospace; font-size: 18px; width: 100%; outline: none; letter-spacing: 1px; }
        .pixel-btn { background: #E5FF00; color: #000; border: none; padding: 14px; font-family: 'Press Start 2P', monospace; font-size: 11px; cursor: pointer; width: 100%; box-shadow: 4px 4px 0 #888; }
        .pixel-btn:hover:not(:disabled) { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 #888; }
        .pixel-btn:disabled { background: #444; color: #888; cursor: not-allowed; }
        .pixel-label { font-family: 'Press Start 2P', monospace; font-size: 8px; color: #E5FF00; letter-spacing: 1px; margin-bottom: 6px; display: block; }
      `}</style>

      <div className="pixel-card" style={{ width: '100%', maxWidth: '420px', padding: '32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ margin: 0, fontFamily: "'Press Start 2P', monospace", fontSize: '16px', color: '#E5FF00', textShadow: '4px 4px 0 #888' }}>► RESET PASSWORD</h1>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '12px', color: '#39FF14', marginBottom: '20px' }}>PASSWORD UPDATED</div>
            <a href="/" className="pixel-btn" style={{ display: 'inline-block', textDecoration: 'none' }}>► GO TO LOGIN</a>
          </div>
        ) : !hasSession ? (
          <div style={{ textAlign: 'center', padding: '20px', fontSize: '16px', color: '#888' }}>
            {'>'} INVALID OR EXPIRED RESET LINK<br /><br />
            <a href="/" style={{ color: '#00E5FF' }}>{'>'} BACK TO LOGIN</a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="pixel-label">NEW PASSWORD</label>
              <input className="pixel-input" type="password" placeholder="********" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <label className="pixel-label">CONFIRM PASSWORD</label>
              <input className="pixel-input" type="password" placeholder="********" value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
            </div>
            {error && <div style={{ padding: '10px', background: '#330011', border: '2px solid #FF003C', color: '#FF003C', fontSize: '12px', fontFamily: "'Press Start 2P', monospace" }}>! {error}</div>}
            <button className="pixel-btn" onClick={submit} disabled={loading}>{loading ? 'UPDATING...' : '► SET NEW PASSWORD'}</button>
          </div>
        )}
      </div>
    </div>
  );
}
