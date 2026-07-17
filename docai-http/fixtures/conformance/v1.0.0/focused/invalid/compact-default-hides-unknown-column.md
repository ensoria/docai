# invalid: compact default hides unknown column

Expected: invalid complete conformance. A compact `field_defaults` marker defaults a column whose logical rows include an unknown value.

````markdown
> docai-http: 1.0.0 | profile: compact | coverage: complete | knowledge: requires-input | generated: 2026-07-10 | generation_id: conformance-compact-20260710-001 | projection_id: conformance-20260710-001 | source: fixtures/conformance/v1.0.0/source/complete-openapi.yaml (OpenAPI 3.1.1)

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01K0COMPLETE","display_name":"Taro Yamada"}
```

**field_defaults**: Presence=always | Nullable=no

| Field | Type | Meaning |
|---|---|---|
| id | string | User ID |
| display_name | string | Presence is actually unknown in the source schema |

**unknown**: response field presence for `display_name` is absent from authoritative input; this column must not be defaulted
````
