# invalid: common response-header override missing deviation

Expected: invalid complete candidate. A response that changes a common response-header contract must put a `**deviation**:` in that response section.

````markdown
# API Conventions

## HTTP Semantics

| Name | Type | Presence | Meaning |
|---|---|---|---|
| ETag | string | always | Use as `If-None-Match` on subsequent reads |

---

### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"rpt_01K0COMPLETE"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | Report ID |

#### Response Headers

| Name | Type | Presence | Meaning |
|---|---|---|---|
| ETag | string | present when `include_etag=true` | Use as `If-None-Match` on subsequent reads |
````
