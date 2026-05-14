// Dialogue system for NPC interactions

export interface DialogueOption {
  text: string;
  nextNode?: string; // ID of next dialogue node
  action?: 'accept_mission' | 'complete_mission' | 'end';
  missionId?: string;
}

export interface DialogueNode {
  id: string;
  npcText: string;
  options: DialogueOption[];
}

export interface Conversation {
  id: string;
  npcName: string;
  nodes: DialogueNode[];
  initialNode: string;
  missionId?: string; // If this conversation is tied to a mission
  requiresMission?: boolean; // If true, only show when player has active mission
}

// All conversations - small talk, missions, and lore
export const CONVERSATIONS: Conversation[] = [
  // ===== SMALL TALK =====
  {
    id: 'greeting_1',
    npcName: 'Friendly Villager',
    initialNode: 'start',
    nodes: [
      { id: 'start', npcText: 'Hello there! Beautiful day, isn\'t it?', options: [
        { text: 'Yes, it\'s lovely!', nextNode: 'weather' },
        { text: 'I\'ve seen better.', nextNode: 'grumpy' },
        { text: 'Goodbye!', action: 'end' }
      ]},
      { id: 'weather', npcText: 'I love days like this. Perfect for exploring!', options: [
        { text: 'Agreed! Take care!', action: 'end' }
      ]},
      { id: 'grumpy', npcText: 'Oh, well... I hope your day gets better!', options: [
        { text: 'Thanks...', action: 'end' }
      ]}
    ]
  },
  {
    id: 'greeting_2',
    npcName: 'Curious Traveler',
    initialNode: 'start',
    nodes: [
      { id: 'start', npcText: 'Have you been exploring long? I\'m new to this area.', options: [
        { text: 'Yes, I know it well!', nextNode: 'experienced' },
        { text: 'I\'m new too!', nextNode: 'newbie' },
        { text: 'Gotta go!', action: 'end' }
      ]},
      { id: 'experienced', npcText: 'Wonderful! Maybe you can show me around sometime.', options: [
        { text: 'Sure thing!', action: 'end' }
      ]},
      { id: 'newbie', npcText: 'We can explore together then! Good luck out there!', options: [
        { text: 'You too!', action: 'end' }
      ]}
    ]
  },
  {
    id: 'lore_nyc',
    npcName: 'NYC Historian',
    initialNode: 'start',
    nodes: [
      { id: 'start', npcText: 'Did you know Central Park was designed by Frederick Law Olmsted in 1858? 843 acres of designed nature in the heart of Manhattan!', options: [
        { text: 'That\'s amazing! Tell me more.', nextNode: 'more' },
        { text: 'Cool, thanks!', action: 'end' }
      ]},
      { id: 'more', npcText: 'The park has 36 bridges, 21 playgrounds, and over 18,000 trees. Every tree you see here has been carefully placed!', options: [
        { text: 'No wonder there\'s so much wood to gather!', action: 'end' }
      ]}
    ]
  },
  {
    id: 'emoji_scholar',
    npcName: 'Emoji Scholar',
    initialNode: 'start',
    nodes: [
      { id: 'start', npcText: 'Have you noticed the symbols scattered around? Each one has deep meaning. Take this one for example...', options: [
        { text: 'Tell me about the Japanese ones!', nextNode: 'japanese' },
        { text: 'What about the mystical ones?', nextNode: 'mystical' },
        { text: 'Maybe later.', action: 'end' }
      ]},
      { id: 'japanese', npcText: 'The symbol that means "secret" is actually the kanji for himitsu. In Japan, you\'d see it stamped on confidential documents. Here, it marks hidden treasure!', options: [
        { text: 'I\'ll keep my eyes open!', action: 'end' }
      ]},
      { id: 'mystical', npcText: 'The Nazar amulet protects against the evil eye. The Hamsa hand brings blessings. Ancient peoples knew the power of symbols. So do we.', options: [
        { text: 'Fascinating...', action: 'end' }
      ]}
    ]
  },
  {
    id: 'cook_talk',
    npcName: 'Street Chef',
    initialNode: 'start',
    nodes: [
      { id: 'start', npcText: 'Nothing beats NYC street food! Hot dogs, pretzels, halal carts... this city eats like nowhere else.', options: [
        { text: 'What\'s your favorite?', nextNode: 'favorite' },
        { text: 'I\'m more of a home cook.', nextNode: 'home' },
        { text: 'Gotta run!', action: 'end' }
      ]},
      { id: 'favorite', npcText: 'A proper NYC slice! Thin crust, folded in half, eaten while walking. That\'s the authentic experience right there.', options: [
        { text: 'Now I\'m hungry!', action: 'end' }
      ]},
      { id: 'home', npcText: 'Then you should try building a farm! Grow your own ingredients. Fresh herbs make everything better.', options: [
        { text: 'Good idea!', action: 'end' }
      ]}
    ]
  },
  {
    id: 'musician_talk',
    npcName: 'Jazz Musician',
    initialNode: 'start',
    nodes: [
      { id: 'start', npcText: 'You hear that? The city has its own rhythm. Subway rumbles, taxi horns, street performers... it\'s all music.', options: [
        { text: 'Play me something!', nextNode: 'play' },
        { text: 'I prefer quiet.', nextNode: 'quiet' },
        { text: 'See ya!', action: 'end' }
      ]},
      { id: 'play', npcText: '*plays a smooth jazz riff* Harlem was the birthplace of bebop. Every note tells a story of this city.', options: [
        { text: 'Beautiful! Thanks for the tune.', action: 'end' }
      ]},
      { id: 'quiet', npcText: 'Then head to the parks at dawn. The birds have their own concert. Nature\'s music is the oldest kind.', options: [
        { text: 'I\'ll try that.', action: 'end' }
      ]}
    ]
  },
  {
    id: 'weather_npc',
    npcName: 'Weather Watcher',
    initialNode: 'start',
    nodes: [
      { id: 'start', npcText: 'I\'ve been tracking the weather patterns. Did you know storms bring double XP? And rain makes fish more plentiful!', options: [
        { text: 'What about snow?', nextNode: 'snow' },
        { text: 'And fog?', nextNode: 'fog' },
        { text: 'Thanks for the tip!', action: 'end' }
      ]},
      { id: 'snow', npcText: 'Snow makes gems sparkle brighter - they\'re 50% easier to find! Plus the XP bonus is 1.3x. Bundle up!', options: [
        { text: 'I love snow!', action: 'end' }
      ]},
      { id: 'fog', npcText: 'Fog is mysterious... herbs appear in places they normally don\'t. Double herb drops! And a slight XP boost too.', options: [
        { text: 'I\'ll watch for fog then.', action: 'end' }
      ]}
    ]
  },
  {
    id: 'beginner_guide',
    npcName: 'Guide',
    initialNode: 'start',
    nodes: [
      { id: 'start', npcText: 'Welcome! I help new explorers get started. What would you like to know?', options: [
        { text: 'How do I collect resources?', nextNode: 'resources' },
        { text: 'How do I build things?', nextNode: 'building' },
        { text: 'What are emojis for?', nextNode: 'emojis' },
        { text: 'I\'m good, thanks!', action: 'end' }
      ]},
      { id: 'resources', npcText: 'Tap on trees and plants in green areas to collect wood and herbs. Near water, you\'ll find fish and shells. Rocks give stone, and rare spots have gems!', options: [
        { text: 'Got it! What about building?', nextNode: 'building' },
        { text: 'Thanks!', action: 'end' }
      ]},
      { id: 'building', npcText: 'Open the crafting menu and select a building. Each one needs different resources. Place it on the map and it\'s yours! You can rotate and move it too.', options: [
        { text: 'What about the emojis?', nextNode: 'emojis' },
        { text: 'Perfect, thanks!', action: 'end' }
      ]},
      { id: 'emojis', npcText: 'Every emoji you encounter has real meaning! Collect them all in your Emoji Codex. Japanese symbols like the ones meaning "secret" or "discount" are especially rare. Keep exploring!', options: [
        { text: 'I\'ll collect them all!', action: 'end' }
      ]}
    ]
  },
  {
    id: 'mysterious_traveler',
    npcName: 'Mysterious Traveler',
    initialNode: 'start',
    nodes: [
      { id: 'start', npcText: '...you look like someone who seeks hidden things. There are secrets in this city that most people walk right past.', options: [
        { text: 'What kind of secrets?', nextNode: 'secrets' },
        { text: 'That\'s a bit creepy...', nextNode: 'creepy' },
        { text: 'Not interested.', action: 'end' }
      ]},
      { id: 'secrets', npcText: 'Ancient symbols of protection. Objects from distant lands. The kanji for "secret" marks locations where treasures hide. Not all who wander are lost... but some finds require getting lost.', options: [
        { text: 'I\'ll keep exploring. Thank you.', action: 'end' }
      ]},
      { id: 'creepy', npcText: '*laughs* I suppose it is. But the best discoveries come from following curiosity, not fear. Happy hunting.', options: [
        { text: 'Fair point. See you around.', action: 'end' }
      ]}
    ]
  },

  // ===== MISSIONS =====

  // Wood mission
  { id: 'mission_wood', npcName: 'Builder Bob', initialNode: 'start', missionId: 'collect_wood_5',
    nodes: [
      { id: 'start', npcText: 'I need wood to build a new house! Can you collect 5 wood for me?', options: [
        { text: 'Sure, I\'ll help!', action: 'accept_mission', missionId: 'collect_wood_5', nextNode: 'accepted' },
        { text: 'Not right now.', action: 'end' }
      ]},
      { id: 'accepted', npcText: 'Thank you! Come back when you have 5 wood!', options: [
        { text: 'Will do!', action: 'end' }
      ]}
    ]
  },
  { id: 'mission_wood_complete', npcName: 'Builder Bob', initialNode: 'start', missionId: 'collect_wood_5', requiresMission: true,
    nodes: [
      { id: 'start', npcText: 'You\'re back! Do you have the 5 wood I need?', options: [
        { text: 'Yes, here you go!', action: 'complete_mission', missionId: 'collect_wood_5' },
        { text: 'Not yet...', action: 'end' }
      ]}
    ]
  },

  // Stone mission
  { id: 'mission_stone', npcName: 'Mason Mary', initialNode: 'start', missionId: 'collect_stone_10',
    nodes: [
      { id: 'start', npcText: 'I\'m working on a stone wall. Could you gather 10 stone for me?', options: [
        { text: 'I\'ll get it for you!', action: 'accept_mission', missionId: 'collect_stone_10', nextNode: 'accepted' },
        { text: 'Maybe later.', action: 'end' }
      ]},
      { id: 'accepted', npcText: 'Excellent! Return when you have 10 stone!', options: [
        { text: 'On my way!', action: 'end' }
      ]}
    ]
  },
  { id: 'mission_stone_complete', npcName: 'Mason Mary', initialNode: 'start', missionId: 'collect_stone_10', requiresMission: true,
    nodes: [
      { id: 'start', npcText: 'Perfect timing! Did you bring the 10 stone?', options: [
        { text: 'Here it is!', action: 'complete_mission', missionId: 'collect_stone_10' },
        { text: 'Still working on it.', action: 'end' }
      ]}
    ]
  },

  // Fish mission
  { id: 'mission_fish', npcName: 'Captain Finn', initialNode: 'start', missionId: 'collect_fish_8',
    nodes: [
      { id: 'start', npcText: 'Ahoy! The harbor\'s been quiet lately. I need 8 fish to fill my orders. Head to the water and see what you can catch!', options: [
        { text: 'I\'ll reel them in!', action: 'accept_mission', missionId: 'collect_fish_8', nextNode: 'accepted' },
        { text: 'I\'m no fisherman.', action: 'end' }
      ]},
      { id: 'accepted', npcText: 'That\'s the spirit! Look for fish near the water. Rain makes them more abundant! Come back with 8.', options: [
        { text: 'Aye aye, Captain!', action: 'end' }
      ]}
    ]
  },
  { id: 'mission_fish_complete', npcName: 'Captain Finn', initialNode: 'start', missionId: 'collect_fish_8', requiresMission: true,
    nodes: [
      { id: 'start', npcText: 'Back from the waters! Did you catch my 8 fish?', options: [
        { text: 'Fresh off the hook!', action: 'complete_mission', missionId: 'collect_fish_8' },
        { text: 'Still fishing...', action: 'end' }
      ]}
    ]
  },

  // Gem mission
  { id: 'mission_gem', npcName: 'Gemologist Gloria', initialNode: 'start', missionId: 'collect_gem_3',
    nodes: [
      { id: 'start', npcText: 'I\'m studying the geological formations here. I need 3 gems for my research. They\'re rare but worth the search!', options: [
        { text: 'I\'ll find them!', action: 'accept_mission', missionId: 'collect_gem_3', nextNode: 'accepted' },
        { text: 'Gems are too hard to find.', nextNode: 'tip' }
      ]},
      { id: 'accepted', npcText: 'Wonderful! Gems sparkle near rocky areas. In snowy weather, they\'re easier to spot!', options: [
        { text: 'I\'ll watch for the sparkle!', action: 'end' }
      ]},
      { id: 'tip', npcText: 'Try looking near rock formations! And snow weather makes them 50% more common. Come back if you change your mind.', options: [
        { text: 'Hmm, maybe I\'ll try...', action: 'accept_mission', missionId: 'collect_gem_3', nextNode: 'accepted' },
        { text: 'Not today.', action: 'end' }
      ]}
    ]
  },
  { id: 'mission_gem_complete', npcName: 'Gemologist Gloria', initialNode: 'start', missionId: 'collect_gem_3', requiresMission: true,
    nodes: [
      { id: 'start', npcText: 'Did you find the 3 gems I need for my research?', options: [
        { text: 'Here they are, gorgeous!', action: 'complete_mission', missionId: 'collect_gem_3' },
        { text: 'Still looking...', action: 'end' }
      ]}
    ]
  },

  // Shell mission
  { id: 'mission_shell', npcName: 'Harbor Heather', initialNode: 'start', missionId: 'collect_shell_6',
    nodes: [
      { id: 'start', npcText: 'I make jewelry from shells found along the waterfront. Could you collect 6 shells for my next piece?', options: [
        { text: 'I love beachcombing!', action: 'accept_mission', missionId: 'collect_shell_6', nextNode: 'accepted' },
        { text: 'Not right now.', action: 'end' }
      ]},
      { id: 'accepted', npcText: 'The best shells are near the water\'s edge. Sometimes crabs carry them too! Bring me 6.', options: [
        { text: 'I\'ll find the prettiest ones!', action: 'end' }
      ]}
    ]
  },
  { id: 'mission_shell_complete', npcName: 'Harbor Heather', initialNode: 'start', missionId: 'collect_shell_6', requiresMission: true,
    nodes: [
      { id: 'start', npcText: 'Back from the shore! Do you have 6 shells for me?', options: [
        { text: 'Here you go!', action: 'complete_mission', missionId: 'collect_shell_6' },
        { text: 'Need a few more...', action: 'end' }
      ]}
    ]
  },

  // Herb mission
  { id: 'mission_herb', npcName: 'Herbalist Hana', initialNode: 'start', missionId: 'collect_herb_8',
    nodes: [
      { id: 'start', npcText: 'I\'m brewing medicines from the wild herbs that grow in the parks. Could you gather 8 herbs for me? Foggy weather is the best time to find them.', options: [
        { text: 'I know just where to look!', action: 'accept_mission', missionId: 'collect_herb_8', nextNode: 'accepted' },
        { text: 'Maybe another time.', action: 'end' }
      ]},
      { id: 'accepted', npcText: 'Look in the green areas - parks, gardens, anywhere with grass. Clovers and ferns are perfect! Bring me 8.', options: [
        { text: 'On it!', action: 'end' }
      ]}
    ]
  },
  { id: 'mission_herb_complete', npcName: 'Herbalist Hana', initialNode: 'start', missionId: 'collect_herb_8', requiresMission: true,
    nodes: [
      { id: 'start', npcText: 'You\'re back! Did you find the 8 herbs I need?', options: [
        { text: 'Fresh and fragrant!', action: 'complete_mission', missionId: 'collect_herb_8' },
        { text: 'Still gathering...', action: 'end' }
      ]}
    ]
  },

  // Big wood mission
  { id: 'mission_wood_big', npcName: 'Lumber Lisa', initialNode: 'start', missionId: 'collect_wood_15',
    nodes: [
      { id: 'start', npcText: 'I\'m building a dock and need a LOT of lumber. Can you bring me 15 wood? I\'ll make it worth your while!', options: [
        { text: 'That\'s a lot, but sure!', action: 'accept_mission', missionId: 'collect_wood_15', nextNode: 'accepted' },
        { text: 'Too much for me.', action: 'end' }
      ]},
      { id: 'accepted', npcText: 'You\'re a champ! Trees in parks are the best source. Come back with 15 wood!', options: [
        { text: 'I\'ll chop away!', action: 'end' }
      ]}
    ]
  },
  { id: 'mission_wood_big_complete', npcName: 'Lumber Lisa', initialNode: 'start', missionId: 'collect_wood_15', requiresMission: true,
    nodes: [
      { id: 'start', npcText: 'That\'s quite a haul! Do you have all 15 wood?', options: [
        { text: 'Every last piece!', action: 'complete_mission', missionId: 'collect_wood_15' },
        { text: 'Almost there...', action: 'end' }
      ]}
    ]
  },
];

// Get a random conversation for an NPC (excluding mission-specific ones)
export function getRandomConversation(activeMissions: string[]): Conversation {
  const smallTalk = CONVERSATIONS.filter(c => !c.missionId && !c.requiresMission);
  return smallTalk[Math.floor(Math.random() * smallTalk.length)];
}

// Get conversation for a specific mission
export function getMissionConversation(missionId: string, hasMission: boolean): Conversation | null {
  if (hasMission) {
    // Player has the mission, show completion dialogue
    return CONVERSATIONS.find(c => c.missionId === missionId && c.requiresMission) || null;
  } else {
    // Player doesn't have mission, show acceptance dialogue
    return CONVERSATIONS.find(c => c.missionId === missionId && !c.requiresMission) || null;
  }
}

