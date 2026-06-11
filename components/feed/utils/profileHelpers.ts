import { Platform } from 'react-native';

// Re-exported Profile type (sourced from FeedScreen until Step 8 moves types)
// Keep in sync with the Profile interface in FeedScreen.tsx
export type Profile = {
  id: string | number;
  name: string;
  age?: number;
  location?: string;
  image: any;
  photos?: { uri: string }[];
  compatibility?: number;
  indian_score?: number;
  western_score?: number;
  personality_score?: number;
  indian_recommendation?: string | null;
  western_report?: string | null;
  final_score?: number;
  about_me?: string;
  interests?: string[];
  western_sign?: string;
  indian_sign?: string;
  looking_for?: string;
  relationship_status?: string;
  hobbies?: string[];
  height?: string;
  introvert_extrovert?: string;
  partner_preference?: string[];
  gender?: string;
  personality_detail?: {
    date_type?: string | string[];
    unusual_foods?: string;
    conversations?: string;
    planning_style?: string;
    commitments?: string;
    workspace?: string;
    spend_time?: string;
    energy_level?: string;
    partner_energy?: string;
    arguments?: string;
    show_care?: string;
    partner_type?: string;
    late_reply?: string;
    emotional_handling?: string;
    overthink?: string;
  };
};

export const getLabelForValue = (key: string, value: string): string => {
  if (!value) return '';
  const mapping: Record<string, Record<string, string>> = {
    'date_type': {
      'cafe-talk': 'A cozy café where we talk for hours',
      'explore': 'A random new place we decide to explore',
      'movie-dinner': 'A movie or simple dinner, nothing too wild',
      'road-trip': 'A totally spontaneous road trip',
    },
    'unusual_foods': {
      'stick-to-known': 'Nope, I like sticking to what I know',
      'try-if-encouraged': "I'll try if someone encourages me",
      'open-to-it': "Sounds fun, I'm open to it",
      'suggest-crazy': "I'm the one who suggests crazy ideas first",
    },
    'conversations': {
      'everyday-talks': 'Cute, simple, everyday talks',
      'goals-life': 'Goal & life-related discussions',
      'deep-philosophical': 'Deep emotional & philosophical chats',
      'creative-brainstorm': 'Random creative brainstorming at midnight',
    },
    'planning_style': {
      'go-with-flow': 'Go-with-the-flow',
      'plan-little': 'I plan a little',
      'organise-things': 'I like to organise things',
      'plan-dates-project': 'I plan dates like a mini project',
    },
    'commitments': {
      'forget-sometimes': 'I forget sometimes',
      'try-best': 'I try my best to remember',
      'responsible-steady': "I'm responsible and steady",
      'promise-do-it': "If I promise, I'll do it—no excuses",
    },
    'workspace': {
      'disaster-zone': 'A disaster zone',
      'manageable': 'Manageable',
      'clean-most-time': 'Clean most of the time',
      'organised-pinterest': 'Organised like Pinterest',
    },
    'spend_time': {
      'chill-home': 'Chill at home doing our own thing',
      'quiet-date': 'Quiet date with just the two of us',
      'fun-activities': 'Going out for fun activities',
      'big-social': 'Big social plans with friends',
    },
    'energy_level': {
      'low-key': 'Low-key, calm',
      'balanced': 'Balanced',
      'fun-energetic': 'Fun & energetic',
      'hyper-excitement': 'Hyper, full excitement',
    },
    'partner_energy': {
      'calm-introverted': 'Calm and introverted',
      'balanced-partner': 'Balanced',
      'outgoing': 'Outgoing',
      'super-social': 'Super social and lively',
    },
    'arguments': {
      'avoid-talking': 'Avoid talking',
      'calm-discuss': 'Calm down & then discuss',
      'understand-view': 'Try to understand their view',
      'solve-immediately': 'Solve it immediately with patience',
    },
    'show_care': {
      'small-gestures': 'Small gestures',
      'listening': 'Listening when needed',
      'emotional-support': 'Supporting them emotionally',
      'going-out-way': 'Going out of my way to make them feel loved',
    },
    'partner_type': {
      'independent': 'Independent',
      'supportive': 'Supportive',
      'empathetic': 'Empathetic',
      'soft-kind': 'Soft, kind, and comforting',
    },
    'late_reply': {
      'totally-fine': 'Totally fine',
      'slightly-curious': 'Slightly curious',
      'overthinking': 'A bit overthinking',
      'very-anxious': 'Very anxious',
    },
    'emotional_handling': {
      'rarely-stressed': 'I rarely feel stressed',
      'handle-okay': 'I handle things okay',
      'emotional-sometimes': 'I get emotional sometimes',
      'feel-deeply': 'I feel things very deeply',
    },
    'overthink': {
      'almost-never': 'Almost never',
      'occasionally': 'Occasionally',
      'quite-often': 'Quite often',
      'all-time': 'All the time',
    }
  };
  return mapping[key]?.[value] || value;
};

