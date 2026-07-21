# valid: request same_as with resource-file retrieval unit

Expected: valid complete conformance. The compact resource file declares `x-retrieval-unit: resource-file`, defines a request body first, and later uses the canonical Request `**same_as**:` grammar as a same-kind backward reference.

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
````

