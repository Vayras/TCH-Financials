# TrioSphere Creator Import Design

## Goal

Replace Bright Data as the source for TCH creator Instagram imports with the existing TrioSphere `profile-lookup` API while preserving TCH's queued import experience and saved snapshot format.

## Scope

- Use `GET https://api.triosphere.site/v1/profile-lookup?username=<handle>&posts=true` from the TCH backend only.
- Import profile fields and at most the 12 newest media items returned by the endpoint.
- Keep TCH's database-backed queue, per-account serialization, idempotency, cooldown, creator/global request limits, and snapshot/brand-kit storage model. Add a database-backed global cap of 20 TrioSphere requests per hour per token so bursts stay below the provider's 30-fresh-lookups/hour quota.
- Keep imports paused by default. Enabling imports requires a server-side TrioSphere token and an explicit enable setting.
- Keep admin screens and their snapshot consumers unchanged.
- Disable the TCH `load more` action. The public lookup endpoint has no cursor or pagination contract; CICO's separate in-app Meta cursor flow is not part of this integration.

## Out of scope

- Modifying the CICO project or adding pagination to its public API.
- Replacing the queue with synchronous calls from TCH web requests.
- Importing personal/private Instagram accounts, reels/video assets, or media binaries.
- Removing unrelated Bright Data code or configuration outside creator social imports.

## Architecture and data flow

1. The creator portal continues to enqueue an import using the existing TCH endpoint and idempotency key.
2. The social worker claims a job and performs one TrioSphere GET using the stored username. The TrioSphere token is sent only in the backend `Authorization: Bearer` header.
3. The worker validates the response identity against the requested username, normalizes the profile and returned media into TCH's existing JSON snapshot shape, and writes one snapshot.
4. TCH kit and admin consumers continue reading the same snapshot tables and normalized keys; they do not call TrioSphere.

No TrioSphere request is made in the browser or in the creator-facing enqueue request. GET requests are safe to retry after a timeout because the endpoint is read-only; the worker keeps its lease and bounded retry/backoff behavior.

## Provider contract and normalization

The response fields are mapped as follows:

| TrioSphere | TCH snapshot |
|---|---|
| `username` | `profile.username` |
| `name` | `profile.display_name` |
| `biography` | `profile.biography` |
| `followersCount` | `profile.followers` |
| `followsCount` | `profile.following` |
| `mediaCount` | `profile.posts_count` |
| `profilePictureUrl` | `profile.image_url` |
| `media[].id` | `posts[].platform_post_id` |
| `media[].caption` | `posts[].caption` |
| `media[].mediaType` | `posts[].content_type` (`IMAGE` → `Image`, `VIDEO` → `Video`, `CAROUSEL_ALBUM` → `Carousel`) |
| `media[].permalink` | `posts[].url` |
| `media[].mediaUrl` / `thumbnailUrl` | `posts[].image_url`, preferring `thumbnailUrl` then `mediaUrl` |
| `media[].timestamp` | `posts[].published_at` in ISO format |
| `media[].likeCount` / `commentsCount` | `posts[].likes` / `posts[].comments` |

The API does not return a stable Instagram account ID. Username equality is therefore the provider identity check. Do not fabricate a numeric account ID; when comparing snapshots, rely on normalized username if the provider response has no account ID. Post IDs must remain numeric strings to satisfy TCH's existing featured-post references.

Only HTTPS Instagram profile/permalink URLs and Instagram/Facebook CDN media URLs are stored, using the existing URL allowlist. API values are untrusted: bound string lengths, reject malformed payloads, deduplicate media by ID, and cap normalized media at 12. Store the snapshot source as `triosphere`; preserve the API `source` (`meta`, `cache`, or `catalog`) and valid `fetchedAt` in coverage metadata. Invalid/missing `fetchedAt` falls back to TCH collection time.

If `media` is null or omitted (for example, a catalog-only response), update profile details but preserve the last known posts when one exists; for a first import, store an empty post list. TrioSphere image/video URLs expire after a few days, so they are display references only; TCH must not download or proxy the media, and refreshes replace them with the latest returned URLs.

## Job behavior and compatibility

- A normal import, kit creation, and insight update each use one provider request and produce one completed snapshot.
- New snapshots contain no more than the 12 media items returned by TrioSphere. Prior snapshots remain intact for existing kit references.
- `load more` is unavailable because this API has no pagination. The creator UI should not offer the action; the existing route should return a clear conflict response for old clients and must not enqueue or charge a request.
- Bright Data snapshot reconciliation is removed from the TCH creator-social operations API. There is no upstream snapshot ID to reconcile.
- Existing Bright Data active jobs must not be processed as TrioSphere calls during rollout. Before starting the new worker, mark legacy active jobs failed with a migration-specific error code. Keep historical completed snapshots and import rows.
- Retain legacy Bright Data-only database columns in this change to avoid destructive cleanup; new code must not use them to dispatch or reconcile jobs. New snapshot writes explicitly set `source='triosphere'`.

## Configuration and rollout

- Replace creator-social Bright Data environment settings with `TRIOSPHERE_API_TOKEN`, `TRIOSPHERE_IMPORTS_ENABLED`, and the existing `CREATOR_SOCIAL_IMPORTS_PAUSED` kill switch.
- The TrioSphere token is server-only, must never appear in client bundles, API responses, or logs, and must be excluded from repository files.
- Imports remain paused by default. The worker should exit cleanly while paused; the API should continue serving saved snapshots and kits.
- Before production enablement, confirm that the token's agreed purpose permits TCH's creator workflow, including displaying creator-selected posts in TCH brand kits. The CICO API documentation restricts redistribution to third parties; until the intended use is explicitly permitted, leave provider imports paused.

## Failure handling and limits

- Keep the TCH queue, cooldowns, and daily caps as the first admission control. Add a global hourly cap of 20 requests per token, counted under the existing database admission lock, so multiple API replicas cannot burst past TrioSphere's documented 30 fresh lookups per hour. Keep the existing per-creator and global daily caps; the provider also documents 30 requests per minute and 2,000 requests per day per token.
- Honor `Retry-After` for 429 responses. Retry transient network errors and 502/504 with bounded backoff. Treat invalid/revoked token (401/403), invalid username (400), and missing/ineligible account (404) as non-retryable job failures. Treat 409/424 as provider connection failures and surface a safe error for retry after operator/provider recovery.
- Do not log authorization headers, raw provider bodies, or signed media URLs. Return safe error codes through the existing import job status.
- Bound response reading (2 MiB maximum) and request time (20 seconds); reject redirects so credentials cannot be forwarded to another origin.
- A provider failure must not delete or partially overwrite the most recent successful snapshot.

## Validation

- Unit-test URL construction and server-only bearer auth, success/error status mapping, timeout/network failures, response-size enforcement, and redirect refusal.
- Unit-test profile/media mapping, identity mismatch, malformed IDs/URLs/dates/counts, duplicate media, maximum 12 posts, and null-media preservation behavior.
- Exercise the worker with a fake TrioSphere response to verify a single lookup creates one snapshot, keeps idempotent jobs safe under retries, and never calls Bright Data.
- Verify imports remain paused by default, saved snapshot reads still work while paused, and `load more` is rejected without enqueuing a job.
- Run backend tests/typecheck, frontend typecheck, Compose validation, and `git diff --check`.

## Decisions

- Provider: TrioSphere `profile-lookup` API, which uses Meta data upstream.
- Initial supported post history: the 12 newest media items.
- Queue: retain the TCH database worker.
- Pagination: unavailable in TCH until the public API exposes a cursor contract.
- Admin UI: no changes.
