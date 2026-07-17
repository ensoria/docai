# valid: compact opaque webhook payload

Expected: valid complete conformance. A compact webhook payload uses `Client-visible fields` before `Opaque fields`, keeps the opaque root field, and omits opaque descendants.

````markdown
> docai-http: 1.0.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: conformance-compact-20260710-001 | projection_id: conformance-20260710-001 | source: fixtures/conformance/v1.0.0/source/complete-openapi.yaml (OpenAPI 3.1.1)

# payment.completed

## Headers

none

## Payload

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"event_id":"evt_01K0COMPLETE","metadata":{"processor_trace":"opaque-store-forward"}}
```

#### Client-visible fields

**field_defaults**: Presence=always | Nullable=no

| Field | Type | Meaning |
|---|---|---|
| event_id | string | Deduplication key |

#### Opaque fields

**field_defaults**: Presence=always | Nullable=no

| Field | Type | Meaning |
|---|---|---|
| metadata | object | Store or forward only; source annotation `x-docai-opaque` |
````
