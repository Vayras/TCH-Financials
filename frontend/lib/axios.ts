import axios from 'axios';
import { getSupabase, isSupabaseConfigured } from './supabase';

export class ConflictError extends Error {
	current?: unknown;
	constructor(message: string, current?: unknown) {
		super(message);
		this.name = 'ConflictError';
		this.current = current;
	}
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '/api';

export const httpClient = axios.create({
	baseURL: API_BASE,
});

// Request Interceptor: Automatically inject Bearer auth token if configured
httpClient.interceptors.request.use(async (config) => {
	if (isSupabaseConfigured()) {
		const { data } = await getSupabase().auth.getSession();
		const token = data.session?.access_token;
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
	}
	return config;
});

// Response Interceptor: Handle global HTTP errors (401, 409, etc.)
httpClient.interceptors.response.use(
	(response) => response,
	(error) => {
		if (axios.isAxiosError(error) && error.response) {
			const status = error.response.status;
			if (status === 401 && isSupabaseConfigured() && typeof window !== 'undefined') {
				// Don't loop redirect if already on login or auth pages
				const path = window.location.pathname;
				if (!['/login', '/signup', '/set-password', '/auth/callback'].includes(path)) {
					window.location.assign('/login');
				}
			}
			if (status === 409) {
				const body = error.response.data;
				let detail = 'Someone else updated this record while you were editing. Reload and re-apply your change.';
				let current: unknown;
				if (typeof body?.detail === 'string') detail = body.detail;
				current = body?.current;
				return Promise.reject(new ConflictError(detail, current));
			}

			const detail = error.response.data?.message || error.response.data?.detail || error.message;
			return Promise.reject(new Error(`${status} ${error.response.statusText}: ${detail}`));
		}
		return Promise.reject(error);
	}
);
