> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: non-json-candidate-full-20260710-001 | projection_id: non-json-candidate-20260710-001 | source: fixtures/non-json-candidate-openapi.yaml (OpenAPI 3.1.1) | source_revision: fixture-revision-non-json-candidate-001 | x-fixture: non-json-candidate

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

JSON request bodies use `Content-Type: application/json`. Multipart requests use `multipart/form-data`; callers delegate boundary construction to the HTTP library unless an endpoint states otherwise.

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

IDs are opaque strings and must not be parsed by clients.

## Empty and Omitted Values

Omitted optional request fields keep their server-defined default.

## File Transfer

File uploads must use the part names, filename rules, content types, and size limits documented on each endpoint.

## Rate Limits

none

## Webhook Delivery

none
