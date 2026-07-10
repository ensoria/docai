> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: webhook-candidate-full-20260710-001 | projection_id: webhook-candidate-20260710-001 | source: fixtures/webhook-candidate-openapi.yaml (OpenAPI 3.1.1) | source_revision: fixture-revision-webhook-candidate-001 | x-fixture: webhook-candidate

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

Use standard HTTP retry rules unless an endpoint or webhook says otherwise.

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

none

## Rate Limits

none

## Webhook Delivery

Verify the `X-Webhook-Signature` header with the configured webhook secret before processing the payload. Return any 2xx status within 5 seconds to acknowledge delivery. Deliveries are at-least-once, may arrive out of order, and are retried up to 5 attempts with exponential backoff unless a webhook file states a deviation. Deduplicate by the event identifier or composite strategy named in the webhook payload table.
