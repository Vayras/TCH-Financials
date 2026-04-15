import type { Handle } from '@sveltejs/kit';

const BACKEND = 'http://localhost:8000';

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/api')) {
		const backendUrl = `${BACKEND}${event.url.pathname}${event.url.search}`;
		const res = await fetch(backendUrl, {
			method: event.request.method,
			headers: event.request.headers,
			body: event.request.method !== 'GET' && event.request.method !== 'HEAD'
				? await event.request.text()
				: undefined,
		});

		return new Response(res.body, {
			status: res.status,
			statusText: res.statusText,
			headers: res.headers,
		});
	}

	return resolve(event);
};
