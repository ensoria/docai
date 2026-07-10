# invalid: raw binary upload body_nullable present

Expected: invalid non-JSON candidate. Raw binary uploads use `body_required` and `media_type`, but do not use `body_nullable`.

````markdown
#### Headers

| Name | Required | Type | Constraints / Meaning |
|---|---|---|---|
| Digest | yes | string | `sha-256=<base64>` over the exact body bytes; single field line only; not comma-combinable; order not significant; example `Digest: sha-256=47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=` |

#### Body

**body_required**: yes

**media_type**: image/png

**body_nullable**: no

```http
Content-Type: image/png
Content-Length: 524288
Digest: sha-256=47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=

<binary PNG bytes, maximum 2097152 bytes>
```

The request body is raw binary PNG bytes with no multipart wrapper. Maximum size is 2097152 bytes. Calculate the `Digest` header from the exact body bytes using SHA-256 before upload.
````
