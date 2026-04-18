import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars. Check .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export type Trade = {
  id?: string;
  user_id?: string;
  date: string;
  pair: string;
  direction: 'Long' | 'Short';
  entry?: number | string;
  exit?: number | string;
  stop_loss?: number | string;
  take_profit?: number | string;
  size?: number | string;
  pnl?: number | string;
  rr?: number | string;
  strategy?: string;
  emotion?: string;
  notes?: string;
  screenshot?: string;
  created_at?: string;
};

export type Profile = {
  id: string;
  email: string;
  mt5_account?: string;
  full_name?: string;
  is_admin: boolean;
  deposit_verified: boolean;
  deactivated?: boolean;
};

export type MonthlyCredit = {
  id: string;
  user_id: string;
  year_month: string;
  lots_this_month: number;
  gb_earned: number;
  mb_total: number;
  mb_used: number;
  admin_bonus_mb: number;
};

// Helper: lookup email by MT5 account number
export async function emailFromMT5(mt5: string): Promise<string | null> {
  const { data } = await supabase.from('profiles').select('email').eq('mt5_account', mt5).single();
  return data?.email || null;
}

// Helper: format MB nicely
export function formatData(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb} MB`;
}
