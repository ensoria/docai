# invalid: field_defaults Presence on request body

Expected: invalid compact candidate. `Presence` defaults apply to response body-field, error-shape body-field, webhook payload, and response-header tables; request body-field tables use `Required`.

````markdown
> docai-http: 0.11.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-09 | generation_id: compact-candidate-compact-20260709-001 | projection_id: compact-candidate-20260709-001 | source: fixtures/compact-candidate-openapi.yaml (OpenAPI 3.1.1)

#### Body

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"email":"taro@example.com"}
```

**field_defaults**: Presence=always | Nullable=no

| Field | Type | Constraints / Meaning |
|---|---|---|
| email | string | RFC 5322 email address |
````
