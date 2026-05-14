// Life Missions - Sequential progression missions that guide players through game systems

export interface LifeMission {
  id: string;
  title: string;
  description: string;
  emoji: string;
  requirement: {
    type: 'collect_resource' | 'place_building' | 'place_home' | 'enter_home' | 'kill_mob' | 'reach_level' | 'craft_weapon' | 'draw_pixels' | 'collect_total' | 'place_buildings_total' | 'kill_mobs_total' | 'travel_distance' | 'discover_emoji' | 'change_name' | 'change_skin' | 'visit_landmark';
    target?: string;
    count: number;
  };
  reward: {
    xp: number;
    coins?: number;
  };
}

// All life missions in sequential order of difficulty
export const LIFE_MISSIONS: LifeMission[] = [
  // ===== EARLY GAME (1-15) =====
  {
    id: 'lm_1',
    title: 'First Steps',
    description: 'Collect your first resource',
    emoji: '🌳',
    requirement: { type: 'collect_total', count: 1 },
    reward: { xp: 10 },
  },
  {
    id: 'lm_2',
    title: 'Identity',
    description: 'Change your name to stand out',
    emoji: '✏️',
    requirement: { type: 'change_name', count: 1 },
    reward: { xp: 10 },
  },
  {
    id: 'lm_3',
    title: 'Lumberjack',
    description: 'Collect 3 wood',
    emoji: '🪵',
    requirement: { type: 'collect_resource', target: 'wood', count: 3 },
    reward: { xp: 15 },
  },
  {
    id: 'lm_4',
    title: 'Rock Collector',
    description: 'Collect 3 stone',
    emoji: '🪨',
    requirement: { type: 'collect_resource', target: 'stone', count: 3 },
    reward: { xp: 15 },
  },
  {
    id: 'lm_5',
    title: 'Home Sweet Home',
    description: 'Place your home on the map',
    emoji: '🏡',
    requirement: { type: 'place_home', count: 1 },
    reward: { xp: 25 },
  },
  {
    id: 'lm_6',
    title: 'Builder',
    description: 'Place any building',
    emoji: '🛖',
    requirement: { type: 'place_building', count: 1 },
    reward: { xp: 20 },
  },
  {
    id: 'lm_7',
    title: 'Herbalist',
    description: 'Collect 3 herbs',
    emoji: '🌿',
    requirement: { type: 'collect_resource', target: 'herb', count: 3 },
    reward: { xp: 15 },
  },
  {
    id: 'lm_8',
    title: 'Armed',
    description: 'Craft your first weapon',
    emoji: '🗡️',
    requirement: { type: 'craft_weapon', count: 1 },
    reward: { xp: 25 },
  },
  {
    id: 'lm_9',
    title: 'Pest Control',
    description: 'Kill your first mob',
    emoji: '🐀',
    requirement: { type: 'kill_mob', count: 1 },
    reward: { xp: 20 },
  },
  {
    id: 'lm_10',
    title: 'Artist',
    description: 'Draw 10 pixels on the canvas',
    emoji: '🎨',
    requirement: { type: 'draw_pixels', count: 10 },
    reward: { xp: 15 },
  },
  {
    id: 'lm_11',
    title: 'Fashion',
    description: 'Change your character skin',
    emoji: '👤',
    requirement: { type: 'change_skin', count: 1 },
    reward: { xp: 10 },
  },
  {
    id: 'lm_12',
    title: 'Interior Designer',
    description: 'Enter your home',
    emoji: '🏠',
    requirement: { type: 'enter_home', count: 1 },
    reward: { xp: 15 },
  },
  {
    id: 'lm_13',
    title: 'Fisherman',
    description: 'Collect 3 fish',
    emoji: '🐟',
    requirement: { type: 'collect_resource', target: 'fish', count: 3 },
    reward: { xp: 15 },
  },
  {
    id: 'lm_14',
    title: 'Gem Hunter',
    description: 'Collect your first gem',
    emoji: '💎',
    requirement: { type: 'collect_resource', target: 'gem', count: 1 },
    reward: { xp: 20 },
  },
  {
    id: 'lm_15',
    title: 'Beachcomber',
    description: 'Collect 3 shells from the shore',
    emoji: '🐚',
    requirement: { type: 'collect_resource', target: 'shell', count: 3 },
    reward: { xp: 15 },
  },

  // ===== MID GAME (16-40) =====
  {
    id: 'lm_16',
    title: 'Woodworker',
    description: 'Collect 10 wood',
    emoji: '🪓',
    requirement: { type: 'collect_resource', target: 'wood', count: 10 },
    reward: { xp: 25 },
  },
  {
    id: 'lm_17',
    title: 'Stonemason',
    description: 'Collect 10 stone',
    emoji: '⛏️',
    requirement: { type: 'collect_resource', target: 'stone', count: 10 },
    reward: { xp: 25 },
  },
  {
    id: 'lm_18',
    title: 'Leveling Up',
    description: 'Reach level 2',
    emoji: '⬆️',
    requirement: { type: 'reach_level', count: 2 },
    reward: { xp: 30 },
  },
  {
    id: 'lm_19',
    title: 'Neighborhood',
    description: 'Place 3 buildings',
    emoji: '🏘️',
    requirement: { type: 'place_buildings_total', count: 3 },
    reward: { xp: 30, coins: 10 },
  },
  {
    id: 'lm_20',
    title: 'Monster Hunter',
    description: 'Kill 3 mobs',
    emoji: '🐺',
    requirement: { type: 'kill_mobs_total', count: 3 },
    reward: { xp: 30 },
  },
  {
    id: 'lm_21',
    title: 'Canvas Creator',
    description: 'Draw 25 pixels',
    emoji: '🖌️',
    requirement: { type: 'draw_pixels', count: 25 },
    reward: { xp: 20 },
  },
  {
    id: 'lm_22',
    title: 'Apothecary',
    description: 'Collect 10 herbs',
    emoji: '🧪',
    requirement: { type: 'collect_resource', target: 'herb', count: 10 },
    reward: { xp: 25 },
  },
  {
    id: 'lm_23',
    title: 'Angler',
    description: 'Collect 10 fish',
    emoji: '🎣',
    requirement: { type: 'collect_resource', target: 'fish', count: 10 },
    reward: { xp: 25 },
  },
  {
    id: 'lm_24',
    title: 'Collector',
    description: 'Collect 25 total resources',
    emoji: '📦',
    requirement: { type: 'collect_total', count: 25 },
    reward: { xp: 30, coins: 15 },
  },
  {
    id: 'lm_25',
    title: 'Emoji Explorer',
    description: 'Discover 5 unique emojis',
    emoji: '🔍',
    requirement: { type: 'discover_emoji', count: 5 },
    reward: { xp: 25 },
  },
  {
    id: 'lm_26',
    title: 'Tourist',
    description: 'Visit a landmark',
    emoji: '🗽',
    requirement: { type: 'visit_landmark', count: 1 },
    reward: { xp: 30 },
  },
  {
    id: 'lm_27',
    title: 'Warrior',
    description: 'Craft 2 weapons',
    emoji: '⚔️',
    requirement: { type: 'craft_weapon', count: 2 },
    reward: { xp: 35 },
  },
  {
    id: 'lm_28',
    title: 'Wanderer',
    description: 'Travel 500 meters',
    emoji: '🚶',
    requirement: { type: 'travel_distance', count: 500 },
    reward: { xp: 25 },
  },
  {
    id: 'lm_29',
    title: 'Seasoned',
    description: 'Reach level 3',
    emoji: '🌟',
    requirement: { type: 'reach_level', count: 3 },
    reward: { xp: 40, coins: 20 },
  },
  {
    id: 'lm_30',
    title: 'Jeweler',
    description: 'Collect 5 gems',
    emoji: '💍',
    requirement: { type: 'collect_resource', target: 'gem', count: 5 },
    reward: { xp: 35 },
  },
  {
    id: 'lm_31',
    title: 'Shell Collector',
    description: 'Collect 10 shells',
    emoji: '🏖️',
    requirement: { type: 'collect_resource', target: 'shell', count: 10 },
    reward: { xp: 25 },
  },
  {
    id: 'lm_32',
    title: 'Village Builder',
    description: 'Place 5 buildings',
    emoji: '🏗️',
    requirement: { type: 'place_buildings_total', count: 5 },
    reward: { xp: 40, coins: 25 },
  },
  {
    id: 'lm_33',
    title: 'Exterminator',
    description: 'Kill 5 mobs',
    emoji: '🕷️',
    requirement: { type: 'kill_mobs_total', count: 5 },
    reward: { xp: 40 },
  },
  {
    id: 'lm_34',
    title: 'Pixel Painter',
    description: 'Draw 50 pixels',
    emoji: '🖼️',
    requirement: { type: 'draw_pixels', count: 50 },
    reward: { xp: 30 },
  },
  {
    id: 'lm_35',
    title: 'Hoarder',
    description: 'Collect 50 total resources',
    emoji: '🏪',
    requirement: { type: 'collect_total', count: 50 },
    reward: { xp: 45, coins: 30 },
  },
  {
    id: 'lm_36',
    title: 'Trekker',
    description: 'Travel 1000 meters',
    emoji: '🏃',
    requirement: { type: 'travel_distance', count: 1000 },
    reward: { xp: 35, coins: 20 },
  },
  {
    id: 'lm_37',
    title: 'Emoji Spotter',
    description: 'Discover 10 unique emojis',
    emoji: '🧐',
    requirement: { type: 'discover_emoji', count: 10 },
    reward: { xp: 35 },
  },
  {
    id: 'lm_38',
    title: 'Arsenal',
    description: 'Craft 3 weapons',
    emoji: '🏹',
    requirement: { type: 'craft_weapon', count: 3 },
    reward: { xp: 40 },
  },
  {
    id: 'lm_39',
    title: 'Sightseer',
    description: 'Visit 3 landmarks',
    emoji: '🗼',
    requirement: { type: 'visit_landmark', count: 3 },
    reward: { xp: 40, coins: 25 },
  },
  {
    id: 'lm_40',
    title: 'Adventurer',
    description: 'Reach level 5',
    emoji: '⭐',
    requirement: { type: 'reach_level', count: 5 },
    reward: { xp: 60, coins: 40 },
  },

  // ===== LATE GAME (41-80) =====
  {
    id: 'lm_41',
    title: 'Timber Baron',
    description: 'Collect 25 wood',
    emoji: '🌲',
    requirement: { type: 'collect_resource', target: 'wood', count: 25 },
    reward: { xp: 40 },
  },
  {
    id: 'lm_42',
    title: 'Quarry Master',
    description: 'Collect 25 stone',
    emoji: '🏔️',
    requirement: { type: 'collect_resource', target: 'stone', count: 25 },
    reward: { xp: 40 },
  },
  {
    id: 'lm_43',
    title: 'Deep Sea Fisher',
    description: 'Collect 25 fish',
    emoji: '🦈',
    requirement: { type: 'collect_resource', target: 'fish', count: 25 },
    reward: { xp: 40 },
  },
  {
    id: 'lm_44',
    title: 'Herbology Expert',
    description: 'Collect 25 herbs',
    emoji: '🍀',
    requirement: { type: 'collect_resource', target: 'herb', count: 25 },
    reward: { xp: 40 },
  },
  {
    id: 'lm_45',
    title: 'Prospector',
    description: 'Collect 10 gems',
    emoji: '⛏️',
    requirement: { type: 'collect_resource', target: 'gem', count: 10 },
    reward: { xp: 45, coins: 30 },
  },
  {
    id: 'lm_46',
    title: 'Town Planner',
    description: 'Place 10 buildings',
    emoji: '🏙️',
    requirement: { type: 'place_buildings_total', count: 10 },
    reward: { xp: 60, coins: 40 },
  },
  {
    id: 'lm_47',
    title: 'Beast Slayer',
    description: 'Kill 10 mobs',
    emoji: '🐉',
    requirement: { type: 'kill_mobs_total', count: 10 },
    reward: { xp: 55 },
  },
  {
    id: 'lm_48',
    title: 'Mural Maker',
    description: 'Draw 100 pixels',
    emoji: '🎭',
    requirement: { type: 'draw_pixels', count: 100 },
    reward: { xp: 45, coins: 25 },
  },
  {
    id: 'lm_49',
    title: 'Resource King',
    description: 'Collect 100 total resources',
    emoji: '👑',
    requirement: { type: 'collect_total', count: 100 },
    reward: { xp: 60, coins: 50 },
  },
  {
    id: 'lm_50',
    title: 'Trailblazer',
    description: 'Travel 2500 meters',
    emoji: '🧭',
    requirement: { type: 'travel_distance', count: 2500 },
    reward: { xp: 50, coins: 30 },
  },
  {
    id: 'lm_51',
    title: 'Emoji Collector',
    description: 'Discover 15 unique emojis',
    emoji: '🎯',
    requirement: { type: 'discover_emoji', count: 15 },
    reward: { xp: 45 },
  },
  {
    id: 'lm_52',
    title: 'Blacksmith',
    description: 'Craft 5 weapons',
    emoji: '🔨',
    requirement: { type: 'craft_weapon', count: 5 },
    reward: { xp: 55, coins: 35 },
  },
  {
    id: 'lm_53',
    title: 'Explorer',
    description: 'Visit 5 landmarks',
    emoji: '🌍',
    requirement: { type: 'visit_landmark', count: 5 },
    reward: { xp: 50, coins: 30 },
  },
  {
    id: 'lm_54',
    title: 'Experienced',
    description: 'Reach level 7',
    emoji: '🎖️',
    requirement: { type: 'reach_level', count: 7 },
    reward: { xp: 70, coins: 50 },
  },
  {
    id: 'lm_55',
    title: 'Lumber Mill',
    description: 'Collect 50 wood',
    emoji: '🪚',
    requirement: { type: 'collect_resource', target: 'wood', count: 50 },
    reward: { xp: 55, coins: 30 },
  },
  {
    id: 'lm_56',
    title: 'Mining Operation',
    description: 'Collect 50 stone',
    emoji: '💣',
    requirement: { type: 'collect_resource', target: 'stone', count: 50 },
    reward: { xp: 55, coins: 30 },
  },
  {
    id: 'lm_57',
    title: 'Fishing Fleet',
    description: 'Collect 50 fish',
    emoji: '🚢',
    requirement: { type: 'collect_resource', target: 'fish', count: 50 },
    reward: { xp: 55, coins: 30 },
  },
  {
    id: 'lm_58',
    title: 'Botanical Garden',
    description: 'Collect 50 herbs',
    emoji: '🌺',
    requirement: { type: 'collect_resource', target: 'herb', count: 50 },
    reward: { xp: 55, coins: 30 },
  },
  {
    id: 'lm_59',
    title: 'Gem Dealer',
    description: 'Collect 25 gems',
    emoji: '💰',
    requirement: { type: 'collect_resource', target: 'gem', count: 25 },
    reward: { xp: 60, coins: 50 },
  },
  {
    id: 'lm_60',
    title: 'Shell Merchant',
    description: 'Collect 25 shells',
    emoji: '🧜',
    requirement: { type: 'collect_resource', target: 'shell', count: 25 },
    reward: { xp: 50, coins: 30 },
  },
  {
    id: 'lm_61',
    title: 'Hamlet',
    description: 'Place 15 buildings',
    emoji: '🏰',
    requirement: { type: 'place_buildings_total', count: 15 },
    reward: { xp: 70, coins: 50 },
  },
  {
    id: 'lm_62',
    title: 'Monster Slayer',
    description: 'Kill 15 mobs',
    emoji: '🧟',
    requirement: { type: 'kill_mobs_total', count: 15 },
    reward: { xp: 65 },
  },
  {
    id: 'lm_63',
    title: 'Gallery',
    description: 'Draw 200 pixels',
    emoji: '🏛️',
    requirement: { type: 'draw_pixels', count: 200 },
    reward: { xp: 55, coins: 35 },
  },
  {
    id: 'lm_64',
    title: 'Stockpiler',
    description: 'Collect 150 total resources',
    emoji: '🏭',
    requirement: { type: 'collect_total', count: 150 },
    reward: { xp: 70, coins: 50 },
  },
  {
    id: 'lm_65',
    title: 'Pathfinder',
    description: 'Travel 5000 meters',
    emoji: '🗺️',
    requirement: { type: 'travel_distance', count: 5000 },
    reward: { xp: 65, coins: 40 },
  },
  {
    id: 'lm_66',
    title: 'Emoji Expert',
    description: 'Discover 20 unique emojis',
    emoji: '📖',
    requirement: { type: 'discover_emoji', count: 20 },
    reward: { xp: 55, coins: 35 },
  },
  {
    id: 'lm_67',
    title: 'Armorer',
    description: 'Craft 7 weapons',
    emoji: '🛡️',
    requirement: { type: 'craft_weapon', count: 7 },
    reward: { xp: 65, coins: 40 },
  },
  {
    id: 'lm_68',
    title: 'Globetrotter',
    description: 'Visit 7 landmarks',
    emoji: '✈️',
    requirement: { type: 'visit_landmark', count: 7 },
    reward: { xp: 60, coins: 40 },
  },
  {
    id: 'lm_69',
    title: 'Veteran',
    description: 'Reach level 10',
    emoji: '🌟',
    requirement: { type: 'reach_level', count: 10 },
    reward: { xp: 100, coins: 75 },
  },
  {
    id: 'lm_70',
    title: 'Champion Slayer',
    description: 'Kill 20 mobs',
    emoji: '💀',
    requirement: { type: 'kill_mobs_total', count: 20 },
    reward: { xp: 75, coins: 40 },
  },
  {
    id: 'lm_71',
    title: 'City Founder',
    description: 'Place 20 buildings',
    emoji: '🌆',
    requirement: { type: 'place_buildings_total', count: 20 },
    reward: { xp: 80, coins: 60 },
  },
  {
    id: 'lm_72',
    title: 'Master Painter',
    description: 'Draw 350 pixels',
    emoji: '🎨',
    requirement: { type: 'draw_pixels', count: 350 },
    reward: { xp: 65, coins: 40 },
  },
  {
    id: 'lm_73',
    title: 'Treasure Hunter',
    description: 'Collect 200 total resources',
    emoji: '🗝️',
    requirement: { type: 'collect_total', count: 200 },
    reward: { xp: 80, coins: 60 },
  },
  {
    id: 'lm_74',
    title: 'Marathon Runner',
    description: 'Travel 7500 meters',
    emoji: '🏅',
    requirement: { type: 'travel_distance', count: 7500 },
    reward: { xp: 75, coins: 50 },
  },
  {
    id: 'lm_75',
    title: 'Emoji Scholar',
    description: 'Discover 30 unique emojis',
    emoji: '🎓',
    requirement: { type: 'discover_emoji', count: 30 },
    reward: { xp: 70, coins: 45 },
  },
  {
    id: 'lm_76',
    title: 'War Machine',
    description: 'Craft 10 weapons',
    emoji: '⚙️',
    requirement: { type: 'craft_weapon', count: 10 },
    reward: { xp: 80, coins: 55 },
  },
  {
    id: 'lm_77',
    title: 'World Traveler',
    description: 'Visit 10 landmarks',
    emoji: '🌐',
    requirement: { type: 'visit_landmark', count: 10 },
    reward: { xp: 75, coins: 50 },
  },
  {
    id: 'lm_78',
    title: 'Shell Hoarder',
    description: 'Collect 50 shells',
    emoji: '🐢',
    requirement: { type: 'collect_resource', target: 'shell', count: 50 },
    reward: { xp: 65, coins: 40 },
  },
  {
    id: 'lm_79',
    title: 'Gem Magnate',
    description: 'Collect 50 gems',
    emoji: '👸',
    requirement: { type: 'collect_resource', target: 'gem', count: 50 },
    reward: { xp: 75, coins: 60 },
  },
  {
    id: 'lm_80',
    title: 'Elite',
    description: 'Reach level 15',
    emoji: '💫',
    requirement: { type: 'reach_level', count: 15 },
    reward: { xp: 120, coins: 100 },
  },

  // ===== END GAME (81-100) =====
  {
    id: 'lm_81',
    title: 'Lumber Empire',
    description: 'Collect 100 wood',
    emoji: '🏗️',
    requirement: { type: 'collect_resource', target: 'wood', count: 100 },
    reward: { xp: 90, coins: 60 },
  },
  {
    id: 'lm_82',
    title: 'Mountain King',
    description: 'Collect 100 stone',
    emoji: '🗻',
    requirement: { type: 'collect_resource', target: 'stone', count: 100 },
    reward: { xp: 90, coins: 60 },
  },
  {
    id: 'lm_83',
    title: 'Ocean Master',
    description: 'Collect 100 fish',
    emoji: '🐋',
    requirement: { type: 'collect_resource', target: 'fish', count: 100 },
    reward: { xp: 90, coins: 60 },
  },
  {
    id: 'lm_84',
    title: 'Druid',
    description: 'Collect 100 herbs',
    emoji: '🧙',
    requirement: { type: 'collect_resource', target: 'herb', count: 100 },
    reward: { xp: 90, coins: 60 },
  },
  {
    id: 'lm_85',
    title: 'Annihilator',
    description: 'Kill 35 mobs',
    emoji: '☠️',
    requirement: { type: 'kill_mobs_total', count: 35 },
    reward: { xp: 100, coins: 60 },
  },
  {
    id: 'lm_86',
    title: 'Metropolis',
    description: 'Place 35 buildings',
    emoji: '🏙️',
    requirement: { type: 'place_buildings_total', count: 35 },
    reward: { xp: 100, coins: 75 },
  },
  {
    id: 'lm_87',
    title: 'Museum',
    description: 'Draw 500 pixels',
    emoji: '🖼️',
    requirement: { type: 'draw_pixels', count: 500 },
    reward: { xp: 85, coins: 55 },
  },
  {
    id: 'lm_88',
    title: 'Warehouse',
    description: 'Collect 300 total resources',
    emoji: '📦',
    requirement: { type: 'collect_total', count: 300 },
    reward: { xp: 100, coins: 75 },
  },
  {
    id: 'lm_89',
    title: 'Ultramarathon',
    description: 'Travel 10000 meters',
    emoji: '🚀',
    requirement: { type: 'travel_distance', count: 10000 },
    reward: { xp: 90, coins: 60 },
  },
  {
    id: 'lm_90',
    title: 'Emoji Master',
    description: 'Discover 40 unique emojis',
    emoji: '🧠',
    requirement: { type: 'discover_emoji', count: 40 },
    reward: { xp: 85, coins: 55 },
  },
  {
    id: 'lm_91',
    title: 'Legendary Smith',
    description: 'Craft 15 weapons',
    emoji: '🔥',
    requirement: { type: 'craft_weapon', count: 15 },
    reward: { xp: 100, coins: 70 },
  },
  {
    id: 'lm_92',
    title: 'World Wonder',
    description: 'Visit 15 landmarks',
    emoji: '🏛️',
    requirement: { type: 'visit_landmark', count: 15 },
    reward: { xp: 90, coins: 60 },
  },
  {
    id: 'lm_93',
    title: 'Master',
    description: 'Reach level 20',
    emoji: '🏆',
    requirement: { type: 'reach_level', count: 20 },
    reward: { xp: 150, coins: 150 },
  },
  {
    id: 'lm_94',
    title: 'Doom Bringer',
    description: 'Kill 50 mobs',
    emoji: '🔱',
    requirement: { type: 'kill_mobs_total', count: 50 },
    reward: { xp: 120, coins: 80 },
  },
  {
    id: 'lm_95',
    title: 'Empire Builder',
    description: 'Place 50 buildings',
    emoji: '🌇',
    requirement: { type: 'place_buildings_total', count: 50 },
    reward: { xp: 120, coins: 100 },
  },
  {
    id: 'lm_96',
    title: 'Renaissance',
    description: 'Draw 1000 pixels',
    emoji: '🎪',
    requirement: { type: 'draw_pixels', count: 1000 },
    reward: { xp: 100, coins: 75 },
  },
  {
    id: 'lm_97',
    title: 'Tycoon',
    description: 'Collect 500 total resources',
    emoji: '🏦',
    requirement: { type: 'collect_total', count: 500 },
    reward: { xp: 130, coins: 100 },
  },
  {
    id: 'lm_98',
    title: 'Emoji Sage',
    description: 'Discover 50 unique emojis',
    emoji: '🦉',
    requirement: { type: 'discover_emoji', count: 50 },
    reward: { xp: 110, coins: 75 },
  },
  {
    id: 'lm_99',
    title: 'Masterpiece',
    description: 'Draw 2000 pixels',
    emoji: '🗿',
    requirement: { type: 'draw_pixels', count: 2000 },
    reward: { xp: 130, coins: 100 },
  },
  {
    id: 'lm_100',
    title: 'Legend',
    description: 'Reach level 25',
    emoji: '👑',
    requirement: { type: 'reach_level', count: 25 },
    reward: { xp: 200, coins: 200 },
  },
];

