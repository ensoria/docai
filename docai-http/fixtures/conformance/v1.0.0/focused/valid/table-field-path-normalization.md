# valid: table escaping and field-path normalization

Expected: valid complete conformance. Table cells escape literal pipes, field paths escape literal dots and pipes, and object openness is explicit.

````markdown
#### Body

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"metadata":{"campaign.code|source":"spring"},"role":"member"}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | object | yes | no | Additional properties forbidden |
| metadata | object | no | no | Additional properties forbidden |
| metadata.campaign\.code\|source | string | no | no | Source field name contains a literal dot and pipe |
| role | string | no | no | `admin` \| `member` |
````
