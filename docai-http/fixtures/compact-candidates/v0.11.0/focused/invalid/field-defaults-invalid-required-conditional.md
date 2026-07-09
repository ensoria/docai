# invalid: field_defaults Required=conditional

Expected: invalid compact candidate. `Required=conditional` is not a valid field default because each affected row must retain its exact condition in `Constraints / Meaning`.

````markdown
> docai-http: 0.11.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-09 | generation_id: compact-candidate-compact-20260709-001 | projection_id: compact-candidate-20260709-001 | source: fixtures/compact-candidate-openapi.yaml (OpenAPI 3.1.1)

#### Body

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"email":"taro@example.com"}
```

**field_defaults**: Required=conditional | Nullable=no

| Field | Type | Constraints / Meaning |
|---|---|---|
| email | string | Required only when creating a password account |
````
