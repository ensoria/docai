# valid: value omission, empty, null, and defaults

Expected: valid complete conformance. Omission, empty strings, empty arrays, explicit null, and server defaults are distinguished.

````markdown
#### Body

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"name":"Primary list","description":"","tags":[],"expires_at":null}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| name | string | yes | no | Non-empty list name |
| description | string | no | no | Omitted means unchanged; empty string clears the description |
| tags | string[] | no | no | Omitted means unchanged; empty array removes all tags; non-empty array replaces all tags |
| expires_at | string | no | yes | Omitted means default retention; explicit `null` disables expiration; non-null values use RFC 3339 |
| visibility | string | no | no | Omitted defaults to `private`; allowed values `private` and `team` |
````
