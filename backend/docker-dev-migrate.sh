#!/bin/sh
set -eu

expected_url='postgres://tch_dev:tch_dev_only@db:5432/tch_financials_dev'

if [ "${APP_ENV:-}" != 'development' ]; then
  echo 'Refusing migrations: APP_ENV must be development.' >&2
  exit 1
fi

if [ "${DATABASE_URL:-}" != "$expected_url" ]; then
  echo 'Refusing migrations: DATABASE_URL is not the isolated Docker development database.' >&2
  exit 1
fi

echo 'Running migrations against isolated Docker database tch_financials_dev...'
npm run migration:run
npm run seed:dev-users
