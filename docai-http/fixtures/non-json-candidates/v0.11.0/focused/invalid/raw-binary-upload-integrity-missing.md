# invalid: raw binary upload integrity missing

Expected: invalid non-JSON candidate. Raw binary uploads must include integrity metadata.

````markdown
#### Headers

none

#### Body

**body_required**: yes

**media_type**: image/png

```http
Content-Type: image/png
Content-Length: 524288

<binary PNG bytes, maximum 2097152 bytes>
```

The request body is raw binary PNG bytes with no multipart wrapper. Maximum size is 2097152 bytes.
````
