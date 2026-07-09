# valid: x- extension placement

Expected: valid `x-` metadata, table column, marker, and heading placement.

````markdown
> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-09 | generation_id: core-extension-20260709-001 | projection_id: core-extension-20260709-001 | source: fixtures/core-openapi.yaml (OpenAPI 3.1.1) | x-fixture: core-extension

## GET /users

Lists users.

### Behavior

- side_effects: none
- idempotency: idempotent and safe to retry
- preconditions: none
- authorization: `users:read` scope

### Request

- Path Parameters: none
- Query Parameters: none
- Headers: none
- Cookie Parameters: none
- Body: none

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"items":[]}
````

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| items | object[] | always | no | Users; array items reject additional properties |

#### Response Headers

| Name | Type | Presence | Meaning | x-owner |
|---|---|---|---|---|
| ETag | string | always | Collection validator | docs |

**x-audit**: internal review note; ignored by readers

### Errors

none

### Related

none

### x-Team Notes

Internal note that must not affect the calling contract.
```
