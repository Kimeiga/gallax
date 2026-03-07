-- Seed public spaces (NYC landmarks)
INSERT OR IGNORE INTO public_spaces (id, name, lng, lat, radius, description) VALUES
  ('met', 'The Metropolitan Museum of Art', -73.9632, 40.7794, 50, 'World-renowned art museum on Museum Mile'),
  ('times-square', 'Times Square', -73.9855, 40.7580, 50, 'The crossroads of the world'),
  ('central-park', 'Central Park', -73.9654, 40.7829, 100, 'NYC''s iconic urban park'),
  ('brooklyn-bridge', 'Brooklyn Bridge', -73.9969, 40.7061, 50, 'Historic suspension bridge'),
  ('statue-liberty', 'Statue of Liberty', -74.0445, 40.6892, 50, 'Symbol of freedom and democracy');

-- Seed missions for The Met
INSERT OR IGNORE INTO missions (id, space_id, title, description, type, objective, reward_coins) VALUES
  ('met-collect-wood', 'met', 'Museum Woodwork', 'Collect 10 Wood near The Met', 'collect', '{"resource":"wood","amount":10}', 50),
  ('met-visit', 'met', 'Cultural Visit', 'Visit The Metropolitan Museum', 'visit', '{"location":"met"}', 25),
  ('met-build', 'met', 'Museum District', 'Place a building near The Met', 'build', '{"count":1}', 100);

-- Seed missions for Times Square
INSERT OR IGNORE INTO missions (id, space_id, title, description, type, objective, reward_coins) VALUES
  ('ts-visit', 'times-square', 'Bright Lights', 'Visit Times Square', 'visit', '{"location":"times-square"}', 25),
  ('ts-collect-stone', 'times-square', 'Urban Resources', 'Collect 15 Stone in Times Square', 'collect', '{"resource":"stone","amount":15}', 75),
  ('ts-social', 'times-square', 'Meet the Crowd', 'Chat with 3 players at Times Square', 'social', '{"chats":3}', 75);

-- Seed missions for Central Park
INSERT OR IGNORE INTO missions (id, space_id, title, description, type, objective, reward_coins) VALUES
  ('cp-visit', 'central-park', 'Park Stroll', 'Visit Central Park', 'visit', '{"location":"central-park"}', 25),
  ('cp-collect-herbs', 'central-park', 'Herbal Gathering', 'Collect 20 Herbs in Central Park', 'collect', '{"resource":"herbs","amount":20}', 100),
  ('cp-build', 'central-park', 'Park Development', 'Place 2 buildings in Central Park', 'build', '{"count":2}', 150);

-- Seed missions for Brooklyn Bridge
INSERT OR IGNORE INTO missions (id, space_id, title, description, type, objective, reward_coins) VALUES
  ('bb-visit', 'brooklyn-bridge', 'Bridge Walk', 'Visit Brooklyn Bridge', 'visit', '{"location":"brooklyn-bridge"}', 25),
  ('bb-distance', 'brooklyn-bridge', 'Bridge Explorer', 'Travel 500m from Brooklyn Bridge', 'distance', '{"meters":500}', 60),
  ('bb-collect-iron', 'brooklyn-bridge', 'Steel Beams', 'Collect 10 Iron near the bridge', 'collect', '{"resource":"iron","amount":10}', 80);

-- Seed missions for Statue of Liberty
INSERT OR IGNORE INTO missions (id, space_id, title, description, type, objective, reward_coins) VALUES
  ('sol-visit', 'statue-liberty', 'Liberty Island', 'Visit the Statue of Liberty', 'visit', '{"location":"statue-liberty"}', 25),
  ('sol-distance', 'statue-liberty', 'Harbor Journey', 'Travel 1000m from Liberty Island', 'distance', '{"meters":1000}', 100),
  ('sol-collect-fish', 'statue-liberty', 'Harbor Fishing', 'Collect 25 Fish near Liberty Island', 'collect', '{"resource":"fish","amount":25}', 125);

