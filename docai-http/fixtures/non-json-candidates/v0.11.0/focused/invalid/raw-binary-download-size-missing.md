# invalid: raw binary download size missing

Expected: invalid non-JSON candidate. Raw binary downloads must state size metadata.

````markdown
### Response 200

**body_presence**: always

**media_type**: image/png

```http
Content-Type: image/png
Content-Disposition: attachment; filename="avatar.png"
Digest: sha-256=47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=

<binary PNG bytes>
```

Filename is obtained from the `Content-Disposition` header. Verify the `Digest` header against the exact response body bytes using SHA-256 before storing the file.

#### Response Headers

| Name | Type | Presence | Meaning |
|---|---|---|---|
| Content-Disposition | string | always | Attachment filename for the image, such as `avatar.png` |
| Digest | string | always | `sha-256=<base64>` over the exact response body bytes; verify before storing |
````
