> docai-http: 0.11.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-09 | generation_id: compact-candidate-compact-20260709-001 | projection_id: compact-candidate-20260709-001 | source: fixtures/compact-candidate-openapi.yaml (OpenAPI 3.1.1) | source_revision: fixture-revision-compact-candidate-001 | x-fixture: compact-candidate

# API Conventions

## Environments

- Production: `https://api.example.test`

## Versioning

Use the `/v1` base path.

## Authentication

Send `Authorization: Bearer <access_token>` on every endpoint. Example tokens such as `test_token_123` are fake placeholders.

## Browser Security

none

## Request Formats

JSON request bodies use `Content-Type: application/json`.

## HTTP Semantics

Use standard HTTP retry rules unless an endpoint says otherwise.

## Errors

none

## Validation Errors

none

## Pagination

none

## List Operations

none

## Data Representation

IDs are opaque strings. Timestamps use RFC 3339 UTC strings.

## Empty and Omitted Values

Omitted optional request fields keep their server-defined default.

## File Transfer

none

## Rate Limits

none

## Webhook Delivery

none
