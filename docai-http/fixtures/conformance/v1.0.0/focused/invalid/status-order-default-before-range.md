# invalid: status default before range

Expected: invalid complete conformance. `default` response sections must appear after exact statuses and literal status ranges.

````markdown
### Response 200

none

- Response Headers: none

### Response default

none

- Response Headers: none

### Response 4XX

none

- Response Headers: none
````
