-- Seed public spaces (NYC landmarks)
INSERT OR IGNORE INTO public_spaces (id, name, lng, lat, radius, description) VALUES
  -- Original landmarks
  ('met', 'The Metropolitan Museum of Art', -73.9632, 40.7794, 200, 'World-renowned art museum on Museum Mile'),
  ('times-square', 'Times Square', -73.9855, 40.7580, 200, 'The crossroads of the world'),
  ('central-park', 'Central Park', -73.9654, 40.7829, 200, 'NYC''s iconic urban park'),
  ('brooklyn-bridge', 'Brooklyn Bridge', -73.9969, 40.7061, 200, 'Historic suspension bridge'),
  ('statue-liberty', 'Statue of Liberty', -74.0445, 40.6892, 200, 'Symbol of freedom and democracy'),

  -- Manhattan landmarks
  ('empire-state', 'Empire State Building', -73.9857, 40.7484, 200, 'Iconic Art Deco skyscraper'),
  ('grand-central', 'Grand Central Terminal', -73.9772, 40.7527, 200, 'Historic train station and architectural marvel'),
  ('rockefeller', 'Rockefeller Center', -73.9787, 40.7587, 200, 'Famous complex with Top of the Rock'),
  ('washington-square', 'Washington Square Park', -73.9973, 40.7308, 200, 'Greenwich Village''s iconic park'),
  ('high-line', 'The High Line', -74.0048, 40.7480, 200, 'Elevated park on historic freight rail line'),
  ('chelsea-market', 'Chelsea Market', -74.0061, 40.7425, 200, 'Food hall in former Nabisco factory'),
  ('union-square', 'Union Square', -73.9903, 40.7359, 200, 'Historic public square and farmers market'),
  ('bryant-park', 'Bryant Park', -73.9832, 40.7536, 200, 'Midtown oasis behind NY Public Library'),
  ('madison-square', 'Madison Square Garden', -73.9934, 40.7505, 200, 'World-famous sports and entertainment arena'),
  ('flatiron', 'Flatiron Building', -73.9897, 40.7411, 200, 'Triangular Beaux-Arts landmark'),

  -- Brooklyn landmarks
  ('prospect-park', 'Prospect Park', -73.9690, 40.6602, 200, 'Brooklyn''s premier park designed by Olmsted'),
  ('coney-island', 'Coney Island', -73.9774, 40.5755, 200, 'Historic beachfront amusement area'),
  ('brooklyn-museum', 'Brooklyn Museum', -73.9636, 40.6712, 200, 'Major art museum in Prospect Heights'),
  ('dumbo', 'DUMBO', -73.9888, 40.7033, 200, 'Down Under Manhattan Bridge Overpass'),
  ('williamsburg', 'Williamsburg Waterfront', -73.9571, 40.7181, 200, 'Trendy Brooklyn neighborhood'),

  -- Queens landmarks
  ('flushing-meadows', 'Flushing Meadows Corona Park', -73.8448, 40.7400, 200, 'Site of two World''s Fairs'),
  ('astoria-park', 'Astoria Park', -73.9260, 40.7794, 200, 'Waterfront park with Hell Gate Bridge views'),
  ('moma-ps1', 'MoMA PS1', -73.9474, 40.7454, 200, 'Contemporary art institution in Long Island City'),

  -- Bronx landmarks
  ('yankee-stadium', 'Yankee Stadium', -73.9266, 40.8296, 200, 'Home of the New York Yankees'),
  ('bronx-zoo', 'Bronx Zoo', -73.8770, 40.8506, 200, 'One of the world''s largest zoos'),
  ('botanical-garden', 'NY Botanical Garden', -73.8785, 40.8626, 200, 'Historic botanical garden in the Bronx'),

  -- Staten Island landmarks
  ('staten-ferry', 'Staten Island Ferry Terminal', -74.0134, 40.6437, 200, 'Free ferry with Statue of Liberty views'),
  ('snug-harbor', 'Snug Harbor Cultural Center', -74.1031, 40.6437, 200, 'Cultural center and botanical garden');

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
  ('sol-collect-fish', 'statue-liberty', 'Harbor Fishing', 'Collect 25 Fish near Liberty Island', 'collect', '{"resource":"fish","amount":25}', 125),

-- Seed missions for Empire State Building
  ('empire-state-1', 'empire-state', 'Sky High Collector', 'Collect 8 resources in Midtown', 'collect', '{"resource":"any","amount":8}', 60),
  ('empire-state-2', 'empire-state', 'Art Deco Dreams', 'Place a building near the Empire State', 'build', '{"building":"any","amount":1}', 100),
  ('empire-state-3', 'empire-state', 'Midtown Explorer', 'Travel 500m from the Empire State Building', 'distance', '{"meters":500}', 75),

