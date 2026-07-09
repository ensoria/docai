> docai-http: 0.11.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-09 | generation_id: compact-candidate-compact-20260709-001 | projection_id: compact-candidate-20260709-001 | source: fixtures/compact-candidate-openapi.yaml (OpenAPI 3.1.1) | source_revision: fixture-revision-compact-candidate-001 | x-fixture: compact-candidate

## POST /users

Creates a user record.

### Behavior

- side_effects: creates a user record
- idempotency: not idempotent
- preconditions: email is unique
- authorization: authenticated user with `users:write`

### Request

- Path Parameters: none
- Query Parameters: none
- Headers: none
- Cookie Parameters: none

#### Body

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"email":"taro@example.com","name":"Taro Yamada"}
```

**field_defaults**: Nullable=no

| Field | Type | Required | Constraints / Meaning |
|---|---|---|---|
| $ | object | yes | Additional properties forbidden |
| email | string | yes | RFC 5322 email address; unique across all tenants |
| name | string | yes | 1-100 characters |
| role | string | no | `admin` \| `member`. Defaults to `member` when omitted |

### Response 201

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01K0COMPACT","email":"taro@example.com","name":"Taro Yamada","role":"member","created_at":"2026-07-09T03:00:00Z"}
```

**field_defaults**: Presence=always | Nullable=no

| Field | Type | Meaning |
|---|---|---|
| $ | object | Additional properties forbidden |
| id | string | Opaque user ID; use in later API calls |
| email | string | User email address |
| name | string | User display name |
| role | string | `admin` or `member` |
| created_at | string | RFC 3339 creation timestamp |

#### Response Headers

**field_defaults**: Presence=always

| Name | Type | Meaning |
|---|---|---|
| Location | string | URL of the created user, such as `/users/usr_01K0COMPACT` |

### Errors

none

### Related

none
