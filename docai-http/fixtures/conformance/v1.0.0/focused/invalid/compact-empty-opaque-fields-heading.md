# invalid: empty compact Opaque fields heading

Expected: invalid complete conformance. When no opaque root field exists, compact output omits the `Opaque fields` heading entirely instead of emitting an empty heading.

````markdown
> docai-http: 1.0.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-compact-20260721-rc3-001 | projection_id: conformance-20260721-rc3-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set)

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01K0COMPLETE","email":"ada@example.test","role":"member"}
```

#### Client-visible fields

**field_defaults**: Presence=always | Nullable=no

| Field | Type | Meaning |
|---|---|---|
| id | string | User ID |
| email | string | Email address |
| role | string | `admin` \| `member` |

#### Opaque fields

none
````
