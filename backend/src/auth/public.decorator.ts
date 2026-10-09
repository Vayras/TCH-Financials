import { SetMetadata } from '@nestjs/common';

// Separate from SkipAuth, which allows pending users but still requires a session.
export const PUBLIC_ROUTE_KEY = 'publicRoute';
export const PublicRoute = () => SetMetadata(PUBLIC_ROUTE_KEY, true);
