# invalid: recursive schema truncated representation

Expected: invalid complete candidate. Recursive schemas are outside the intended 1.0 representable scope and must not be projected by truncating depth.

````markdown
### Response 200

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"node_01","children":[{"id":"node_02","children":[]}]}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | Node ID |
| children | object[] | always | no | Child nodes, truncated to one level |
| children[].id | string | always | no | Child node ID |
````
