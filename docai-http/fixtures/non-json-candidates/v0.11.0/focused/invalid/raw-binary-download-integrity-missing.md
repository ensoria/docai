# invalid: raw binary download integrity missing

Expected: invalid non-JSON candidate. Raw binary downloads must include integrity metadata.

````markdown
### Response 200

**body_presence**: always

**media_type**: image/png

```http
Content-Type: image/png
Content-Disposition: attachment; filename="avatar.png"
Content-Length: 524288

<binary PNG bytes, maximum 2097152 bytes>
```

Filename is obtained from the `Content-Disposition` header. Maximum size is 2097152 bytes.

#### Response Headers

| Name | Type | Presence | Meaning |
|---|---|---|---|
| Content-Disposition | string | always | Attachment filename for the image, such as `avatar.png` |
| Content-Length | int | always | Exact response body size in bytes; maximum is 2097152 |
````
