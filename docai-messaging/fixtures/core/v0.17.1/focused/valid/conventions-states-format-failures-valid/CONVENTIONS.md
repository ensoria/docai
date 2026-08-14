> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: requires-source | knowledge: requires-input | source_refs: all

# Messaging Conventions

## Environments

none

## Protocols and Bindings

unknown
**unknown**: protocol versions require the broker configuration

## Authentication

**unsupported**: replaces CONVENTIONS Authentication: delegated credentials documented at source.json#/authentication

## Connection and Session

Clients reconnect with bounded exponential backoff.

## Serialization

none

## Message Envelope

none

## Delivery Semantics

none

## Idempotency and Deduplication

none

## Ordering

none

## Error Handling

Common failure signals are defined below.

**message_shape**: dead-letter

- Headers: none
- Bindings: none
#### Payload

none

**message_shape**: encoded-common

**unsupported**: replaces failure shape encoded-common: encoded common failure source.json#/failures/common

## Request-Reply

none

## Schema Evolution

none

## Data Representation

| Format | Role | Meaning |
|---|---|---|
| "uuid" | constraint | Accept canonical UUID strings and construct and validate them without narrowing. |

## Empty and Omitted Values

none

## Rate Limits and Quotas

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
