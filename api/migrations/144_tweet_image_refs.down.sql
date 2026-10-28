UPDATE tweets SET images = COALESCE((
    SELECT jsonb_agg(e.value->>'url' ORDER BY e.ord)
    FROM jsonb_array_elements(images) WITH ORDINALITY AS e(value, ord)
    WHERE e.value->>'url' IS NOT NULL
), '[]'::jsonb)
WHERE jsonb_typeof(images) = 'array' AND images <> '[]'::jsonb
  AND jsonb_typeof(images->0) = 'object';
