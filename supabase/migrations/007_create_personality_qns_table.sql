-- Create personality_qns table to store personality questionnaire responses
CREATE TABLE personality_qns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Lifestyle Habits Section (5 questions)
  what_type_of_date_excites_you_the_most TEXT[],
  how_do_you_feel_about_trying_unusual_foods_or_activities TEXT,
  what_kind_of_conversations_do_you_enjoy_with_a_partner TEXT,
  what_best_describes_your_planning_style TEXT,
  how_do_you_handle_commitments_in_a_relationship TEXT,
  
  -- Personality Traits Section (5 questions)
  your_room_or_workspace_usually_looks_like TEXT,
  your_ideal_way_to_spend_time_with_a_partner TEXT,
  your_energy_level_on_dates_is_usually TEXT,
  you_prefer_a_partner_who_is TEXT,
  during_arguments_you_usually TEXT,
  
  -- Relationship Dynamics Section (5 questions)
  how_do_you_show_care_in_a_relationship TEXT,
  what_kind_of_partner_are_you TEXT,
  when_your_partner_replies_late_you_feel TEXT,
  how_do_you_handle_emotional_ups_and_downs TEXT,
  how_often_do_you_overthink_relationships TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create index on user_id for faster lookups
CREATE INDEX idx_personality_qns_user_id ON personality_qns(user_id);

-- Enable Row Level Security
ALTER TABLE personality_qns ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can view their own personality_qns data
CREATE POLICY "Users can view own personality_qns"
  ON personality_qns
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Users can insert their own personality_qns data
CREATE POLICY "Users can insert own personality_qns"
  ON personality_qns
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can update their own personality_qns data
CREATE POLICY "Users can update own personality_qns"
  ON personality_qns
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 4: Users can delete their own personality_qns data
CREATE POLICY "Users can delete own personality_qns"
  ON personality_qns
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_personality_qns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER personality_qns_updated_at_trigger
BEFORE UPDATE ON personality_qns
FOR EACH ROW
EXECUTE FUNCTION update_personality_qns_updated_at();
