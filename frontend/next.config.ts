import path from 'node:path';
import type { NextConfig } from 'next';

const BACKEND = process.env.API_PROXY_TARGET ?? 'http://localhost:8000';

const config: NextConfig = {
	output: 'standalone',
	// Pin tracing root to this directory so the parent monorepo lockfile is ignored.
	outputFileTracingRoot: path.join(__dirname),
	// Keep trailing slashes so /api/<x>/ proxies straight through to Django (APPEND_SLASH).
	trailingSlash: true,
	async rewrites() {
		return [
			{
				source: '/api/:path*',
				destination: `${BACKEND}/api/:path*`
			}
		];
	}
};

export default config;
