// Sign-in entry points. Creators and the TCH team (admins, managers,
// accounts) sign in on separate pages; AuthGuard still routes by role.
export const TEAM_SIGN_IN = '/login';
export const TEAM_SIGN_UP = '/signup';
export const CREATOR_SIGN_IN = '/creator/login';
export const CREATOR_SIGN_UP = '/creator/signup';

const PUBLIC_AUTH_ROUTES = new Set([
  TEAM_SIGN_IN,
  TEAM_SIGN_UP,
  CREATOR_SIGN_IN,
  CREATOR_SIGN_UP,
  '/set-password',
  '/auth/callback',
]);

// next.config uses trailingSlash, so window.location.pathname ends in "/".
export function normalizePath(path: string) {
  return path.replace(/\/+$/, '') || '/';
}

export function isPublicAuthRoute(path: string) {
  return PUBLIC_AUTH_ROUTES.has(normalizePath(path));
}

// Where to send someone who isn't signed in, based on what they were viewing.
export function signInPathFor(path: string) {
  const p = normalizePath(path);
  return p.startsWith('/creator-portal') || p.startsWith('/creator/')
    ? CREATOR_SIGN_IN
    : TEAM_SIGN_IN;
}

export function signInPathForRole(role: string | null | undefined) {
  return role === 'creator' ? CREATOR_SIGN_IN : TEAM_SIGN_IN;
}
