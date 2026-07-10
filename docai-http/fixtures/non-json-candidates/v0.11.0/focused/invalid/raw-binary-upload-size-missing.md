# invalid: raw binary upload size missing

Expected: invalid non-JSON candidate. Raw binary uploads must state size metadata.

````markdown
#### Headers

| Name | Required | Type | Constraints / Meaning |
|---|---|---|---|
| Digest | yes | string | `sha-256=<base64>` over the exact body bytes; single field line only; not comma-combinable; order not significant; example `Digest: sha-256=47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=` |

#### Body

**body_required**: yes

**media_type**: image/png

```http
Content-Type: image/png
Digest: sha-256=47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=

<binary PNG bytes>
```

The request body is raw binary PNG bytes with no multipart wrapper. Calculate the `Digest` header from the exact body bytes using SHA-256 before upload.
````
