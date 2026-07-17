> docai-http: 1.0.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: conformance-compact-20260710-001 | projection_id: conformance-20260710-001 | source: fixtures/conformance/v1.0.0/source/complete-openapi.yaml (OpenAPI 3.1.1) | source_revision: fixture-revision-conformance-001 | x-fixture: stable-conformance

# API Conventions

## Environments

- Production: `https://api.example.test`
- Sandbox: `https://sandbox.api.example.test`

## Versioning

Use the `/v1` base path in the selected environment.

## Authentication

Send `Authorization: Bearer <access_token>` on every endpoint. Example tokens such as `test_token_123` are fake placeholders.

## Browser Security

none

## Request Formats

JSON request bodies use `Content-Type: application/json`. Clients send `Accept: application/json` when they expect a JSON response.

## HTTP Semantics

Clients may send `X-Request-ID` as an opaque string for request tracing. When a response includes `X-Request-ID`, log it with any client-side error report.

## Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 401 | token_expired | standard-error | Access token has expired | Refresh once, then retry once |
| 403 | forbidden | standard-error | Credential lacks permission | Do not retry with the same credential |
| 500 | server_error | standard-error | Unexpected server failure | Retry with backoff only when the request is safe to retry |

**error_shape**: standard-error

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"error":{"code":"token_expired","message":"access token expired"}}
```

**field_defaults**: Presence=always | Nullable=no

| Field | Type | Meaning |
|---|---|---|
| $ | object | Additional properties forbidden |
| error | object | Error envelope; additional properties forbidden |
| error.code | string | Machine-readable error code |
| error.message | string | Developer-facing message; do not display directly to users |

- Response Headers: none

## Validation Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 422 | validation_failed | validation-error | Request validation failed | Show field-level errors when present. Do not retry unchanged input |

**error_shape**: validation-error

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"error":{"code":"validation_failed","message":"input is invalid","field_errors":[{"field":"name","code":"too_long","message":"name is too long"}]}}
```

**field_defaults**: Presence=always | Nullable=no

| Field | Type | Meaning |
|---|---|---|
| $ | object | Additional properties forbidden |
| error | object | Error envelope; additional properties forbidden |
| error.code | string | Always `validation_failed` |
| error.message | string | Developer-facing summary; do not display directly to users |
| error.field_errors | object[] | Field-level validation failures; array items reject additional properties |
| error.field_errors[].field | string | Request field targeted by the error |
| error.field_errors[].code | string | Machine-readable validation code |
| error.field_errors[].message | string | Safe to display next to the target field |

- Response Headers: none

## Pagination

none

## List Operations

none

## Data Representation

- IDs are opaque strings and must not be parsed by clients.
- Timestamps use RFC 3339 UTC strings.
- Root JSON objects reject additional properties unless a field table states otherwise.

## Empty and Omitted Values

Omitted optional request fields keep their server-defined default or existing value. Send `null` only for fields whose row has `Nullable=yes`.

## File Transfer

For multipart uploads, delegate boundary generation to the HTTP library. Do not hard-code sample boundary tokens.

## Rate Limits

none

## Webhook Delivery

Webhook deliveries are at least once and unordered. Receivers must deduplicate by the documented event ID and return a 2xx response within 5 seconds.
