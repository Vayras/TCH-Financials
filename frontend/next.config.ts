import path from 'node:path';
import type { NextConfig } from 'next';

// The app calls same-origin /api (see lib/api.ts); proxy it to the NestJS
// backend. Override in deployments where the API lives elsewhere.
const API_TARGET = process.env.API_PROXY_TARGET ?? 'http://localhost:8000';

const config: NextConfig = {
	// Pin tracing root to this directory so the parent monorepo lockfile is ignored.
	outputFileTracingRoot: path.join(__dirname),
	trailingSlash: true,
	async rewrites() {
		return [
			{ source: '/api/:path*', destination: `${API_TARGET}/api/:path*` }
		];
	}
};

export default config;