// Stats object passed to checkProgress
interface ProgressStats {
  resourcesCollected: Record<string, number>;
  buildingsPlaced: number;
  hasHome: boolean;
  hasEnteredHome: boolean;
  mobsKilled: number;
  level: number;
  weaponsCrafted: number;
  pixelsDrawn: number;
  emojisDiscovered: number;
  hasChangedName: boolean;
  hasChangedSkin: boolean;
  landmarksVisited: number;
  totalResourcesCollected: number;
  totalDistance: number;
}

interface SaveData {
  completedIds: string[];
  completedTimestamps: Record<string, number>;
}

const STORAGE_KEY = 'gallax_life_missions';

export class LifeMissionSystem {
  private completedIds: Set<string> = new Set();
  private completedTimestamps: Map<string, number> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  // Get the next 3 uncompleted missions in sequence
  getActiveMissions(): LifeMission[] {
    const active: LifeMission[] = [];
    for (const mission of LIFE_MISSIONS) {
      if (active.length >= 3) break;
      if (!this.completedIds.has(mission.id)) {
        active.push(mission);
      }
    }
    return active;
  }

  // Get all completed missions with timestamps
  getCompletedMissions(): { mission: LifeMission; completedAt: number }[] {
    const results: { mission: LifeMission; completedAt: number }[] = [];
    for (const mission of LIFE_MISSIONS) {
      if (this.completedIds.has(mission.id)) {
        results.push({
          mission,
          completedAt: this.completedTimestamps.get(mission.id) || 0,
        });
      }
    }
    return results;
  }

