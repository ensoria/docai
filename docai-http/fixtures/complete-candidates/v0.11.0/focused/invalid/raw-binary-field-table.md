# invalid: raw binary field table

Expected: invalid complete candidate. Raw binary bodies omit `body_nullable` and do not use a decoded field table; they use a representative sample and prose.

````markdown
#### Body

**body_required**: yes

**media_type**: image/png

**body_nullable**: no

```http
Content-Type: image/png
Content-Length: 524288

<binary PNG bytes, maximum 2097152 bytes>
```

The request body is raw binary PNG bytes with no multipart wrapper. Maximum size is 2097152 bytes.

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | file | yes | no | Raw PNG bytes |
````
