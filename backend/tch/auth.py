"""Supabase JWT authentication for the API.

The frontend signs users in with Supabase Auth (GoTrue) and sends the
session's access token as `Authorization: Bearer <jwt>`. We verify the token
signature against the project's public JWKS (ES256/RS256 signing keys) — no
shared secret needed. Projects still on the legacy symmetric scheme can set
SUPABASE_JWT_SECRET instead and we verify with HS256.
"""

from __future__ import annotations

import threading

import jwt
from jwt import PyJWKClient
from django.conf import settings
from rest_framework import authentication, exceptions


class SupabaseUser:
    """Lightweight request.user for a verified Supabase identity.

    Not a Django auth.User row — API users live in Supabase, not in our DB.
    """

    is_authenticated = True
    is_anonymous = False
    is_active = True
    is_staff = False
    is_superuser = False

    def __init__(self, claims: dict):
        self.claims = claims
        self.id = claims.get('sub', '')
        self.pk = self.id
        self.email = claims.get('email', '')
        self.username = self.email or self.id

    def __str__(self) -> str:
        return self.username


_jwks_lock = threading.Lock()
_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    with _jwks_lock:
        if _jwks_client is None:
            _jwks_client = PyJWKClient(
                f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json",
                cache_keys=True,
                lifespan=3600,
            )
        return _jwks_client


class SupabaseJWTAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        header = request.headers.get('Authorization', '')
        if not header.startswith('Bearer '):
            return None
        token = header[len('Bearer '):].strip()
        try:
            if settings.SUPABASE_JWT_SECRET:
                claims = jwt.decode(
                    token,
                    settings.SUPABASE_JWT_SECRET,
                    algorithms=['HS256'],
                    audience='authenticated',
                )
            else:
                signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
                claims = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=['ES256', 'RS256'],
                    audience='authenticated',
                )
        except jwt.PyJWTError as exc:
            raise exceptions.AuthenticationFailed(f'Invalid or expired token: {exc}')
        return (SupabaseUser(claims), token)

    def authenticate_header(self, request):
        return 'Bearer'
