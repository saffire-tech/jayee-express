INSERT INTO delivery_zones (name, min_distance_km, max_distance_km, fee, is_active) VALUES
  ('Near (0-3 km)', 0, 3, 5, true),
  ('Short (3-7 km)', 3, 7, 10, true),
  ('Medium (7-15 km)', 7, 15, 18, true),
  ('Far (15-30 km)', 15, 30, 30, true),
  ('Very Far (30-60 km)', 30, 60, 50, true);