  getTotalCount(): number {
    return LIFE_MISSIONS.length;
  }

  getCompletedCount(): number {
    return this.completedIds.size;
  }

  // Check progress on a specific mission against provided stats
  getProgress(missionId: string): { current: number; target: number; complete: boolean } {
    const mission = LIFE_MISSIONS.find(m => m.id === missionId);
    if (!mission) {
      return { current: 0, target: 0, complete: false };
    }
    if (this.completedIds.has(missionId)) {
      return { current: mission.requirement.count, target: mission.requirement.count, complete: true };
    }
    return { current: 0, target: mission.requirement.count, complete: false };
  }

  // Check all active missions against current stats, return newly completed ones
  checkProgress(stats: ProgressStats): LifeMission[] {
    const newlyCompleted: LifeMission[] = [];
    const activeMissions = this.getActiveMissions();

    for (const mission of activeMissions) {
      if (this.isMissionComplete(mission, stats)) {
        newlyCompleted.push(mission);
      }
    }

    return newlyCompleted;
  }

  // Mark a mission as complete and return its reward
  completeMission(missionId: string): { xp: number; coins: number } | null {
    if (this.completedIds.has(missionId)) return null;

    const mission = LIFE_MISSIONS.find(m => m.id === missionId);
    if (!mission) return null;

    this.completedIds.add(missionId);
    this.completedTimestamps.set(missionId, Date.now());
    this.saveToStorage();

    return {
      xp: mission.reward.xp,
      coins: mission.reward.coins || 0,
    };
  }

