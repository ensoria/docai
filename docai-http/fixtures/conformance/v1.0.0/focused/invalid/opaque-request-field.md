# invalid: opaque request field

Expected: invalid complete conformance. Compact opaque-field reduction applies to response, error-shape, and webhook payload output, not request fields that client code must construct.

````markdown
> docai-http: 1.0.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-compact-20260721-rc2-001 | projection_id: conformance-20260721-rc2-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set)

## POST /documents

#### Body

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"metadata":{"title":"Q2 statement"}}
```

#### Client-visible fields

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| metadata | object | yes | no | Request metadata the client must construct |

#### Opaque fields

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| metadata.raw | object | no | no | Invalid request-side opaque reduction |
````
