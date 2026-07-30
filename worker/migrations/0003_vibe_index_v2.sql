-- Register the normalized Vibe Index v2 without mixing it with legacy unbounded scores.
UPDATE scoring_versions SET is_current = 0 WHERE is_current = 1;

INSERT INTO scoring_versions (version, label, description, released_at, is_current)
VALUES (
  'v2',
  'Vibe Index v2',
  'Normalized 0-100 score, capped evidence categories, same-author timing, merge exclusion',
  unixepoch(),
  1
)
ON CONFLICT(version) DO UPDATE SET
  label = excluded.label,
  description = excluded.description,
  is_current = 1;