export const formatHobby = (hobby: string): string => {
  if (!hobby) return '';
  const mapping: Record<string, string> = {
    movies: 'Movies',
    travel: 'Travel',
    music: 'Music',
    gym: 'Fitness',
    reading: 'Reading',
    gaming: 'Gaming',
  };
  const lowered = hobby.toLowerCase().trim();
  if (mapping[lowered]) return mapping[lowered];
  return hobby.replace(/\b\w/g, c => c.toUpperCase());
};

export const getDynamicBio = (profile: Profile): string => {
  if (profile.about_me && profile.about_me.trim().length > 0) {
    return profile.about_me;
  }

  const parts: string[] = [];

  let introExtro = '';
  if (profile.introvert_extrovert) {
    const ie = profile.introvert_extrovert.toLowerCase();
    if (ie === 'introvert') introExtro = "an introvert";
    else if (ie === 'extrovert') introExtro = "an extrovert";
    else if (ie === 'ambivert') introExtro = "an ambivert";
    else if (ie.includes('mood') || ie === 'depends') introExtro = "someone whose energy depends on my mood";
  }

  let looking = '';
  if (profile.looking_for) {
    const lf = profile.looking_for.toLowerCase();
    if (lf === 'casual') looking = "something casual";
    else if (lf === 'long-term') looking = "a long-term relationship";
    else if (lf === 'friends') looking = "making friends";
    else if (lf === 'not-sure') looking = "figuring things out";
  }

  if (introExtro && looking) {
    parts.push(`I'm ${introExtro} looking for ${looking}.`);
  } else if (introExtro) {
    parts.push(`I'm ${introExtro}.`);
  } else if (looking) {
    parts.push(`I'm looking for ${looking}.`);
  }

  if (profile.partner_preference && profile.partner_preference.length > 0) {
    const traits = profile.partner_preference.map(t => t.toLowerCase());
    parts.push(`In a partner, I appreciate someone who is ${traits.join(', ')}.`);
  }

  const pd = profile.personality_detail;
  if (pd) {
    if (pd.date_type && pd.date_type.length > 0) {
      const dt = Array.isArray(pd.date_type) ? pd.date_type[0].toLowerCase() : (pd.date_type as string).toLowerCase();
      let dateText = '';
      if (dt.includes('cafe')) dateText = "enjoying a cozy café talking for hours";
      else if (dt.includes('explore')) dateText = "exploring random new places";
      else if (dt.includes('dinner')) dateText = "going for a simple dinner date";
      else if (dt.includes('road-trip') || dt.includes('trip')) dateText = "going on a spontaneous road trip";

      if (dateText) {
        parts.push(`My ideal first date involves ${dateText}.`);
      }
    }

    if (pd.conversations) {
      const conv = pd.conversations.toLowerCase();
      let convText = '';
      if (conv.includes('deep') || conv.includes('philosophical')) convText = "deep philosophical chats";
      else if (conv.includes('creative') || conv.includes('midnight')) convText = "midnight creative brainstorming";
      else if (conv.includes('goals')) convText = "discussing goals and life";
      else if (conv.includes('everyday')) convText = "simple everyday chats";

      if (convText) {
        parts.push(`I enjoy ${convText}.`);
      }
    }
  }

  if (parts.length > 0) {
    return parts.join(' ');
  }

  return "I love deep conversations, spontaneous adventures and meaningful connections. Let's create beautiful memories together ✨";
};

