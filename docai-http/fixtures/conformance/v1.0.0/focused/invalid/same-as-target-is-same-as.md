# invalid: same_as target is another same_as

Expected: invalid complete conformance. A `**same_as**:` target must be a full earlier representation and must not be another `**same_as**:` line.

````markdown
> docai-http: 1.0.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-compact-20260721-rc2-002 | projection_id: conformance-20260721-rc2-002 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set) | source_revision: fixture-input-set-rc2-002 | x-retrieval-unit: resource-file

## POST /users

### Request

#### Body

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"email":"taro@example.com"}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| email | string | yes | no | RFC 5322 email address |

## POST /user-imports

### Request

#### Body

**body_required**: yes

**same_as**: POST /users Request application/json

## POST /user-copies

### Request

#### Body

**body_required**: yes

**same_as**: POST /user-imports Request application/json
````

