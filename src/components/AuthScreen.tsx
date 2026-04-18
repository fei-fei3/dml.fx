'use client';

import { useState } from 'react';
import { supabase, emailFromMT5 } from '@/lib/supabase';

type Mode = 'signin' | 'signup' | 'forgot';

export default function AuthScreen() {
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [mt5, setMt5] = useState('');
  const [password, setPassword] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [mode, setMode] = useState<Mode>('signin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async () => {
    setLoading(true); setError(''); setMessage('');
    try {
      if (mode === 'signup') {
        if (!email || !mt5 || !password) throw new Error('All fields required');
        if (!/^\d+$/.test(mt5)) throw new Error('MT5 must be numbers only');
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) {
          await new Promise(r => setTimeout(r, 500));
          const { error: pErr } = await supabase.from('profiles').update({ mt5_account: mt5 }).eq('id', data.user.id);
          if (pErr && pErr.code === '23505') throw new Error('THIS MT5 ACCOUNT IS ALREADY REGISTERED');
        }
        setMessage('CHECK YOUR EMAIL TO CONFIRM');
      } else if (mode === 'signin') {
        let loginEmail = identifier;
        if (/^\d+$/.test(identifier)) {
          const found = await emailFromMT5(identifier);
          if (!found) throw new Error('MT5 ACCOUNT NOT FOUND');
          loginEmail = found;
        }
        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
        if (error) throw error;
      } else if (mode === 'forgot') {
        if (!forgotEmail) throw new Error('Enter your email');
        const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : '';
        const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, { redirectTo });
        if (error) throw error;
        setMessage('IF EMAIL EXISTS, A RESET LINK WAS SENT. CHECK YOUR INBOX (AND SPAM)');
      }
    } catch (e: any) { setError((e.message || 'ERROR').toUpperCase()); }
    setLoading(false);
  };

  const switchMode = (m: Mode) => { setMode(m); setError(''); setMessage(''); };

  return (
    <div className="pixel-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: "'VT323', monospace", color: '#E5FF00' }}>
      <style>{`
        .pixel-bg { background: #000; background-image: linear-gradient(rgba(229,255,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(229,255,0,0.03) 1px, transparent 1px); background-size: 16px 16px; }
        .pixel-bg::before { content: ''; position: fixed; inset: 0; background: repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 3px); pointer-events: none; z-index: 1; }
        .pixel-card { background: #000; border: 4px solid #E5FF00; box-shadow: 8px 8px 0 #E5FF00, 0 0 24px rgba(229,255,0,0.3); position: relative; z-index: 2; }
        .pixel-input { background: #000; border: 3px solid #E5FF00; color: #E5FF00; padding: 12px 14px; font-family: 'VT323', monospace; font-size: 18px; width: 100%; outline: none; letter-spacing: 1px; }
        .pixel-input:focus { background: #1a1a00; }
        .pixel-input::placeholder { color: #666; }
        .pixel-btn { background: #E5FF00; color: #000; border: none; padding: 14px; font-family: 'Press Start 2P', monospace; font-size: 11px; cursor: pointer; width: 100%; letter-spacing: 1px; box-shadow: 4px 4px 0 #888; transition: all 0.05s; }
        .pixel-btn:hover:not(:disabled) { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 #888; }
        .pixel-btn:active:not(:disabled) { transform: translate(4px, 4px); box-shadow: 0 0 0 #888; }
        .pixel-btn:disabled { background: #444; color: #888; cursor: not-allowed; box-shadow: 4px 4px 0 #222; }
        .pixel-link { background: transparent; border: none; color: #00E5FF; font-family: 'VT323', monospace; font-size: 16px; cursor: pointer; padding: 6px; text-decoration: underline; }
        .pixel-link:hover { color: #E5FF00; }
        .pixel-link-small { background: transparent; border: none; color: #888; font-family: 'VT323', monospace; font-size: 14px; cursor: pointer; padding: 4px; text-decoration: underline; }
        .pixel-link-small:hover { color: #00E5FF; }
        .heading { font-family: 'Press Start 2P', monospace; color: #E5FF00; text-shadow: 4px 4px 0 #888; }
        .pixel-label { font-family: 'Press Start 2P', monospace; font-size: 8px; color: #E5FF00; letter-spacing: 1px; margin-bottom: 6px; display: block; }
      `}</style>

      <div className="pixel-card" style={{ width: '100%', maxWidth: '440px', padding: '32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img src="/logo.jpeg" alt="logo" style={{ width: '88px', height: '88px', imageRendering: 'pixelated', border: '3px solid #E5FF00', marginBottom: '16px' }} />
          <h1 className="heading" style={{ margin: 0, fontSize: '20px' }}>DML FX</h1>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '8px', color: '#888', marginTop: '10px', letterSpacing: '2px' }}>◆ TRADING JOURNAL ◆</div>
          <div style={{ fontSize: '20px', color: '#00E5FF', marginTop: '14px' }}>
            {mode === 'signin' ? '> INSERT COIN' : mode === 'signup' ? '> NEW PLAYER' : '> RESET PASSWORD'}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {mode === 'signin' && (
            <>
              <div>
                <label className="pixel-label">EMAIL OR MT5 #</label>
                <input className="pixel-input" type="text" placeholder="EMAIL OR ACCOUNT #" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
              </div>
              <div>
                <label className="pixel-label">PASSWORD</label>
                <input className="pixel-input" type="password" placeholder="********" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} />
              </div>
            </>
          )}

          {mode === 'signup' && (
            <>
              <div>
                <label className="pixel-label">EMAIL</label>
                <input className="pixel-input" type="email" placeholder="YOUR@EMAIL.COM" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="pixel-label">MT5 ACCOUNT #</label>
                <input className="pixel-input" type="text" inputMode="numeric" placeholder="EG. 511047" value={mt5} onChange={(e) => setMt5(e.target.value)} />
              </div>
              <div>
                <label className="pixel-label">PASSWORD</label>
                <input className="pixel-input" type="password" placeholder="********" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} />
              </div>
            </>
          )}

          {mode === 'forgot' && (
            <div>
              <label className="pixel-label">EMAIL</label>
              <input className="pixel-input" type="email" placeholder="YOUR@EMAIL.COM" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} />
              <div style={{ fontSize: '13px', color: '#888', marginTop: '8px', lineHeight: 1.4 }}>
                {'>'} ENTER THE EMAIL ON YOUR ACCOUNT. WE WILL SEND A RESET LINK.
              </div>
            </div>
          )}

          {error && <div style={{ padding: '10px', background: '#330011', border: '2px solid #FF003C', color: '#FF003C', fontSize: '12px', fontFamily: "'Press Start 2P', monospace" }}>! {error}</div>}
          {message && <div style={{ padding: '10px', background: '#003311', border: '2px solid #39FF14', color: '#39FF14', fontSize: '12px', fontFamily: "'Press Start 2P', monospace" }}>✓ {message}</div>}

          <button className="pixel-btn" onClick={handleSubmit} disabled={loading}>
            {loading ? 'LOADING...' : mode === 'signin' ? 'PRESS START' : mode === 'signup' ? 'CREATE ACCOUNT' : 'SEND RESET LINK'}
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
            {mode === 'signin' && (
              <>
                <button className="pixel-link" onClick={() => switchMode('signup')}>{'>'} NO ACCOUNT? SIGN UP</button>
                <button className="pixel-link-small" onClick={() => switchMode('forgot')}>{'>'} FORGOT PASSWORD?</button>
              </>
            )}
            {mode === 'signup' && (
              <button className="pixel-link" onClick={() => switchMode('signin')}>{'>'} HAVE ACCOUNT? SIGN IN</button>
            )}
            {mode === 'forgot' && (
              <button className="pixel-link" onClick={() => switchMode('signin')}>{'>'} BACK TO LOGIN</button>
            )}
          </div>

          {mode === 'signup' && (
            <div style={{ fontSize: '13px', color: '#888', textAlign: 'center', padding: '8px', borderTop: '1px dashed #444', marginTop: '4px' }}>
              {'>'} MUST BE AIMS CLIENT VIA AFFILIATE LINK
            </div>
          )}
        </div>

        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px dashed #444', textAlign: 'center', fontSize: '11px', color: '#666', letterSpacing: '1px', lineHeight: 1.6 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '7px', color: '#888' }}>© 2025–2026 DML FX</div>
          <div style={{ marginTop: '4px' }}>ALL RIGHTS RESERVED</div>
          <div style={{ marginTop: '4px', color: '#444', fontSize: '10px' }}>v2.05 · BUILD #15</div>
        </div>
      </div>
    </div>
  );
}