export const getPromptsForProfile = (profile: Profile): { question: string; answer: string }[] => {
  const pd = profile.personality_detail;
  const prompts: { question: string; answer: string }[] = [];

  if (pd) {
    if (pd.date_type && pd.date_type.length > 0) {
      prompts.push({
        question: "My perfect first date involves...",
        answer: getLabelForValue('date_type', Array.isArray(pd.date_type) ? pd.date_type[0] : pd.date_type)
      });
    }
    if (pd.conversations) {
      prompts.push({
        question: "My favorite late-night talks are...",
        answer: getLabelForValue('conversations', pd.conversations)
      });
    }
    if (pd.unusual_foods) {
      prompts.push({
        question: "When trying unusual foods or crazy ideas...",
        answer: getLabelForValue('unusual_foods', pd.unusual_foods)
      });
    }
    if (pd.spend_time) {
      prompts.push({
        question: "Our ideal quality time together would be...",
        answer: getLabelForValue('spend_time', pd.spend_time)
      });
    }
    if (pd.show_care) {
      prompts.push({
        question: "In a relationship, I show care by...",
        answer: getLabelForValue('show_care', pd.show_care)
      });
    }
    if (pd.planning_style && prompts.length < 5) {
      prompts.push({
        question: "Dating me means my planning style is...",
        answer: getLabelForValue('planning_style', pd.planning_style)
      });
    }
    if (pd.workspace && prompts.length < 5) {
      prompts.push({
        question: "My workspace or bedroom is usually...",
        answer: getLabelForValue('workspace', pd.workspace)
      });
    }
    if (pd.energy_level && prompts.length < 5) {
      prompts.push({
        question: "On our dates, my energy level is usually...",
        answer: getLabelForValue('energy_level', pd.energy_level)
      });
    }
    if (pd.arguments && prompts.length < 5) {
      prompts.push({
        question: "When we disagree or argue, I tend to...",
        answer: getLabelForValue('arguments', pd.arguments)
      });
    }
    if (pd.late_reply && prompts.length < 5) {
      prompts.push({
        question: "If you reply late, I will probably be...",
        answer: getLabelForValue('late_reply', pd.late_reply)
      });
    }
  }

  const zodiac = String(profile.western_sign || '').toLowerCase();

  let fallbackPrompts = [
    { question: "Dating me is like", answer: "Having a pet sloth — slow, cozy, and oddly addictive." },
    { question: "My zodiac green flag", answer: "I'll never ghost you — but I might send memes at 2am." },
    { question: "Together we could", answer: "Watch meteor showers, drink chai, and argue about astrology till sunrise." },
    { question: "We'll get along if", answer: "You believe in magic, or at least in the healing power of a good laugh." },
    { question: "My personal superpower", answer: "Finding the absolute best street food in any city I visit." }
  ];

  if (zodiac.includes('aries')) {
    fallbackPrompts = [
      { question: "Dating me is like", answer: "Chasing a shooting star — fast, thrilling, and you'll definitely need running shoes." },
      { question: "My zodiac green flag", answer: "I will fight for you like a true warrior, and I always order the best spicy food." },
      { question: "Together we could", answer: "Go on a midnight road trip to the mountains and blast our favorite rock playlist." },
      { question: "We'll get along if", answer: "You're ready for spontaneous adventures and don't mind a bit of friendly competition." },
      { question: "My personal superpower", answer: "Turning even the most mundane chores into an absolute party." }
    ];
  } else if (zodiac.includes('taurus')) {
    fallbackPrompts = [
      { question: "Dating me is like", answer: "A warm blanket fresh out of the dryer — comforting, luxurious, and hard to leave." },
      { question: "My zodiac green flag", answer: "I'll cook you a 3-course meal when you're stressed and remember exactly how you take your coffee." },
      { question: "Together we could", answer: "Visit local art galleries, buy too many indoor plants, and end the day at a hidden dessert spot." },
      { question: "We'll get along if", answer: "You appreciate good food, cozy vibes, and Sunday afternoon naps." },
      { question: "My personal superpower", answer: "Finding the most aesthetically pleasing cafes with the absolute best pastries." }
    ];
  } else if (zodiac.includes('gemini')) {
    fallbackPrompts = [
      { question: "Dating me is like", answer: "Having 20 browser tabs open at once — completely chaotic but never, ever boring." },
      { question: "My zodiac green flag", answer: "I can talk to anyone about anything, and I'll send you the absolute best podcast recommendations." },
      { question: "Together we could", answer: "Sneak into a museum after hours, debate philosophy, and write a parody song together." },
      { question: "We'll get along if", answer: "You can keep up with my rapid-fire thoughts and love sharing weird random facts." },
      { question: "My personal superpower", answer: "Having a recommendation for literally any movie, book, or podcast you ask for." }
    ];
  } else if (zodiac.includes('cancer')) {
    fallbackPrompts = [
      { question: "Dating me is like", answer: "Coming home after a long trip — instantly relaxing, deeply nostalgic, and full of cozy hugs." },
      { question: "My zodiac green flag", answer: "I hold onto memories like treasure, and I'll create a custom music playlist just for your mood." },
      { question: "Together we could", answer: "Bake chocolate chip cookies on a rainy afternoon and build the ultimate living room fort." },
      { question: "We'll get along if", answer: "You value emotional honesty, deep late-night chats, and home-cooked meals." },
      { question: "My personal superpower", answer: "Creating the coziest, most welcoming atmosphere wherever we go." }
    ];
  } else if (zodiac.includes('leo')) {
    fallbackPrompts = [
      { question: "Dating me is like", answer: "Being front row at a concert — high energy, sparkly, and you'll feel like a VIP." },
      { question: "My zodiac green flag", answer: "I am your biggest cheerleader and will hype you up to everyone we meet." },
      { question: "Together we could", answer: "Dress up in glamorous outfits for no reason and take aesthetic photos around the city." },
      { question: "We'll get along if", answer: "You match my energy, love being hyped up, and aren't afraid of the spotlight." },
      { question: "My personal superpower", answer: "Bringing warmth and confidence to everyone around me." }
    ];
  } else if (zodiac.includes('virgo')) {
    fallbackPrompts = [
      { question: "Dating me is like", answer: "A perfectly organized bookshelf — thoughtful, neat, and full of depth." },
      { question: "My zodiac green flag", answer: "I actually listen and remember the small details, like that book you mentioned once." },
      { question: "Together we could", answer: "Visit a quaint local bookstore, organize a picnic, and plan a weekend getaway." },
      { question: "We'll get along if", answer: "You appreciate small gestures of care and don't mind my love for organization." },
      { question: "My personal superpower", answer: "Solving complex problems in minutes that make others scratch their heads." }
    ];
  } else if (zodiac.includes('libra')) {
    fallbackPrompts = [
      { question: "Dating me is like", answer: "A beautifully curated museum gallery — aesthetic, balanced, and full of romantic vibes." },
      { question: "My zodiac green flag", answer: "I hate conflict and will always make sure we split the last slice of cake exactly 50/50." },
      { question: "Together we could", answer: "Explore architectural landmarks, buy matching vintage jackets, and try a new upscale cafe." },
      { question: "We'll get along if", answer: "You love art, beautiful spaces, and believe in keeping things balanced and harmonious." },
      { question: "My personal superpower", answer: "Creating a playlist that perfectly captures the vibe of any road trip." }
    ];
  } else if (zodiac.includes('scorpio')) {
    fallbackPrompts = [
      { question: "Dating me is like", answer: "A mystery novel you can't put down — intense, mysterious, and full of plot twists." },
      { question: "My zodiac green flag", answer: "My loyalty is absolute. Once you're in my circle, I will protect you fiercely." },
      { question: "Together we could", answer: "Share our deepest secrets under the night sky and investigate a local urban legend." },
      { question: "We'll get along if", answer: "You're not afraid of intensity, absolute loyalty, and searching for the truth." },
      { question: "My personal superpower", answer: "Reading the room instantly and knowing exactly what someone is feeling." }
    ];
  } else if (zodiac.includes('sagittarius')) {
    fallbackPrompts = [
      { question: "Dating me is like", answer: "Spinning a globe and booking a ticket on the spot — adventurous, wild, and unpredictable." },
      { question: "My zodiac green flag", answer: "I will always encourage you to think bigger and will make you laugh even in the worst situations." },
      { question: "Together we could", answer: "Backpack through a new country, eat street food, and get lost in a translation mishap." },
      { question: "We'll get along if", answer: "You have a passport ready and love discussing the meaning of life at 3am." },
      { question: "My personal superpower", answer: "Always finding the silver lining and making the entire room burst into laughter." }
    ];
  } else if (zodiac.includes('capricorn')) {
    fallbackPrompts = [
      { question: "Dating me is like", answer: "Investing in a premium vintage watch — timeless, reliable, and gets better with age." },
      { question: "My zodiac green flag", answer: "I keep my word, have a solid plan for the future, and will support your biggest ambitions." },
      { question: "Together we could", answer: "Set up a cozy home workspace, conquer a challenging hiking trail, and celebrate our wins." },
      { question: "We'll get along if", answer: "You're driven, appreciate dry humor, and have big goals for the future." },
      { question: "My personal superpower", answer: "Remaining calm and focused in the middle of any storm." }
    ];
  } else if (zodiac.includes('aquarius')) {
    fallbackPrompts = [
      { question: "Dating me is like", answer: "Visiting an indie sci-fi movie set — unconventional, intellectual, and slightly out of this world." },
      { question: "My zodiac green flag", answer: "I love your weird quirks, and I'll engage in a 3-hour conversation about aliens without blinking." },
      { question: "Together we could", answer: "Attend an astronomy lecture, protest for a local cause, and build a DIY telescope." },
      { question: "We'll get along if", answer: "You embrace your unique quirks and love debating deep, unconventional topics." },
      { question: "My personal superpower", answer: "Thinking completely outside the box and finding creative solutions." }
    ];
  } else if (zodiac.includes('pisces')) {
    fallbackPrompts = [
      { question: "Dating me is like", answer: "Having a pet sloth — slow, cozy, and oddly addictive." },
      { question: "My zodiac green flag", answer: "I'll never ghost you — but I might send memes at 2am." },
      { question: "Together we could", answer: "Watch meteor showers, drink chai, and argue about astrology till sunrise." },
      { question: "We'll get along if", answer: "You believe in magic, or at least in the healing power of a good laugh." },
      { question: "My personal superpower", answer: "Finding the absolute best street food in any city I visit." }
    ];
  }

  const mergedPrompts = [...prompts];
  while (mergedPrompts.length < 5) {
    const nextFallback = fallbackPrompts[mergedPrompts.length];
    if (!nextFallback) break;
    mergedPrompts.push(nextFallback);
  }
  return mergedPrompts;
};

