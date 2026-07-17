# valid: field_defaults reconstruction

Expected: valid complete conformance. A compact response field table omits uniform `Presence` and `Nullable` columns, and readers reconstruct those logical columns before applying field-table rules.

````markdown
> docai-http: 1.0.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: conformance-compact-20260710-001 | projection_id: conformance-20260710-001 | source: fixtures/conformance/v1.0.0/source/complete-openapi.yaml (OpenAPI 3.1.1)

## GET /payments/{id}

Gets one payment by ID.

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"pay_01K0COMPLETE","status":"captured","amount":"42.00"}
```

**field_defaults**: Presence=always | Nullable=no

| Field | Type | Meaning |
|---|---|---|
| $ | object | Additional properties forbidden |
| id | string | Payment ID |
| status | string | `authorized` or `captured` |
| amount | string | Decimal amount in account currency |
````
