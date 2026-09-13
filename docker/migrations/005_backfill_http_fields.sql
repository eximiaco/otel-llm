UPDATE log_embeddings
SET
  http_method = upper((regexp_match(content, 'http_request method=(\S+) route=(\S+) status=(\d+)', 'i'))[1]),
  route = (regexp_match(content, 'http_request method=(\S+) route=(\S+) status=(\d+)', 'i'))[2],
  status_code = ((regexp_match(content, 'http_request method=(\S+) route=(\S+) status=(\d+)', 'i'))[3])::int
WHERE http_method IS NULL
  AND content ~* 'http_request method=';
