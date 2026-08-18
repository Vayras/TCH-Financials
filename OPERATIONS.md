# Operations, alerts, and incident response

## Health and readiness

- `GET /api/health/live` confirms the Node process is responding.
- `GET /api/health/ready` confirms PostgreSQL is reachable and migrations are current.
- `GET /api/health` is the compatibility alias for readiness.

The load balancer should use readiness; the process supervisor can use liveness.

## Logs and correlation

API requests emit one-line JSON with timestamp, severity, request ID, method,
path without query parameters, status, duration and actor identifiers. Bodies,
tokens, passwords and file contents are excluded. Support should ask users for
the `X-Request-ID` response header when investigating errors.

## Operational alerts

Set `ALERT_WEBHOOK_URL` to an approved HTTPS webhook to receive privacy-safe
notifications for API 5xx responses. The webhook payload contains request
metadata only. Independently monitor:

- readiness failures for two consecutive checks;
- repeated 5xx errors;
- service restarts/crash loops;
- backup job failure or missing daily backup;
- disk use for media and backups;
- database connection saturation and slow requests;
- authentication failure spikes.

Business alerts shown inside the product—overdue invoices, payments, creator
health, renewals and seasonal signals—are separate from these infrastructure
alerts.

## Audit records

Super Admins can read paginated `GET /api/audit-logs`. Records identify the
actor, request, route, resource ID, status and changed field names. They do not
store field values. Audit-write failures produce a structured error and should
trigger log-based escalation; they do not cause a successfully committed
financial action to be retried by the user.

## Incident priorities

- P0: suspected data loss/corruption or credential compromise—stop writes,
  preserve logs, involve the business owner, and do not restore without approval.
- P1: authentication bypass, private-file exposure, widespread write failure—
  enable maintenance mode and roll back the application release.
- P2: partial feature failure or elevated errors—retain service, investigate by
  request ID, and schedule a reviewed fix.

Use [PHASE_3_4_READINESS.md](PHASE_3_4_READINESS.md) for backup/deployment gates
and rollback. Database restore is a last resort because it discards writes made
after the backup.