  private isMissionComplete(mission: LifeMission, stats: ProgressStats): boolean {
    const req = mission.requirement;

    switch (req.type) {
      case 'collect_resource': {
        const amount = (req.target && stats.resourcesCollected[req.target]) || 0;
        return amount >= req.count;
      }
      case 'collect_total':
        return stats.totalResourcesCollected >= req.count;
      case 'place_building':
      case 'place_buildings_total':
        return stats.buildingsPlaced >= req.count;
      case 'place_home':
        return stats.hasHome;
      case 'enter_home':
        return stats.hasEnteredHome;
      case 'kill_mob':
      case 'kill_mobs_total':
        return stats.mobsKilled >= req.count;
      case 'reach_level':
        return stats.level >= req.count;
      case 'craft_weapon':
        return stats.weaponsCrafted >= req.count;
      case 'draw_pixels':
        return stats.pixelsDrawn >= req.count;
      case 'discover_emoji':
        return stats.emojisDiscovered >= req.count;
      case 'change_name':
        return stats.hasChangedName;
      case 'change_skin':
        return stats.hasChangedSkin;
      case 'visit_landmark':
        return stats.landmarksVisited >= req.count;
      case 'travel_distance':
        return stats.totalDistance >= req.count;
      default:
        return false;
    }
  }

  private saveToStorage(): void {
    const data: SaveData = {
      completedIds: Array.from(this.completedIds),
      completedTimestamps: Object.fromEntries(this.completedTimestamps),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  private loadFromStorage(): void {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data: SaveData = JSON.parse(saved);
        this.completedIds = new Set(data.completedIds || []);
        this.completedTimestamps = new Map(
          Object.entries(data.completedTimestamps || {}).map(([k, v]) => [k, v as number])
        );
      } catch {
        // Corrupted save data, start fresh
        this.completedIds = new Set();
        this.completedTimestamps = new Map();
      }
    }
  }
}
