# invalid: redirect missing Location header

Expected: invalid complete conformance. A redirect response omits the required caller-visible `Location` header contract.

````markdown
### Response 302

none

- Response Headers: none

Client follows the redirect manually.
````
