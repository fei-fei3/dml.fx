'use client';

import { useState, useEffect } from 'react';
import { supabase, type Profile } from '@/lib/supabase';
import FXJournal from '@/components/FXJournal';
import AuthScreen from '@/components/AuthScreen';
import AdminPanel from '@/components/AdminPanel';

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'app' | 'admin'>('app');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadProfile(data.session.user.id);
      else setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data);
    setLoading(false);
  };

  if (loading) return <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E5FF00', fontFamily: "'Press Start 2P', monospace", fontSize: '14px' }}>LOADING...</div>;

  if (!session) return <AuthScreen />;

  if (view === 'admin' && profile?.is_admin) {
    return <AdminPanel onExit={() => setView('app')} />;
  }

  return <FXJournal user={session.user} profile={profile} onSignOut={() => supabase.auth.signOut()} onAdmin={profile?.is_admin ? () => setView('admin') : undefined} />;
}
