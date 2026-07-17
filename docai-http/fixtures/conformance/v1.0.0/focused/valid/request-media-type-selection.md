# valid: request media-type selection

Expected: valid complete conformance. A request body with multiple concrete representations repeats the representation markers and states how the caller selects the request media type.

````markdown
#### Body

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"q":"quarterly statement","include_archived":false}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| q | string | yes | no | Search query; empty string rejected |
| include_archived | bool | no | no | Defaults to `false` when omitted |

**media_type**: application/x-www-form-urlencoded;charset=UTF-8

**body_nullable**: no

```http
Content-Type: application/x-www-form-urlencoded; charset=UTF-8

q=quarterly+statement&include_archived=false
```

Encode the form body as UTF-8 before percent-encoding. Encode spaces as `+`.

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| q | string | yes | no | Form field `q`; encode as UTF-8 before percent-encoding; spaces use `+`; empty string rejected |
| include_archived | bool | no | no | Form field `include_archived`; allowed values are `true` and `false`; defaults to `false` when omitted |

The caller selects the request representation by setting `Content-Type` to either `application/json` or `application/x-www-form-urlencoded;charset=UTF-8`; both forms create the same logical search request.
````
