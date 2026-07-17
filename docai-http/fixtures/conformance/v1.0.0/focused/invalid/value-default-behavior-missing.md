# invalid: value default behavior missing

Expected: invalid complete conformance. An optional request field with server default behavior omits the caller-visible default semantics.

````markdown
#### Body

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"name":"Primary list","visibility":"private"}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| name | string | yes | no | Non-empty list name |
| visibility | string | no | no | `private` \| `team` |
````
