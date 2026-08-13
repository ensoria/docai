> docai-messaging: 0.17.1 | profile: full | perspective: storefront-service | coverage: complete | knowledge: complete | source_refs: all

# Messaging Conventions

## Environments

Use the `production` server at `broker.example.invalid:9092` for this corpus scenario.

## Protocols and Bindings

Use Kafka protocol version `3.6.0`. Kafka record headers encode each logical header as one UTF-8 value, and clients expose logical headers by their documented names.

## Authentication

Use the `storefrontOAuth` OAuth2 client-credentials scheme. Obtain a token from `https://auth.example.invalid/oauth/token` with the operation-specific scope, and acquire a replacement token before the current token expires.

## Connection and Session

Reconnect with bounded exponential backoff from 100 milliseconds to 10 seconds. Stop publishing while no authenticated broker session is available.

## Serialization

Use UTF-8 JSON with media type `application/json`. Schemas are fully projected inline; clients do not perform runtime schema lookup.

## Message Envelope

Use `message-id` as the message identifier, `correlation-id` as the correlation identifier, and `reply-to` as the reply address.

## Delivery Semantics

Delivery is at-least-once. A redelivery retains the original `message-id`. Acknowledge only after durable processing commits; negative-acknowledge a delivery after a retryable handler failure. Unacknowledged deliveries become eligible for redelivery after 30 seconds.

## Idempotency and Deduplication

Deduplicate by `header.message-id` for 24 hours per storefront tenant.

## Ordering

Messages sharing `payload.orderId` are processed in publish order. There is no ordering guarantee across distinct `orderId` values.

## Error Handling

Negative-acknowledge retryable failures and reject non-retryable failures. After five delivery attempts, publish the failed envelope and diagnostic code to `orders.dead-letter`.

## Request-Reply

Replies use `orders.replies`. The reply `correlation-id` equals the command `correlation-id`. Wait 5 seconds for a reply; if no acceptance reply arrives, the command outcome is unknown to the caller.

## Schema Evolution

Additive optional fields are backward compatible. Removing or changing a required field requires a new contract version. The logical API is `urn:example:storefront-order-messaging`, and this corpus projects contract version `1.0.0`.

## Data Representation

| Format | Role | Meaning |
|---|---|---|
| "date-time" | constraint | An RFC 3339 date-time string with an explicit offset. |

## Empty and Omitted Values

All documented payload and header values are non-null. Only fields not listed as required may be omitted.

## Rate Limits and Quotas

none

> docai-identity: set_id: b32:qe5xz6fyhcs6horpuskeaw57ay | projection_id: b32:2su6l5snggpayed76bebjwuzuy