export const getTagsForProfile = (profile: Profile): string[] => {
  const tags: string[] = [];
  const name = String(profile.name || '').toLowerCase();

  if (name.includes('tejaswini') || name.includes('priya') || name.includes('rahul') || name.includes('aditya') || name.includes('karthik')) {
    tags.push("Hindu");
  } else if (name.includes('zoya') || name.includes('kabir') || name.includes('ali')) {
    tags.push("Muslim");
  } else if (name.includes('gurpreet') || name.includes('harpreet') || name.includes('singh')) {
    tags.push("Sikh");
  } else {
    tags.push("Spiritual");
  }

  tags.push("Straight");

  const lookingForMap: Record<string, string> = {
    'casual': 'Casual Fun',
    'long-term': 'Life partner',
    'friends': 'New Friends',
    'not-sure': 'Not Sure',
    'marriage': 'Life partner',
  };
  const lookingFor = String(profile.looking_for || '').toLowerCase();
  tags.push(lookingForMap[lookingFor] || 'Life partner');
  tags.push(profile.relationship_status || "Monogamy");

  const loc = String(profile.location || '').toLowerCase();
  if (loc.includes('chennai') || loc.includes('bangalore') || loc.includes('hyderabad') || loc.includes('coimbatore') || loc.includes('kerala')) {
    tags.push("South Indian");
  } else if (loc.includes('delhi') || loc.includes('punjab') || loc.includes('haryana') || loc.includes('jaipur')) {
    tags.push("North Indian");
  } else if (loc.includes('mumbai') || loc.includes('pune') || loc.includes('gujarat')) {
    tags.push("West Indian");
  } else if (loc.includes('kolkata') || loc.includes('assam') || loc.includes('bihar')) {
    tags.push("East Indian");
  } else {
    tags.push("Indian");
  }

  return tags;
};

