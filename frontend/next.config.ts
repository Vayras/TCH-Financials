import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
	output: 'standalone',
	// Pin tracing root to this directory so the parent monorepo lockfile is ignored.
	outputFileTracingRoot: path.join(__dirname),
	trailingSlash: true
};

export default config;
