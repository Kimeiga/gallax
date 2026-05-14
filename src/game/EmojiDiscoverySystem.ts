// Emoji Discovery System - contextual emoji collection mechanic
// Every emoji is used for its REAL meaning, especially Japanese character emojis

export type EmojiCategory =
  | 'nature' | 'marine' | 'food' | 'buildings' | 'transport'
  | 'tools' | 'japanese' | 'celestial' | 'creatures'
  | 'music' | 'sports' | 'hearts' | 'mystical' | 'symbols';

export type EmojiRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface EmojiEntry {
  emoji: string;
  name: string;
  meaning: string;
  category: EmojiCategory;
  rarity: EmojiRarity;
  gameUse: string; // How this emoji functions in the game
  discoveredAt?: number;
}

const RARITY_XP: Record<EmojiRarity, number> = {
  common: 5,
  uncommon: 15,
  rare: 40,
  epic: 100,
  legendary: 250,
};

const RARITY_COLORS: Record<EmojiRarity, string> = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

// Master emoji catalog - every emoji has contextual meaning
export const EMOJI_CATALOG: EmojiEntry[] = [
  // === JAPANESE CHARACTER EMOJIS (used for their actual kanji meanings) ===
  { emoji: '🈲', name: 'Prohibit', meaning: '禁 (kin) - Forbidden, restricted', category: 'japanese', rarity: 'rare', gameUse: 'Marks locked/restricted zones on the map' },
  { emoji: '🈳', name: 'Vacant', meaning: '空 (kuu) - Empty, vacant', category: 'japanese', rarity: 'rare', gameUse: 'Indicates empty building plots available to claim' },
  { emoji: '🈴', name: 'Passing', meaning: '合 (gou) - Pass, agree, unite', category: 'japanese', rarity: 'rare', gameUse: 'Quest completion stamp - you passed!' },
  { emoji: '🈵', name: 'Full', meaning: '満 (man) - Full capacity', category: 'japanese', rarity: 'rare', gameUse: 'Indicates inventory slot is at max capacity' },
  { emoji: '🈶', name: 'Paid', meaning: '有 (yuu) - To have, not free', category: 'japanese', rarity: 'rare', gameUse: 'Premium items in shops that cost coins' },
  { emoji: '🈷️', name: 'Monthly', meaning: '月 (getsu) - Moon, month', category: 'japanese', rarity: 'rare', gameUse: 'Monthly special events and rewards' },
  { emoji: '🈸', name: 'Apply', meaning: '申 (shin) - Application, request', category: 'japanese', rarity: 'rare', gameUse: 'Mission application button' },
  { emoji: '🈹', name: 'Discount', meaning: '割 (wari) - Cut price, bargain', category: 'japanese', rarity: 'epic', gameUse: 'Shop discounts - reduced building costs' },
  { emoji: '🈺', name: 'Open', meaning: '営 (ei) - Open for business', category: 'japanese', rarity: 'rare', gameUse: 'Indicates shops and buildings are active' },
  { emoji: '🈚', name: 'Free', meaning: '無 (mu) - Nothing, without cost', category: 'japanese', rarity: 'epic', gameUse: 'Free item drops - costs nothing!' },
  { emoji: '🈯', name: 'Reserved', meaning: '予 (yo) - Reserved in advance', category: 'japanese', rarity: 'rare', gameUse: 'Territory claimed by another player' },
  { emoji: '🉐', name: 'Bargain', meaning: '得 (toku) - Profit, advantage', category: 'japanese', rarity: 'epic', gameUse: 'Rare loot drop - extra valuable finds' },
  { emoji: '🉑', name: 'Acceptable', meaning: '可 (ka) - Approved, OK', category: 'japanese', rarity: 'rare', gameUse: 'Quest accepted confirmation' },
  { emoji: '㊗️', name: 'Congratulations', meaning: '祝 (iwai) - Celebrate', category: 'japanese', rarity: 'epic', gameUse: 'Level up celebration effect' },
  { emoji: '㊙️', name: 'Secret', meaning: '秘 (himitsu) - Secret, hidden', category: 'japanese', rarity: 'legendary', gameUse: 'Secret areas with hidden treasures' },
  { emoji: '🔰', name: 'Beginner', meaning: 'Shoshinsha mark - new driver badge in Japan', category: 'japanese', rarity: 'uncommon', gameUse: 'New player tutorial indicator' },
  { emoji: '💮', name: 'Well Done', meaning: 'White flower stamp teachers use for excellent work', category: 'japanese', rarity: 'rare', gameUse: 'Achievement completion grade stamp' },
  { emoji: '🆖', name: 'No Good', meaning: 'NG - Japanese entertainment term for a failed take', category: 'japanese', rarity: 'uncommon', gameUse: 'Failed crafting or mission attempt' },
  { emoji: '🈁', name: 'Here', meaning: 'ここ (koko) - Here, this place', category: 'japanese', rarity: 'rare', gameUse: 'Map marker for points of interest' },
  { emoji: '🎌', name: 'Celebration', meaning: 'Crossed flags - national celebration', category: 'japanese', rarity: 'rare', gameUse: 'Special event marker' },
  { emoji: '🎎', name: 'Dolls Festival', meaning: 'Hinamatsuri dolls - Girls Day festival', category: 'japanese', rarity: 'epic', gameUse: 'Seasonal event collectible' },
  { emoji: '🎏', name: 'Carp Streamer', meaning: 'Koinobori - Childrens Day celebration', category: 'japanese', rarity: 'epic', gameUse: 'Craftable decoration for buildings' },
  { emoji: '🎐', name: 'Wind Chime', meaning: 'Furin - Japanese summer wind chime', category: 'japanese', rarity: 'rare', gameUse: 'Craftable decoration, plays ambient sound' },
  { emoji: '🎴', name: 'Flower Cards', meaning: 'Hanafuda - traditional Japanese card game', category: 'japanese', rarity: 'epic', gameUse: 'Collectible cards found near shrines' },
  { emoji: '🀄', name: 'Mahjong Dragon', meaning: 'Chun tile - red dragon in mahjong', category: 'japanese', rarity: 'epic', gameUse: 'Rare collectible tile' },

  // === MYSTICAL / PROTECTIVE EMOJIS ===
  { emoji: '🧿', name: 'Nazar', meaning: 'Turkish/Greek evil eye amulet against bad luck', category: 'mystical', rarity: 'epic', gameUse: 'Protection ward - shields buildings from events' },
  { emoji: '🪬', name: 'Hamsa', meaning: 'Hand of Fatima - Middle Eastern protective talisman', category: 'mystical', rarity: 'epic', gameUse: 'Blessing buff - increased XP for 10 minutes' },
  { emoji: '🔮', name: 'Crystal Ball', meaning: 'Fortune telling and divination', category: 'mystical', rarity: 'rare', gameUse: 'Reveals hidden resources on the map' },
  { emoji: '⚗️', name: 'Alembic', meaning: 'Ancient alchemy distillation apparatus', category: 'mystical', rarity: 'rare', gameUse: 'Crafting station - combine resources' },
  { emoji: '📿', name: 'Prayer Beads', meaning: 'Buddhist/Hindu prayer meditation beads', category: 'mystical', rarity: 'rare', gameUse: 'Meditation - doubles herb gathering' },
  { emoji: '🪷', name: 'Lotus', meaning: 'Sacred in Buddhism - purity from muddy water', category: 'mystical', rarity: 'epic', gameUse: 'Rare water plant - high XP when found' },
  { emoji: '☯️', name: 'Yin Yang', meaning: 'Taoism - balance and duality', category: 'mystical', rarity: 'legendary', gameUse: 'Balances all resources to equal amounts' },
  { emoji: '🕉️', name: 'Om', meaning: 'Sacred sound in Hinduism/Buddhism/Jainism', category: 'mystical', rarity: 'legendary', gameUse: 'Ultimate meditation - massive XP boost' },
  { emoji: '☮️', name: 'Peace', meaning: 'Peace symbol - anti-war movement', category: 'mystical', rarity: 'rare', gameUse: 'Peaceful zone marker - no hostile events' },
  { emoji: '⚜️', name: 'Fleur-de-lis', meaning: 'French heraldic lily, scouting symbol', category: 'mystical', rarity: 'rare', gameUse: 'Explorer badge - reveals nearby discoveries' },
  { emoji: '🔱', name: 'Trident', meaning: 'Poseidon weapon - maritime authority', category: 'mystical', rarity: 'epic', gameUse: 'Sea mastery - double fish collection' },
  { emoji: '⚕️', name: 'Staff of Asclepius', meaning: 'Medical/healthcare symbol (single snake)', category: 'mystical', rarity: 'rare', gameUse: 'Healing - restores daily reward streak' },

  // === NATURE EMOJIS ===
  { emoji: '🌲', name: 'Evergreen', meaning: 'Coniferous tree - stays green year round', category: 'nature', rarity: 'common', gameUse: 'Wood resource source' },
  { emoji: '🌳', name: 'Deciduous Tree', meaning: 'Broadleaf tree that sheds leaves', category: 'nature', rarity: 'common', gameUse: 'Wood resource source' },
  { emoji: '🌴', name: 'Palm Tree', meaning: 'Tropical palm - warm climate indicator', category: 'nature', rarity: 'common', gameUse: 'Wood resource in tropical zones' },
  { emoji: '🌵', name: 'Cactus', meaning: 'Desert plant - stores water internally', category: 'nature', rarity: 'uncommon', gameUse: 'Rare herb source in dry areas' },
  { emoji: '🌿', name: 'Herb', meaning: 'Green herb - medicinal plant', category: 'nature', rarity: 'common', gameUse: 'Herb resource source' },
  { emoji: '🍀', name: 'Four Leaf Clover', meaning: 'Lucky charm - 1 in 10,000 clovers', category: 'nature', rarity: 'rare', gameUse: 'Luck boost - better loot for 5 minutes' },
  { emoji: '☘️', name: 'Shamrock', meaning: 'Three-leaf clover - symbol of Ireland', category: 'nature', rarity: 'common', gameUse: 'Common herb source' },
  { emoji: '🌱', name: 'Seedling', meaning: 'Young plant just sprouted', category: 'nature', rarity: 'common', gameUse: 'Herb resource, can grow into tree' },
  { emoji: '🌾', name: 'Rice Sheaf', meaning: 'Harvested rice - staple crop', category: 'nature', rarity: 'common', gameUse: 'Farm building ingredient' },
  { emoji: '🍃', name: 'Leaf in Wind', meaning: 'Leaf blown by the breeze', category: 'nature', rarity: 'common', gameUse: 'Herb resource' },
  { emoji: '🍂', name: 'Fallen Leaf', meaning: 'Autumn leaf - seasonal change', category: 'nature', rarity: 'uncommon', gameUse: 'Seasonal herb, appears in autumn weather' },
  { emoji: '🍁', name: 'Maple Leaf', meaning: 'Symbol of Canada, autumn foliage', category: 'nature', rarity: 'uncommon', gameUse: 'Seasonal collectible' },
  { emoji: '🌸', name: 'Cherry Blossom', meaning: 'Sakura - symbol of spring in Japan', category: 'nature', rarity: 'rare', gameUse: 'Craftable decoration, springtime bonus' },
  { emoji: '🌺', name: 'Hibiscus', meaning: 'Tropical flower - Hawaiian state flower', category: 'nature', rarity: 'uncommon', gameUse: 'Decorative herb' },
  { emoji: '🌻', name: 'Sunflower', meaning: 'Follows the sun - symbol of loyalty', category: 'nature', rarity: 'uncommon', gameUse: 'Decorative, boosts nearby farm output' },
  { emoji: '🌹', name: 'Rose', meaning: 'Symbol of love and beauty', category: 'nature', rarity: 'rare', gameUse: 'Gift item for NPCs' },
  { emoji: '🌷', name: 'Tulip', meaning: 'Dutch national flower', category: 'nature', rarity: 'uncommon', gameUse: 'Decorative herb' },
  { emoji: '🍄', name: 'Mushroom', meaning: 'Fungi - grows in damp dark places', category: 'nature', rarity: 'uncommon', gameUse: 'Rare herb found in shaded areas' },
  { emoji: '🪨', name: 'Rock', meaning: 'Solid stone formation', category: 'nature', rarity: 'common', gameUse: 'Stone resource source' },
  { emoji: '🪵', name: 'Wood', meaning: 'Cut lumber log', category: 'nature', rarity: 'common', gameUse: 'Wood resource' },

  // === MARINE EMOJIS ===
  { emoji: '🐟', name: 'Fish', meaning: 'Generic fish - freshwater or saltwater', category: 'marine', rarity: 'common', gameUse: 'Fish resource source' },
  { emoji: '🐠', name: 'Tropical Fish', meaning: 'Colorful reef fish', category: 'marine', rarity: 'uncommon', gameUse: 'Uncommon fish - extra XP' },
  { emoji: '🐡', name: 'Blowfish', meaning: 'Pufferfish - inflates when threatened', category: 'marine', rarity: 'uncommon', gameUse: 'Dangerous catch - high value' },
  { emoji: '🦈', name: 'Shark', meaning: 'Apex ocean predator', category: 'marine', rarity: 'rare', gameUse: 'Rare catch - massive XP' },
  { emoji: '🐳', name: 'Whale', meaning: 'Spouting whale - largest animal', category: 'marine', rarity: 'epic', gameUse: 'Epic sighting - huge XP bonus' },
  { emoji: '🐋', name: 'Humpback', meaning: 'Humpback whale - known for songs', category: 'marine', rarity: 'epic', gameUse: 'Epic sighting near harbors' },
  { emoji: '🐬', name: 'Dolphin', meaning: 'Intelligent marine mammal', category: 'marine', rarity: 'rare', gameUse: 'Lucky encounter - bonus fish spawns' },
  { emoji: '🦭', name: 'Seal', meaning: 'Pinniped - marine mammal', category: 'marine', rarity: 'rare', gameUse: 'Rare harbor sighting' },
  { emoji: '🐙', name: 'Octopus', meaning: 'Eight-armed cephalopod', category: 'marine', rarity: 'uncommon', gameUse: 'Deep water fish resource' },
  { emoji: '🦑', name: 'Squid', meaning: 'Ten-armed cephalopod', category: 'marine', rarity: 'uncommon', gameUse: 'Deep water fish resource' },
  { emoji: '🦞', name: 'Lobster', meaning: 'Crustacean delicacy', category: 'marine', rarity: 'rare', gameUse: 'High-value catch' },
  { emoji: '🦀', name: 'Crab', meaning: 'Decapod crustacean', category: 'marine', rarity: 'uncommon', gameUse: 'Shell resource source' },
  { emoji: '🦐', name: 'Shrimp', meaning: 'Small crustacean', category: 'marine', rarity: 'common', gameUse: 'Fish resource' },
  { emoji: '🐚', name: 'Shell', meaning: 'Spiral seashell', category: 'marine', rarity: 'common', gameUse: 'Shell resource source' },
  { emoji: '🪸', name: 'Coral', meaning: 'Marine invertebrate colony', category: 'marine', rarity: 'rare', gameUse: 'Rare underwater find' },
  { emoji: '🪼', name: 'Jellyfish', meaning: 'Gelatinous marine creature', category: 'marine', rarity: 'uncommon', gameUse: 'Danger in water - avoid!' },
  { emoji: '🦪', name: 'Oyster', meaning: 'Bivalve mollusk - may contain pearl', category: 'marine', rarity: 'rare', gameUse: 'Chance to find gem inside' },

  // === CREATURES ===
  { emoji: '🦊', name: 'Fox', meaning: 'Cunning canid - trickster in folklore', category: 'creatures', rarity: 'rare', gameUse: 'Park NPC - trades rare items' },
  { emoji: '🐿️', name: 'Chipmunk', meaning: 'Small striped rodent', category: 'creatures', rarity: 'common', gameUse: 'Park creature - drops herbs' },
  { emoji: '🦉', name: 'Owl', meaning: 'Nocturnal bird - symbol of wisdom', category: 'creatures', rarity: 'rare', gameUse: 'Night-only creature - gives hints' },
  { emoji: '🦅', name: 'Eagle', meaning: 'Bird of prey - freedom symbol', category: 'creatures', rarity: 'epic', gameUse: 'Reveals map area when spotted' },
  { emoji: '🦆', name: 'Duck', meaning: 'Waterfowl found in ponds', category: 'creatures', rarity: 'common', gameUse: 'Common park creature' },
  { emoji: '🦢', name: 'Swan', meaning: 'Elegant waterfowl - grace symbol', category: 'creatures', rarity: 'uncommon', gameUse: 'Lake creature - decorative' },
  { emoji: '🕊️', name: 'Dove', meaning: 'Peace bird - messenger', category: 'creatures', rarity: 'uncommon', gameUse: 'Delivers bonus messages' },
  { emoji: '🐦‍🔥', name: 'Phoenix', meaning: 'Mythical bird reborn from ashes', category: 'creatures', rarity: 'legendary', gameUse: 'Legendary - revives lost resources' },
  { emoji: '🦋', name: 'Butterfly', meaning: 'Transformation - metamorphosis', category: 'creatures', rarity: 'uncommon', gameUse: 'Found near flowers, bonus herb XP' },
  { emoji: '🐝', name: 'Honeybee', meaning: 'Pollinator - hive worker', category: 'creatures', rarity: 'common', gameUse: 'Near gardens, boosts farm buildings' },
  { emoji: '🐞', name: 'Ladybug', meaning: 'Good luck insect', category: 'creatures', rarity: 'uncommon', gameUse: 'Lucky find - small XP bonus' },
  { emoji: '🦄', name: 'Unicorn', meaning: 'Mythical horse - purity symbol', category: 'creatures', rarity: 'legendary', gameUse: 'Legendary - doubles all gathering for 10 min' },
  { emoji: '🐉', name: 'Dragon', meaning: 'Mythical serpent - power symbol', category: 'creatures', rarity: 'legendary', gameUse: 'Legendary - guards treasure hoards' },

  // === FOOD EMOJIS (NYC neighborhood themes) ===
  { emoji: '🍕', name: 'Pizza', meaning: 'Italian flatbread - NYC staple', category: 'food', rarity: 'common', gameUse: 'Found in Little Italy, restores energy' },
  { emoji: '🌭', name: 'Hot Dog', meaning: 'Street food - NYC icon', category: 'food', rarity: 'common', gameUse: 'Found at street vendor locations' },
  { emoji: '🥯', name: 'Bagel', meaning: 'Boiled bread ring - NYC breakfast', category: 'food', rarity: 'common', gameUse: 'Morning bonus item' },
  { emoji: '🍜', name: 'Ramen', meaning: 'Japanese noodle soup', category: 'food', rarity: 'uncommon', gameUse: 'Found in Chinatown area' },
  { emoji: '🍣', name: 'Sushi', meaning: 'Vinegared rice with fish', category: 'food', rarity: 'uncommon', gameUse: 'Found near water + commercial areas' },
  { emoji: '🍱', name: 'Bento', meaning: 'Japanese packed lunch box', category: 'food', rarity: 'rare', gameUse: 'Full meal - restores all daily bonuses' },
  { emoji: '🥟', name: 'Dumpling', meaning: 'Stuffed dough - many cultures', category: 'food', rarity: 'uncommon', gameUse: 'Found in cultural districts' },
  { emoji: '🌮', name: 'Taco', meaning: 'Mexican folded tortilla', category: 'food', rarity: 'common', gameUse: 'Found near food trucks' },
  { emoji: '🧆', name: 'Falafel', meaning: 'Middle Eastern chickpea fritter', category: 'food', rarity: 'uncommon', gameUse: 'Cultural district food' },
  { emoji: '🍩', name: 'Donut', meaning: 'Fried dough ring - police cliche', category: 'food', rarity: 'common', gameUse: 'Common street find' },
  { emoji: '☕', name: 'Coffee', meaning: 'Hot brewed beverage', category: 'food', rarity: 'common', gameUse: 'Speed boost for 2 minutes' },
  { emoji: '🍎', name: 'Red Apple', meaning: 'The Big Apple - NYC nickname', category: 'food', rarity: 'rare', gameUse: 'NYC icon - found at landmarks' },
  { emoji: '🍦', name: 'Ice Cream', meaning: 'Frozen dairy dessert', category: 'food', rarity: 'common', gameUse: 'Summer weather bonus item' },
  { emoji: '🧋', name: 'Bubble Tea', meaning: 'Taiwanese tea with tapioca pearls', category: 'food', rarity: 'uncommon', gameUse: 'Found in trendy neighborhoods' },

  // === BUILDING EMOJIS ===
  { emoji: '🏠', name: 'House', meaning: 'Residential home', category: 'buildings', rarity: 'common', gameUse: 'Basic craftable building' },
  { emoji: '🏢', name: 'Office', meaning: 'Commercial office building', category: 'buildings', rarity: 'uncommon', gameUse: 'Found in downtown districts' },
  { emoji: '🏦', name: 'Bank', meaning: 'Financial institution', category: 'buildings', rarity: 'uncommon', gameUse: 'Craftable - stores coins safely' },
  { emoji: '🏥', name: 'Hospital', meaning: 'Medical facility', category: 'buildings', rarity: 'uncommon', gameUse: 'Craftable civic building' },
  { emoji: '🏰', name: 'Castle', meaning: 'Fortified medieval residence', category: 'buildings', rarity: 'epic', gameUse: 'Luxury craftable building' },
  { emoji: '🗽', name: 'Statue of Liberty', meaning: 'Gift from France, NYC icon', category: 'buildings', rarity: 'legendary', gameUse: 'Ultimate NYC landmark' },
  { emoji: '🗿', name: 'Moai', meaning: 'Easter Island monolithic heads', category: 'buildings', rarity: 'epic', gameUse: 'Mysterious craftable monument' },

  // === TRANSPORT EMOJIS ===
  { emoji: '🚕', name: 'Taxi', meaning: 'Yellow cab - NYC icon', category: 'transport', rarity: 'common', gameUse: 'NYC taxi sighting' },
  { emoji: '🚇', name: 'Metro', meaning: 'Subway - underground rail', category: 'transport', rarity: 'common', gameUse: 'Subway station marker' },
  { emoji: '🚌', name: 'Bus', meaning: 'Public transit bus', category: 'transport', rarity: 'common', gameUse: 'Bus route entity' },
  { emoji: '🚂', name: 'Locomotive', meaning: 'Steam train engine', category: 'transport', rarity: 'uncommon', gameUse: 'Train track entity' },
  { emoji: '🚁', name: 'Helicopter', meaning: 'Rotorcraft aircraft', category: 'transport', rarity: 'rare', gameUse: 'Rare flyover - reveals map' },
  { emoji: '🚀', name: 'Rocket', meaning: 'Space launch vehicle', category: 'transport', rarity: 'epic', gameUse: 'Epic craftable building' },
  { emoji: '🚲', name: 'Bicycle', meaning: 'Human-powered two-wheeler', category: 'transport', rarity: 'common', gameUse: 'Found at bike stations' },

  // === CELESTIAL / WEATHER ===
  { emoji: '☀️', name: 'Sun', meaning: 'Our star - source of light', category: 'celestial', rarity: 'common', gameUse: 'Clear weather indicator' },
  { emoji: '🌙', name: 'Crescent Moon', meaning: 'Waxing/waning moon phase', category: 'celestial', rarity: 'uncommon', gameUse: 'Night time indicator' },
  { emoji: '⭐', name: 'Star', meaning: 'Celestial light - achievement', category: 'celestial', rarity: 'common', gameUse: 'XP indicator' },
  { emoji: '🌟', name: 'Glowing Star', meaning: 'Bright star - excellence', category: 'celestial', rarity: 'uncommon', gameUse: 'Bonus XP marker' },
  { emoji: '✨', name: 'Sparkles', meaning: 'Magical sparkle effect', category: 'celestial', rarity: 'common', gameUse: 'Discovery animation effect' },
  { emoji: '☄️', name: 'Comet', meaning: 'Icy body with glowing tail', category: 'celestial', rarity: 'legendary', gameUse: 'Meteor event - rare resource shower' },
  { emoji: '🌈', name: 'Rainbow', meaning: 'Spectrum arc after rain', category: 'celestial', rarity: 'rare', gameUse: 'Appears after rain - bonus loot' },
  { emoji: '🌊', name: 'Wave', meaning: 'Ocean wave - tidal force', category: 'celestial', rarity: 'common', gameUse: 'Waterfront marker' },

  // === TOOLS ===
  { emoji: '🔨', name: 'Hammer', meaning: 'Tool for driving nails', category: 'tools', rarity: 'common', gameUse: 'Building tool indicator' },
  { emoji: '⛏️', name: 'Pick', meaning: 'Mining pickaxe', category: 'tools', rarity: 'common', gameUse: 'Stone mining tool' },
  { emoji: '🪓', name: 'Axe', meaning: 'Wood chopping tool', category: 'tools', rarity: 'common', gameUse: 'Wood gathering tool' },
  { emoji: '🔧', name: 'Wrench', meaning: 'Mechanical tool', category: 'tools', rarity: 'common', gameUse: 'Building repair tool' },
  { emoji: '🧭', name: 'Compass', meaning: 'Navigation instrument', category: 'tools', rarity: 'uncommon', gameUse: 'Reveals direction to nearest discovery' },
  { emoji: '🗺️', name: 'World Map', meaning: 'Cartographic map', category: 'tools', rarity: 'uncommon', gameUse: 'Reveals undiscovered area' },
  { emoji: '🔑', name: 'Key', meaning: 'Unlocking device', category: 'tools', rarity: 'uncommon', gameUse: 'Opens locked areas' },
  { emoji: '🗝️', name: 'Old Key', meaning: 'Antique skeleton key', category: 'tools', rarity: 'rare', gameUse: 'Opens secret areas' },
  { emoji: '🧲', name: 'Magnet', meaning: 'Attracts ferrous metals', category: 'tools', rarity: 'rare', gameUse: 'Attracts nearby resources' },
  { emoji: '🔭', name: 'Telescope', meaning: 'Optical viewing instrument', category: 'tools', rarity: 'rare', gameUse: 'See further on the map' },
  { emoji: '🔬', name: 'Microscope', meaning: 'Magnification instrument', category: 'tools', rarity: 'rare', gameUse: 'Reveals hidden micro-resources' },
  { emoji: '🪤', name: 'Mouse Trap', meaning: 'Rodent capture device', category: 'tools', rarity: 'uncommon', gameUse: 'Trap for catching critters' },

  // === MUSIC ===
  { emoji: '🎵', name: 'Musical Note', meaning: 'Single musical note', category: 'music', rarity: 'common', gameUse: 'Ambient sound indicator' },
  { emoji: '🎶', name: 'Musical Notes', meaning: 'Music playing nearby', category: 'music', rarity: 'common', gameUse: 'Music zone - XP boost' },
  { emoji: '🎸', name: 'Guitar', meaning: 'Stringed instrument', category: 'music', rarity: 'uncommon', gameUse: 'Street performer area' },
  { emoji: '🎷', name: 'Saxophone', meaning: 'Jazz woodwind - Harlem iconic', category: 'music', rarity: 'rare', gameUse: 'Harlem jazz district find' },
  { emoji: '🎹', name: 'Piano', meaning: 'Keyboard instrument', category: 'music', rarity: 'uncommon', gameUse: 'Concert hall area' },
  { emoji: '🎺', name: 'Trumpet', meaning: 'Brass instrument - jazz staple', category: 'music', rarity: 'rare', gameUse: 'Jazz district find' },
  { emoji: '🥁', name: 'Drum', meaning: 'Percussion instrument', category: 'music', rarity: 'uncommon', gameUse: 'Rhythm bonus - faster gathering' },

  // === SPORTS ===
  { emoji: '⚾', name: 'Baseball', meaning: 'Americas pastime', category: 'sports', rarity: 'common', gameUse: 'Found near Yankee Stadium area' },
  { emoji: '🏀', name: 'Basketball', meaning: 'Court sport - NYC playground staple', category: 'sports', rarity: 'common', gameUse: 'Found at basketball courts' },
  { emoji: '🎯', name: 'Bullseye', meaning: 'Direct hit - perfect aim', category: 'sports', rarity: 'uncommon', gameUse: 'Precision bonus on collection' },
  { emoji: '🏆', name: 'Trophy', meaning: 'Award for victory', category: 'sports', rarity: 'rare', gameUse: 'Achievement trophy display' },
  { emoji: '🥇', name: 'Gold Medal', meaning: 'First place award', category: 'sports', rarity: 'epic', gameUse: 'Top leaderboard reward' },

  // === HEARTS (each has distinct meaning) ===
  { emoji: '❤️', name: 'Red Heart', meaning: 'Classic love - deep affection', category: 'hearts', rarity: 'common', gameUse: 'NPC friendship indicator' },
  { emoji: '💛', name: 'Yellow Heart', meaning: 'Friendship and happiness', category: 'hearts', rarity: 'common', gameUse: 'Friend connection with players' },
  { emoji: '💚', name: 'Green Heart', meaning: 'Nature and health', category: 'hearts', rarity: 'common', gameUse: 'Herb gathering bonus' },
  { emoji: '💙', name: 'Blue Heart', meaning: 'Trust and loyalty', category: 'hearts', rarity: 'common', gameUse: 'Multiplayer trust badge' },
  { emoji: '💜', name: 'Purple Heart', meaning: 'Compassion and understanding', category: 'hearts', rarity: 'uncommon', gameUse: 'NPC deep friendship' },
  { emoji: '🖤', name: 'Black Heart', meaning: 'Dark humor, grief, rebellion', category: 'hearts', rarity: 'uncommon', gameUse: 'Night-only discovery' },
  { emoji: '💔', name: 'Broken Heart', meaning: 'Heartbreak and loss', category: 'hearts', rarity: 'uncommon', gameUse: 'Failed mission indicator' },
  { emoji: '❤️‍🔥', name: 'Heart on Fire', meaning: 'Burning passion', category: 'hearts', rarity: 'rare', gameUse: 'Passionate crafting - bonus output' },

  // === SYMBOLS ===
  { emoji: '♻️', name: 'Recycling', meaning: 'Sustainability - reuse materials', category: 'symbols', rarity: 'common', gameUse: 'Recycle buildings for partial resource return' },
  { emoji: '⚡', name: 'Lightning', meaning: 'Electrical charge - energy', category: 'symbols', rarity: 'uncommon', gameUse: 'Storm weather - power boost' },
  { emoji: '💡', name: 'Light Bulb', meaning: 'Idea - eureka moment', category: 'symbols', rarity: 'uncommon', gameUse: 'Discovery hint nearby' },
  { emoji: '🎲', name: 'Game Die', meaning: 'Chance - random outcome', category: 'symbols', rarity: 'uncommon', gameUse: 'Random reward when found' },
  { emoji: '🎰', name: 'Slot Machine', meaning: 'Gambling - luck of the draw', category: 'symbols', rarity: 'rare', gameUse: 'Random reward multiplier' },
  { emoji: '💎', name: 'Gem', meaning: 'Precious gemstone - high value', category: 'symbols', rarity: 'rare', gameUse: 'Gem resource source' },
  { emoji: '💰', name: 'Money Bag', meaning: 'Wealth and prosperity', category: 'symbols', rarity: 'uncommon', gameUse: 'Coin reward' },
  { emoji: '🏴‍☠️', name: 'Pirate Flag', meaning: 'Jolly Roger - piracy', category: 'symbols', rarity: 'epic', gameUse: 'Hidden treasure nearby' },
  { emoji: '🚩', name: 'Red Flag', meaning: 'Warning marker', category: 'symbols', rarity: 'common', gameUse: 'Danger zone marker' },
  { emoji: '♾️', name: 'Infinity', meaning: 'Endless, without limit', category: 'symbols', rarity: 'legendary', gameUse: 'Infinite gathering for 1 minute' },
];

