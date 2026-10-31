import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

// 1. Client Browser (Akses publik dengan RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 2. Server Admin Client (Hanya berjalan di Serverless Vercel API, TIDAK diekspos ke client)
export function getSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key';
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// 3. Utilitas Hashing Token Perangkat (SHA-256 dengan Salt)
export function hashDeviceToken(token: string): string {
  const salt = process.env.DEVICE_TOKEN_SECRET_SALT || 'mewbot_c3_default_salt';
  return crypto.createHash('sha256').update(token + salt).digest('hex');
}
