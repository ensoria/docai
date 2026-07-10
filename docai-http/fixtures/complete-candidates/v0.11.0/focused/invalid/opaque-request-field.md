# invalid: opaque request field

Expected: invalid complete candidate. Compact opaque-field reduction applies to response, error-shape, and webhook payload output, not request fields that client code must construct.

````markdown
> docai-http: 0.11.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: complete-candidate-compact-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.11.0/source/complete-openapi.yaml (OpenAPI 3.1.1)

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
