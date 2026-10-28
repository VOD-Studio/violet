UPDATE tweets SET images = COALESCE((
    SELECT jsonb_agg(jsonb_build_object('url', e.value, 'width', f.width, 'height', f.height) ORDER BY e.ord)
    FROM jsonb_array_elements_text(images) WITH ORDINALITY AS e(value, ord)
    LEFT JOIN files f ON f.url = e.value
), '[]'::jsonb)
WHERE jsonb_typeof(images) = 'array' AND images <> '[]'::jsonb;
