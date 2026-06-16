import { Profile } from '@/types/profile';

// Mock values based on the Sun Sign to provide rich UI data for Astrology Insights.
const ASTRO_MOCKS: Record<string, { strengths: string[]; challenges: string[]; loveStyle: string }> = {
  Pisces: {
    strengths: ['Loyal', 'Caring', 'Romantic', 'Intuitive'],
    challenges: ['Overthinks', 'Too sensitive', 'Takes things to heart'],
    loveStyle: 'Deeply emotional and loyal. You love deeply and expect the same in return.',
  },
  Aries: {
    strengths: ['Passionate', 'Direct', 'Courageous', 'Optimistic'],
    challenges: ['Impulsive', 'Impatient', 'Short-tempered'],
    loveStyle: 'Fierce and passionate. You bring excitement and expect adventure.',
  },
  Taurus: {
    strengths: ['Reliable', 'Patient', 'Devoted', 'Stable'],
    challenges: ['Stubborn', 'Possessive', 'Uncompromising'],
    loveStyle: 'Grounded and sensual. You seek stability and comfort in relationships.',
  },
  Gemini: {
    strengths: ['Adaptable', 'Curious', 'Affectionate', 'Witty'],
    challenges: ['Inconsistent', 'Indecisive', 'Restless'],
    loveStyle: 'Intellectual and playful. Communication is your main love language.',
  },
  Cancer: {
    strengths: ['Nurturing', 'Compassionate', 'Protective', 'Loyal'],
    challenges: ['Moody', 'Pessimistic', 'Clingy'],
    loveStyle: 'Deeply caring and protective. You look for emotional security.',
  },
  Leo: {
    strengths: ['Generous', 'Warm-hearted', 'Cheerful', 'Humorous'],
    challenges: ['Arrogant', 'Stubborn', 'Inflexible'],
    loveStyle: 'Grand and passionate. You love to shower your partner with affection.',
  },
  Virgo: {
    strengths: ['Loyal', 'Analytical', 'Kind', 'Hardworking'],
    challenges: ['Overly critical', 'Worrier', 'All work, no play'],
    loveStyle: 'Practical and devoted. Acts of service show your true feelings.',
  },
  Libra: {
    strengths: ['Diplomatic', 'Gracious', 'Fair-minded', 'Social'],
    challenges: ['Indecisive', 'Avoids confrontations', 'People-pleaser'],
    loveStyle: 'Romantic and harmonious. You thrive in balanced partnerships.',
  },
  Scorpio: {
    strengths: ['Resourceful', 'Brave', 'Passionate', 'True friend'],
    challenges: ['Jealous', 'Secretive', 'Fierce'],
    loveStyle: 'Intense and transformative. You seek profound soul connections.',
  },
  Sagittarius: {
    strengths: ['Generous', 'Idealistic', 'Great sense of humor', 'Honest'],
    challenges: ['Promises more than can deliver', 'Impatient', 'Blunt'],
    loveStyle: 'Adventurous and free-spirited. You need a partner who is also a friend.',
  },
  Capricorn: {
    strengths: ['Responsible', 'Disciplined', 'Self-control', 'Ambitious'],
    challenges: ['Know-it-all', 'Unforgiving', 'Condescending'],
    loveStyle: 'Traditional and committed. You build solid foundations for the future.',
  },
  Aquarius: {
    strengths: ['Progressive', 'Original', 'Independent', 'Humanitarian'],
    challenges: ['Runs from emotional expression', 'Temperamental', 'Aloof'],
    loveStyle: 'Unconventional and intellectual. Friendship is the base of your love.',
  },
};

export const getAstrologyInsights = (westernSign?: string) => {
  if (!westernSign || !ASTRO_MOCKS[westernSign]) {
    // Default fallback
    return {
      strengths: ['Loyal', 'Caring', 'Intuitive'],
      challenges: ['Overthinks', 'Takes things to heart'],
      loveStyle: 'Deeply emotional and loyal. Expects the same in return.',
    };
  }
  return ASTRO_MOCKS[westernSign];
};

export const getCompatibilitySubScores = (profile: Profile) => {
  // Use existing scores or derive from final_score to simulate Emotional, Communication, Values
  let baseScore = profile.final_score ?? profile.indian_score ?? profile.western_score;
  
  if (!baseScore) {
    // Generate a stable pseudo-random number between 75 and 98 based on the profile ID
    const idHash = profile.id ? String(profile.id).split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) : 85;
    baseScore = 75 + (idHash % 24);
  }
  
  return {
    overall: baseScore,
    emotional: profile.personality_score ?? Math.min(99, Math.round(baseScore * 1.05)),
    communication: profile.western_score ?? Math.min(98, Math.round(baseScore * 0.95)),
    values: profile.indian_score ?? Math.min(99, Math.round(baseScore * 1.02)),
  };
};
