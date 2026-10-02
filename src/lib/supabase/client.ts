'use client';
import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';

export const createClient = () => createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
