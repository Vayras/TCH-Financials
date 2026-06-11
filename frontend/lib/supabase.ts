import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// When the Supabase env vars are absent (e.g. bare local dev) the app runs
// without auth — mirroring the backend, which only enforces tokens when
// SUPABASE_URL is configured.
export function isSupabaseConfigured(): boolean {
	return Boolean(url && anonKey);
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
	if (!client) {
		if (!url || !anonKey) {
			throw new Error(
				'Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
			);
		}
		client = createClient(url, anonKey);
	}
	return client;
}