-- Seed missions for Grand Central Terminal
  ('grand-central-1', 'grand-central', 'Terminal Gatherer', 'Collect 6 resources at Grand Central', 'collect', '{"resource":"any","amount":6}', 55),
  ('grand-central-2', 'grand-central', 'Station Builder', 'Place 2 buildings near Grand Central', 'build', '{"building":"any","amount":2}', 120),
  ('grand-central-3', 'grand-central', 'Commuter Challenge', 'Travel 800m from Grand Central', 'distance', '{"meters":800}', 85),

-- Seed missions for Rockefeller Center
  ('rockefeller-1', 'rockefeller', 'Rock Center Resources', 'Collect 7 resources at Rockefeller Center', 'collect', '{"resource":"any","amount":7}', 60),
  ('rockefeller-2', 'rockefeller', 'Plaza Builder', 'Place a building at Rockefeller Plaza', 'build', '{"building":"any","amount":1}', 100),
  ('rockefeller-3', 'rockefeller', 'Midtown Trek', 'Travel 600m from Rockefeller Center', 'distance', '{"meters":600}', 80),

-- Seed missions for High Line
  ('high-line-1', 'high-line', 'Elevated Collector', 'Collect 5 resources on the High Line', 'collect', '{"resource":"any","amount":5}', 50),
  ('high-line-2', 'high-line', 'Park Walker', 'Walk 500m along the High Line', 'distance', '{"meters":500}', 75),
  ('high-line-3', 'high-line', 'Chelsea Developer', 'Place a building in Chelsea', 'build', '{"building":"any","amount":1}', 95),

-- Seed missions for Washington Square Park
  ('washington-square-1', 'washington-square', 'Village Gatherer', 'Collect 6 resources in Washington Square', 'collect', '{"resource":"any","amount":6}', 55),
  ('washington-square-2', 'washington-square', 'Arch Builder', 'Place a building near the arch', 'build', '{"building":"any","amount":1}', 90),
  ('washington-square-3', 'washington-square', 'Greenwich Explorer', 'Travel 700m from Washington Square', 'distance', '{"meters":700}', 70),

-- Seed missions for Prospect Park
  ('prospect-park-1', 'prospect-park', 'Brooklyn Green', 'Collect 10 resources in Prospect Park', 'collect', '{"resource":"any","amount":10}', 70),
  ('prospect-park-2', 'prospect-park', 'Park Builder', 'Place 2 buildings near the park', 'build', '{"building":"any","amount":2}', 110),
  ('prospect-park-3', 'prospect-park', 'Long Meadow Walk', 'Travel 1km in Prospect Park', 'distance', '{"meters":1000}', 90),

-- Seed missions for Coney Island
  ('coney-island-1', 'coney-island', 'Boardwalk Collector', 'Collect 8 resources on the boardwalk', 'collect', '{"resource":"any","amount":8}', 65),
  ('coney-island-2', 'coney-island', 'Beach Wanderer', 'Walk 1km along the beach', 'distance', '{"meters":1000}', 90),
  ('coney-island-3', 'coney-island', 'Seaside Builder', 'Place a building at Coney Island', 'build', '{"building":"any","amount":1}', 100),

-- Seed missions for Yankee Stadium
  ('yankee-stadium-1', 'yankee-stadium', 'Bronx Bomber', 'Collect 7 resources near the stadium', 'collect', '{"resource":"any","amount":7}', 60),
  ('yankee-stadium-2', 'yankee-stadium', 'Stadium Builder', 'Place a building in the Bronx', 'build', '{"building":"any","amount":1}', 95),
  ('yankee-stadium-3', 'yankee-stadium', 'Bronx Explorer', 'Travel 800m from Yankee Stadium', 'distance', '{"meters":800}', 80),

-- Seed missions for DUMBO
  ('dumbo-1', 'dumbo', 'Bridge View Collector', 'Collect 6 resources in DUMBO', 'collect', '{"resource":"any","amount":6}', 55),
  ('dumbo-2', 'dumbo', 'Waterfront Builder', 'Place a building in DUMBO', 'build', '{"building":"any","amount":1}', 90),
  ('dumbo-3', 'dumbo', 'Brooklyn Waterfront', 'Travel 600m along the waterfront', 'distance', '{"meters":600}', 70);

