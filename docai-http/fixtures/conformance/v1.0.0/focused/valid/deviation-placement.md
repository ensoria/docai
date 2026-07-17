# valid: deviation placement in affected sections

Expected: valid complete conformance. Deviations from CONVENTIONS.md are written inside the section they affect, including parameter, body, response, and webhook payload sections.

````markdown
### Request

#### Query Parameters

**deviation**: this endpoint uses semicolon-delimited `filter` values instead of the default comma delimiter.

| Name | Type | Required | Constraints / Meaning |
|---|---|---|---|
| filter | string[] | no | Semicolon-delimited values; encoded example `filter=active;invited` |

#### Body

**deviation**: this body allows additional top-level string properties, unlike the API-wide closed-object default.

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"name":"Ada","nickname":"ace"}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | object | yes | no | Additional top-level string properties allowed |
| name | string | yes | no | Display name |

### Response 200

**deviation**: this response omits the common `X-Request-ID` header because it is served from an edge cache.

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"id":"usr_01K0COMPLETE"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| id | string | always | no | User ID |

- Response Headers: none

# user.updated

## Payload

**deviation**: this webhook payload includes `delivery_attempt` even though ordinary response bodies do not expose delivery metadata.

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"event_id":"evt_01K0COMPLETE","delivery_attempt":2}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| event_id | string | always | no | Deduplication key |
| delivery_attempt | int | always | no | Delivery attempt number for this webhook event |
````
