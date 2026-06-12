import { Dimensions, Platform } from 'react-native';

export const { width: STATIC_WIDTH, height: STATIC_HEIGHT } = Dimensions.get('window');
export const TAB_BAR_OFFSET = Platform.OS === 'ios' ? 88 : 80;
export const CARD_HEIGHT = Math.round(STATIC_HEIGHT * (STATIC_HEIGHT < 750 ? 0.72 : 0.75));
export const ACTION_BUTTONS_BOTTOM = TAB_BAR_OFFSET + (STATIC_HEIGHT < 750 ? 12 : 20);
export const SWIPE_THRESHOLD = 90;

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
  gender_detail?: string;
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
  prompts?: {
    prompt_id: string;
    question: string;
    answer: string;
    is_custom: boolean;
  }[];
};
