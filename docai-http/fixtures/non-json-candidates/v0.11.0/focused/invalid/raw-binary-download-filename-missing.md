# invalid: raw binary download filename missing

Expected: invalid non-JSON candidate. Raw binary downloads must state how the filename is obtained.

````markdown
### Response 200

**body_presence**: always

**media_type**: image/png

```http
Content-Type: image/png
Content-Length: 524288
Digest: sha-256=47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=

<binary PNG bytes, maximum 2097152 bytes>
```

Maximum size is 2097152 bytes. Verify the `Digest` header against the exact response body bytes using SHA-256 before storing the file.

#### Response Headers

| Name | Type | Presence | Meaning |
|---|---|---|---|
| Content-Length | int | always | Exact response body size in bytes; maximum is 2097152 |
| Digest | string | always | `sha-256=<base64>` over the exact response body bytes; verify before storing |
````
