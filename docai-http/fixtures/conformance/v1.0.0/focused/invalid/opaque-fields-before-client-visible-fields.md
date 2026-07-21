# invalid: Opaque fields before Client-visible fields

Expected: invalid complete conformance. In a compact response, error-shape, or webhook payload representation, `Client-visible fields` must appear before `Opaque fields`.

````markdown
> docai-http: 1.0.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-compact-20260721-rc3-001 | projection_id: conformance-20260721-rc3-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set)

# payment.completed

## Payload

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"event_id":"evt_01K0COMPLETE","metadata":{"processor_trace":"opaque-store-forward"}}
```

#### Opaque fields

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| metadata | object | always | no | Store or forward only |

#### Client-visible fields

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| event_id | string | always | no | Deduplication key |
````
