# invalid: common response-header contract missing details

Expected: invalid complete candidate. A common caller-relevant response-header contract in `CONVENTIONS.md` must preserve the header name, type, presence, and meaning instead of only mentioning the header in prose.

````markdown
# API Conventions

## HTTP Semantics

Every response includes `X-Request-ID`; clients must log it with failures.

---

## GET /reports/{id}

Gets one report.

### Response 200

none

- Response Headers: none
````
