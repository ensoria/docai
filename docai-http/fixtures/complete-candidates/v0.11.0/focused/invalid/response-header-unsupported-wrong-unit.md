# invalid: response-header unsupported wrong unit

Expected: invalid complete candidate. A response-header block replacement must name `Response Headers`, not a larger or unrelated unit.

````markdown
### Response 201

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01K0COMPLETE"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | User ID |

#### Response Headers

**unsupported**: replaces Response 201: response includes dynamic caller-relevant `X-Audit-*` headers that cannot be enumerated at fixtures/complete-candidates/v0.11.0/source/complete-openapi.yaml#/paths/~1users/post/responses/201/headers
````
