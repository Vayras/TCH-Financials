"""Django settings for the TCH Financials project."""

from pathlib import Path
from decouple import config, Csv
import os

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config('SECRET_KEY', default='dev-secret')
DEBUG = config('DEBUG', default=1, cast=int) == 1
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'tch',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    # Compress responses (JSON payloads shrink ~85-90%); must sit high in the
    # stack so it wraps everything below.
    'django.middleware.gzip.GZipMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# DATABASE_URL (e.g. a Supabase connection string) takes precedence; the
# discrete PG* / DB_* variables remain the fallback for the local docker DB.
# For Supabase use the *session* pooler URI and keep sslmode=require, e.g.
#   postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
DATABASE_URL = os.environ.get('DATABASE_URL', config('DATABASE_URL', default=''))

if DATABASE_URL:
    import dj_database_url

    # Use a small client-side psycopg pool rather than per-thread persistent
    # connections (conn_max_age): Supabase's session pooler caps clients at 15,
    # and one held connection per request thread exhausts that immediately
    # (FATAL: EMAXCONNSESSION). conn_max_age must stay 0 when pooling.
    # conn_health_checks pings each pooled connection at checkout — Supabase /
    # NAT silently drops idle TCP connections, and without the check the pool
    # hands a dead socket to the next request, which then 500s with
    # "SSL error: unexpected eof while reading".
    DATABASES = {
        'default': dj_database_url.parse(
            DATABASE_URL, conn_max_age=0, conn_health_checks=True
        )
    }
    DATABASES['default'].setdefault('OPTIONS', {})['pool'] = {
        'min_size': 1,
        'max_size': 4,   # × gunicorn workers (2) stays well under the 15-client cap
        'timeout': 20,
        'max_idle': 120,  # retire idle conns before the upstream kills them
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('PGDATABASE', config('DB_NAME', default='tch_financials')),
            'USER': os.environ.get('PGUSER', config('DB_USER', default='runner')),
            'PASSWORD': os.environ.get('PGPASSWORD', config('DB_PASSWORD', default='')),
            'HOST': os.environ.get('PGHOST', config('DB_HOST', default='localhost')),
            'PORT': os.environ.get('PGPORT', config('DB_PORT', default='5432')),
        }
    }

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'

MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Supabase Auth — when SUPABASE_URL (or the legacy SUPABASE_JWT_SECRET) is
# configured, every API endpoint requires a valid Supabase access token.
# Leave both unset to run the API open (local development without auth).
SUPABASE_URL = config('SUPABASE_URL', default='')
SUPABASE_JWT_SECRET = config('SUPABASE_JWT_SECRET', default='')

if SUPABASE_URL or SUPABASE_JWT_SECRET:
    REST_FRAMEWORK = {
        'DEFAULT_AUTHENTICATION_CLASSES': ['tch.auth.SupabaseJWTAuthentication'],
        'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
        'DEFAULT_PAGINATION_CLASS': None,
    }
else:
    REST_FRAMEWORK = {
        'DEFAULT_AUTHENTICATION_CLASSES': [],
        'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.AllowAny'],
        'DEFAULT_PAGINATION_CLASS': None,
    }

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