// ── Zodiac symbol helper (used inside ProfileCard) ────────────────────────────
export const getZodiacSymbol = (sign?: string): string => {
  const name = String(sign || '').toLowerCase();
  if (name.includes('aries')) return '♈';
  if (name.includes('taurus')) return '♉';
  if (name.includes('gemini')) return '♊';
  if (name.includes('cancer')) return '♋';
  if (name.includes('leo')) return '♌';
  if (name.includes('virgo')) return '♍';
  if (name.includes('libra')) return '♎';
  if (name.includes('scorpio')) return '♏';
  if (name.includes('sagittarius')) return '♐';
  if (name.includes('capricorn')) return '♑';
  if (name.includes('aquarius')) return '♒';
  if (name.includes('pisces')) return '♓';
  return '✨';
};

export const getInterestIcon = (interest: string): string => {
  const name = interest.toLowerCase().trim();
  if (name.includes('travel')) return 'flight';
  if (name.includes('music')) return 'music-note';
  if (name.includes('coffee') || name.includes('tea') || name.includes('food') || name.includes('drink') || name.includes('cafe')) return 'local-cafe';
  if (name.includes('astrology') || name.includes('stars') || name.includes('cosmic') || name.includes('spiritual')) return 'auto-awesome';
  if (name.includes('movie') || name.includes('film') || name.includes('show') || name.includes('series')) return 'movie';
  if (name.includes('book') || name.includes('read')) return 'book';
  if (name.includes('sport') || name.includes('run') || name.includes('gym') || name.includes('fitness') || name.includes('basketball') || name.includes('tennis')) return 'fitness-center';
  if (name.includes('gaming') || name.includes('game')) return 'sports-esports';
  if (name.includes('cooking')) return 'restaurant';
  if (name.includes('yoga')) return 'self-improvement';
  if (name.includes('dance') || name.includes('dancing')) return 'celebration';
  if (name.includes('photo')) return 'photo-camera';
  if (name.includes('art')) return 'palette';
  if (name.includes('hiking')) return 'terrain';
  if (name.includes('swim')) return 'pool';
  return 'star-border';
};

export const getLookingForText = (intent?: string): string => {
  const name = String(intent || '').trim().toLowerCase();
  if (name === 'casual') return 'Casual Fun';
  if (name === 'long-term') return 'Long Term';
  if (name === 'friends') return 'New Friends';
  if (name === 'not-sure') return 'Not Sure';
  if (name.includes('love') || name === 'relationship') return 'Looking for Love';
  return intent || 'Looking for Love';
};

export const resolvePhotoSource = (photo: any): any => {
  if (!photo) return require('@/assets/images/avatar-placeholder.png');
  if (typeof photo === 'string') return { uri: photo };
  if (typeof photo === 'object' && photo.uri) return { uri: photo.uri };
  return photo;
};

// Unused in profileHelpers itself; re-exported for consumers
export { Platform };
