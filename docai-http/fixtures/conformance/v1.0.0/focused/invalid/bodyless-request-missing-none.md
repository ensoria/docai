# invalid: bodyless request missing none

Expected: invalid complete conformance. A body-less request does not explicitly collapse the Body subsection to `none`.

````markdown
## DELETE /sessions/{id}

### Request

- Path Parameters:

| Name | Type | Constraints / Meaning |
|---|---|---|
| id | string | Session ID |

- Query Parameters: none
- Headers: none
- Cookie Parameters: none

### Response 204

none
````