// Build lookup map for fast access
const CATALOG_MAP = new Map<string, EmojiEntry>();
for (const entry of EMOJI_CATALOG) {
  CATALOG_MAP.set(entry.emoji, entry);
}

export class EmojiDiscoverySystem {
  private discovered: Set<string> = new Set();
  private readonly STORAGE_KEY = 'gallax_emoji_discoveries';

  constructor() {
    this.load();
  }

  private load(): void {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        const arr = JSON.parse(saved);
        this.discovered = new Set(arr);
      } catch (e) {
        console.error('Failed to load emoji discoveries:', e);
      }
    }
  }

  private save(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify([...this.discovered]));
  }

  // Discover an emoji - returns XP reward (0 if already discovered)
  discover(emoji: string): { xp: number; isNew: boolean; entry: EmojiEntry | null } {
    const entry = CATALOG_MAP.get(emoji);
    if (!entry) return { xp: 0, isNew: false, entry: null };

    if (this.discovered.has(emoji)) {
      return { xp: 0, isNew: false, entry };
    }

    this.discovered.add(emoji);
    entry.discoveredAt = Date.now();
    this.save();

    const xp = RARITY_XP[entry.rarity];
    return { xp, isNew: true, entry };
  }

  isDiscovered(emoji: string): boolean {
    return this.discovered.has(emoji);
  }

  getDiscoveredCount(): number {
    return this.discovered.size;
  }

  getTotalCount(): number {
    return EMOJI_CATALOG.length;
  }

  getProgress(): number {
    return Math.round((this.discovered.size / EMOJI_CATALOG.length) * 100);
  }

  getByCategory(category: EmojiCategory): EmojiEntry[] {
    return EMOJI_CATALOG.filter(e => e.category === category);
  }

  getCategoryProgress(category: EmojiCategory): { discovered: number; total: number; percent: number } {
    const all = this.getByCategory(category);
    const found = all.filter(e => this.discovered.has(e.emoji)).length;
    return {
      discovered: found,
      total: all.length,
      percent: all.length > 0 ? Math.round((found / all.length) * 100) : 0,
    };
  }

  getDiscoveredEmojis(): EmojiEntry[] {
    return EMOJI_CATALOG.filter(e => this.discovered.has(e.emoji));
  }

  // Check if an entire category set is complete
  checkSetCompletion(category: EmojiCategory): boolean {
    const all = this.getByCategory(category);
    return all.every(e => this.discovered.has(e.emoji));
  }

  // Get all categories with their progress
  getAllCategoryProgress(): { category: EmojiCategory; discovered: number; total: number; percent: number }[] {
    const categories: EmojiCategory[] = [
      'japanese', 'mystical', 'nature', 'marine', 'creatures', 'food',
      'buildings', 'transport', 'celestial', 'tools', 'music', 'sports',
      'hearts', 'symbols',
    ];
    return categories.map(cat => ({ category: cat, ...this.getCategoryProgress(cat) }));
  }

  // Get entry from catalog
  getEntry(emoji: string): EmojiEntry | undefined {
    return CATALOG_MAP.get(emoji);
  }

  // Get rarity color
  static getRarityColor(rarity: EmojiRarity): string {
    return RARITY_COLORS[rarity];
  }

  // Get rarity XP value
  static getRarityXP(rarity: EmojiRarity): number {
    return RARITY_XP[rarity];
  }
}
