# valid: localized unsupported smallest unit

Expected: valid complete conformance. A localized `unsupported` marker follows the smallest affected field table and does not replace or begin a response representation.

````markdown
> docai-http: 1.0.0 | profile: full | coverage: requires-source | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-full-20260721-rc2-001 | projection_id: conformance-20260721-rc2-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set)

## GET /payments/{id}

Gets one payment by ID.

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"pay_01K0COMPLETE","metadata":{"processor_trace":"opaque-store-forward"}}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| id | string | always | no | Payment ID |
| metadata | object | conditional | no | Store or forward only |

**unsupported**: localized: `metadata` may contain provider-specific dynamic nested keys whose finite field paths are not representable at fixtures/conformance/v1.0.0/source/complete-openapi.yaml#/components/schemas/Payment/properties/metadata
````
