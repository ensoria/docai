# invalid: common header suppression missing deviation

Expected: invalid complete candidate. A response suppresses a common response-header convention without a response-specific `**deviation**:`.

````markdown
## HTTP Semantics

Every response includes `X-Request-ID` and clients must log it with failures.

---

### Response 304

none

- Response Headers: none
````
