export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Row<T> = T;
type Insert<TRequired extends object, TOptional extends object = object> = TRequired & {
  [K in keyof TOptional]?: TOptional[K];
};
type Update<T> = Partial<T>;

export type Tables<
  TableName extends keyof Database["public"]["Tables"],
> = Database["public"]["Tables"][TableName]["Row"];

export type TablesInsert<
  TableName extends keyof Database["public"]["Tables"],
> = Database["public"]["Tables"][TableName]["Insert"];

export type TablesUpdate<
  TableName extends keyof Database["public"]["Tables"],
> = Database["public"]["Tables"][TableName]["Update"];

export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: Row<{
          id: string;
          user_id: string;
          phone_number: string;
          full_name: string;
          email: string;
          gender: string | null;
          gender_detail: string | null;
          location: string | null;
          plan_type: string | null;
          personality_vector: string | number[] | null;
          sexual_orientation: string | null;
          created_at: string | null;
          updated_at: string | null;
        }>;
        Insert: Insert<{
          user_id: string;
          phone_number: string;
          full_name: string;
          email: string;
        }, {
          id: string;
          gender: string | null;
          gender_detail: string | null;
          location: string | null;
          plan_type: string | null;
          personality_vector: string | number[] | null;
          sexual_orientation: string | null;
          created_at: string | null;
          updated_at: string | null;
        }>;
        Update: Update<Database["public"]["Tables"]["user_profiles"]["Row"]>;
        Relationships: [];
      };
      astro_details: {
        Row: Row<{
          id: string;
          user_id: string;
          birth_date: string;
          birth_time: string;
          birth_location: string;
          birth_latitude: number | null;
          birth_longitude: number | null;
          birth_timezone: string | null;
          western_sign: string | null;
          indian_sign: string | null;
          nakshatra_name: string | null;
          venus_sign: string | null;
          mars_sign: string | null;
          mercury_sign: string | null;
          rising_sign: string | null;
          dominant_element: string | null;
          chart_json: Json | null;
          moon_sign: string | null;
          created_at: string | null;
          updated_at: string | null;
        }>;
        Insert: Insert<{
          user_id: string;
          birth_date: string;
          birth_time: string;
          birth_location: string;
        }, Omit<Database["public"]["Tables"]["astro_details"]["Row"], "user_id" | "birth_date" | "birth_time" | "birth_location">>;
        Update: Update<Database["public"]["Tables"]["astro_details"]["Row"]>;
        Relationships: [];
      };
      user_photos: {
        Row: Row<{
          id: string;
          user_id: string | null;
          photo_url: string;
          storage_path: string | null;
          thumbnail_url: string | null;
          display_order: number | null;
          is_primary: boolean | null;
          created_at: string | null;
        }>;
        Insert: Insert<{ photo_url: string }, {
          id: string;
          user_id: string | null;
          display_order: number | null;
          storage_path: string | null;
          thumbnail_url: string | null;
          is_primary: boolean | null;
          created_at: string | null;
        }>;
        Update: Update<Database["public"]["Tables"]["user_photos"]["Row"]>;
        Relationships: [];
      };
      "user-photos": Database["public"]["Tables"]["user_photos"];
      section1_qns: {
        Row: Row<{
          id: string;
          user_id: string;
          interest: string[] | null;
          looking_for: string | null;
          relationship_status: string | null;
          hobbies: string[] | null;
          height: string | null;
          introvert_extrovert: string | null;
          partner_preference: string[] | null;
          created_at: string | null;
          updated_at: string | null;
        }>;
        Insert: Insert<{ user_id: string }, Omit<Database["public"]["Tables"]["section1_qns"]["Row"], "user_id">>;
        Update: Update<Database["public"]["Tables"]["section1_qns"]["Row"]>;
        Relationships: [];
      };
      onboarding_responses: {
        Row: Row<{
          id: string;
          user_id: string;
          about_me: string | null;
          interests: string[] | string | null;
          languages: string[] | null;
          language: string[] | string | null;
          education: string | null;
          drinking: string | null;
          smoking: string | null;
          created_at: string | null;
          updated_at: string | null;
        }>;
        Insert: Insert<{ user_id: string }, Omit<Database["public"]["Tables"]["onboarding_responses"]["Row"], "user_id">>;
        Update: Update<Database["public"]["Tables"]["onboarding_responses"]["Row"]>;
        Relationships: [];
      };
      user_preferences: {
        Row: Row<{
          user_id: string;
          min_age: number;
          max_age: number;
          max_distance: number;
          new_match_notifications: boolean;
          location: string | null;
          gender_preference: string | null;
          sexual_orientation: string | null;
          preferred_elements: string[] | null;
          blocked_signs: string[] | null;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Insert<{ user_id: string }, Omit<Database["public"]["Tables"]["user_preferences"]["Row"], "user_id">>;
        Update: Update<Database["public"]["Tables"]["user_preferences"]["Row"]>;
        Relationships: [];
      };
      messages: {
        Row: Row<{
          id: string;
          sender_id: string | null;
          receiver_id: string | null;
          message_text: string | null;
          is_read: boolean | null;
          channel_id: string | null;
          is_reported: boolean | null;
          moderation_status: string | null;
          created_at: string | null;
        }>;
        Insert: Insert<object, Omit<Database["public"]["Tables"]["messages"]["Row"], "id" | "created_at"> & { id: string; created_at: string | null }>;
        Update: Update<Database["public"]["Tables"]["messages"]["Row"]>;
        Relationships: [];
      };
      user_likes: {
        Row: Row<{
          id: string;
          user_id: string;
          liked_user_id: string;
          action_type: "like" | "dislike" | "super_like";
          note: string | null;
          photo_index: number | null;
          created_at: string | null;
          updated_at: string | null;
        }>;
        Insert: Insert<{
          user_id: string;
          liked_user_id: string;
          action_type: "like" | "dislike" | "super_like";
        }, {
          id: string;
          note: string | null;
          photo_index: number | null;
          created_at: string | null;
          updated_at: string | null;
        }>;
        Update: Update<Database["public"]["Tables"]["user_likes"]["Row"]>;
        Relationships: [];
      };
      user_matches: {
        Row: Row<{
          id: string;
          user1_id: string;
          user2_id: string;
          channel_id: string;
          icebreaker_text: string | null;
          icebreaker_generated_at: string | null;
          matched_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        }>;
        Insert: Insert<{ user1_id: string; user2_id: string; channel_id: string }, Omit<Database["public"]["Tables"]["user_matches"]["Row"], "user1_id" | "user2_id" | "channel_id">>;
        Update: Update<Database["public"]["Tables"]["user_matches"]["Row"]>;
        Relationships: [];
      };
      user_online_status: {
        Row: Row<{ user_id: string; is_online: boolean; last_seen: string; updated_at: string | null }>;
        Insert: Insert<{ user_id: string }, Omit<Database["public"]["Tables"]["user_online_status"]["Row"], "user_id">>;
        Update: Update<Database["public"]["Tables"]["user_online_status"]["Row"]>;
        Relationships: [];
      };
      plan_catalog: {
        Row: Row<{
          id: string;
          plan_slug: string;
          plan_name: string;
          plan_badge: string;
          amount_paise: number;
          interval: "monthly" | "annual" | "lifetime" | null;
          features: Json;
          is_active: boolean;
          created_at: string | null;
        }>;
        Insert: Insert<{ plan_slug: string; plan_name: string; plan_badge: string }, Omit<Database["public"]["Tables"]["plan_catalog"]["Row"], "plan_slug" | "plan_name" | "plan_badge">>;
        Update: Update<Database["public"]["Tables"]["plan_catalog"]["Row"]>;
        Relationships: [];
      };
      user_subscriptions: {
        Row: Row<{
          id: string;
          user_id: string;
          plan_id: string;
          status: "incomplete" | "active" | "past_due" | "canceled" | "expired";
          razorpay_payment_link_id: string | null;
          razorpay_payment_id: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          created_at: string | null;
          updated_at: string | null;
        }>;
        Insert: Insert<{ user_id: string; plan_id: string }, Omit<Database["public"]["Tables"]["user_subscriptions"]["Row"], "user_id" | "plan_id">>;
        Update: Update<Database["public"]["Tables"]["user_subscriptions"]["Row"]>;
        Relationships: [];
      };
      processed_razorpay_webhooks: {
        Row: Row<{
          id: string;
          webhook_event_id: string;
          event_type: string;
          payment_id: string | null;
          order_id: string | null;
          payment_link_id: string | null;
          user_id: string | null;
          plan_id: string | null;
          payload_hash: string;
          processed_at: string;
          created_at: string;
        }>;
        Insert: Insert<{ webhook_event_id: string; event_type: string; payload_hash: string }, Omit<Database["public"]["Tables"]["processed_razorpay_webhooks"]["Row"], "webhook_event_id" | "event_type" | "payload_hash">>;
        Update: Update<Database["public"]["Tables"]["processed_razorpay_webhooks"]["Row"]>;
        Relationships: [];
      };
      reports: {
        Row: Row<{ id: string; reporter_id: string | null; reported_user_id: string | null; channel_id: string | null; category: string | null; subcategory: string | null; details: string | null; status: string | null; created_at: string | null }>;
        Insert: Insert<object, Database["public"]["Tables"]["reports"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["reports"]["Row"]>;
        Relationships: [];
      };
      swipe_actions: {
        Row: Row<{ id: string; swiper_id: string | null; swiped_id: string | null; action_type: string | null; created_at: string | null }>;
        Insert: Insert<object, Database["public"]["Tables"]["swipe_actions"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["swipe_actions"]["Row"]>;
        Relationships: [];
      };
      daily_picks: {
        Row: Row<{ id: string; user_id: string; picked_user_id: string; astro_score: number | null; pick_date: string }>;
        Insert: Insert<{ user_id: string; picked_user_id: string }, Omit<Database["public"]["Tables"]["daily_picks"]["Row"], "user_id" | "picked_user_id">>;
        Update: Update<Database["public"]["Tables"]["daily_picks"]["Row"]>;
        Relationships: [];
      };
      shooting_star_log: {
        Row: Row<{ id: string; user_id: string; target_id: string; sent_at: string | null }>;
        Insert: Insert<{ user_id: string; target_id: string }, { id: string; sent_at: string | null }>;
        Update: Update<Database["public"]["Tables"]["shooting_star_log"]["Row"]>;
        Relationships: [];
      };
      super_like_quota: {
        Row: Row<{ user_id: string; quota_date: string; used_count: number; updated_at: string | null }>;
        Insert: Insert<{ user_id: string }, Omit<Database["public"]["Tables"]["super_like_quota"]["Row"], "user_id">>;
        Update: Update<Database["public"]["Tables"]["super_like_quota"]["Row"]>;
        Relationships: [];
      };
      astro_events: {
        Row: Row<{ id: number; event_type: string; event_name: string; start_date: string; end_date: string; description: string | null; ui_config: Json | null; created_at: string | null }>;
        Insert: Insert<{ event_type: string; event_name: string; start_date: string; end_date: string }, Omit<Database["public"]["Tables"]["astro_events"]["Row"], "event_type" | "event_name" | "start_date" | "end_date">>;
        Update: Update<Database["public"]["Tables"]["astro_events"]["Row"]>;
        Relationships: [];
      };
      synastry_cache_details: {
        Row: Row<{ user_a_id: string; user_b_id: string; sun_score: number | null; moon_score: number | null; venus_score: number | null; mars_score: number | null; mercury_score: number | null; dominant_element_match: boolean | null; compatibility_summary: string | null; badges: Json | null; computed_at: string | null; is_stale: boolean }>;
        Insert: Insert<{ user_a_id: string; user_b_id: string }, Omit<Database["public"]["Tables"]["synastry_cache_details"]["Row"], "user_a_id" | "user_b_id">>;
        Update: Update<Database["public"]["Tables"]["synastry_cache_details"]["Row"]>;
        Relationships: [];
      };
      synastry_cache: {
        Row: Row<{ id: string; user_a_id: string; user_b_id: string; astro_score: number | null; signal_score: number | null; computed_at: string | null; is_stale: boolean }>;
        Insert: Insert<{ user_a_id: string; user_b_id: string }, Omit<Database["public"]["Tables"]["synastry_cache"]["Row"], "user_a_id" | "user_b_id">>;
        Update: Update<Database["public"]["Tables"]["synastry_cache"]["Row"]>;
        Relationships: [];
      };
      synastry_prewarm_jobs: {
        Row: Row<{ id: string; user_id: string; candidate_user_id: string; pair_a_id: string; pair_b_id: string; status: "pending" | "processing" | "processed" | "failed"; retry_count: number; last_error: string | null; created_at: string; processed_at: string | null }>;
        Insert: Insert<{ user_id: string; candidate_user_id: string }, Omit<Database["public"]["Tables"]["synastry_prewarm_jobs"]["Row"], "user_id" | "candidate_user_id" | "pair_a_id" | "pair_b_id">>;
        Update: Update<Database["public"]["Tables"]["synastry_prewarm_jobs"]["Row"]>;
        Relationships: [];
      };
      user_push_tokens: {
        Row: Row<{ id: string; user_id: string; expo_push_token: string; platform: "ios" | "android" | "web" | "unknown"; device_id: string | null; last_seen_at: string; created_at: string; updated_at: string; is_active: boolean }>;
        Insert: Insert<{ user_id: string; expo_push_token: string }, Omit<Database["public"]["Tables"]["user_push_tokens"]["Row"], "user_id" | "expo_push_token">>;
        Update: Update<Database["public"]["Tables"]["user_push_tokens"]["Row"]>;
        Relationships: [];
      };
      user_notification_preferences: {
        Row: Row<{ user_id: string; new_matches_enabled: boolean; new_messages_enabled: boolean; marketing_enabled: boolean; quiet_hours_start: string | null; quiet_hours_end: string | null; created_at: string; updated_at: string }>;
        Insert: Insert<{ user_id: string }, Omit<Database["public"]["Tables"]["user_notification_preferences"]["Row"], "user_id">>;
        Update: Update<Database["public"]["Tables"]["user_notification_preferences"]["Row"]>;
        Relationships: [];
      };
      notification_delivery_logs: {
        Row: Row<{ id: string; user_id: string; notification_type: "new_match" | "new_message" | "marketing"; reference_id: string; dedupe_key: string; title: string; body: string; payload: Json; status: "pending" | "processing" | "sent" | "failed" | "skipped"; attempt_count: number; next_attempt_at: string; expo_ticket_ids: string[] | null; expo_receipt_ids: string[] | null; error_message: string | null; sent_at: string | null; created_at: string; updated_at: string }>;
        Insert: Insert<{ user_id: string; notification_type: "new_match" | "new_message" | "marketing"; reference_id: string; dedupe_key: string; title: string; body: string }, Omit<Database["public"]["Tables"]["notification_delivery_logs"]["Row"], "user_id" | "notification_type" | "reference_id" | "dedupe_key" | "title" | "body">>;
        Update: Update<Database["public"]["Tables"]["notification_delivery_logs"]["Row"]>;
        Relationships: [];
      };
      user_signals: {
        Row: Row<{ id: string; viewer_id: string; target_id: string; signal_type: string; score: number | null; created_at: string | null }>;
        Insert: Insert<{ viewer_id: string; target_id: string; signal_type: string }, Omit<Database["public"]["Tables"]["user_signals"]["Row"], "viewer_id" | "target_id" | "signal_type">>;
        Update: Update<Database["public"]["Tables"]["user_signals"]["Row"]>;
        Relationships: [];
      };
      signal_weight_config: {
        Row: Row<{ signal_type: string; weight: number; updated_at: string | null }>;
        Insert: Insert<{ signal_type: string; weight: number }, { updated_at: string | null }>;
        Update: Update<Database["public"]["Tables"]["signal_weight_config"]["Row"]>;
        Relationships: [];
      };
      ai_usage_tracking: {
        Row: Row<{ user_id: string; endpoint: string; usage_date: string; count: number; updated_at: string | null }>;
        Insert: Insert<{ user_id: string; endpoint: string }, Omit<Database["public"]["Tables"]["ai_usage_tracking"]["Row"], "user_id" | "endpoint">>;
        Update: Update<Database["public"]["Tables"]["ai_usage_tracking"]["Row"]>;
        Relationships: [];
      };
      western_zodiac_compatibility: {
        Row: Row<{ sign_a: string; sign_b: string; score: number; report: string | null }>;
        Insert: Insert<{ sign_a: string; sign_b: string; score: number }, { report: string | null }>;
        Update: Update<Database["public"]["Tables"]["western_zodiac_compatibility"]["Row"]>;
        Relationships: [];
      };
      Indian_zodiac_match_scores: {
        Row: Row<{ nakshatra_a: string; nakshatra_b: string; score: number; recommendation: string | null }>;
        Insert: Insert<{ nakshatra_a: string; nakshatra_b: string; score: number }, { recommendation: string | null }>;
        Update: Update<Database["public"]["Tables"]["Indian_zodiac_match_scores"]["Row"]>;
        Relationships: [];
      };
      personality_qns: {
        Row: Row<{
          id: string;
          user_id: string;
          answers: Json | null;
          what_type_of_date_excites_you_the_most: string[] | null;
          how_do_you_feel_about_trying_unusual_foods_or_activities: string | null;
          what_kind_of_conversations_do_you_enjoy_with_a_partner: string | null;
          what_best_describes_your_planning_style: string | null;
          how_do_you_handle_commitments_in_a_relationship: string | null;
          your_room_or_workspace_usually_looks_like: string | null;
          your_ideal_way_to_spend_time_with_a_partner: string | null;
          your_energy_level_on_dates_is_usually: string | null;
          you_prefer_a_partner_who_is: string | null;
          during_arguments_you_usually: string | null;
          how_do_you_show_care_in_a_relationship: string | null;
          what_kind_of_partner_are_you: string | null;
          when_your_partner_replies_late_you_feel: string | null;
          how_do_you_handle_emotional_ups_and_downs: string | null;
          how_often_do_you_overthink_relationships: string | null;
          created_at: string | null;
          updated_at: string | null;
        }>;
        Insert: Insert<{ user_id: string }, Omit<Database["public"]["Tables"]["personality_qns"]["Row"], "user_id">>;
        Update: Update<Database["public"]["Tables"]["personality_qns"]["Row"]>;
        Relationships: [];
      };
      aadhar_verification: {
        Row: Row<{ id: string; user_id: string; created_at: string | null; updated_at: string | null }>;
        Insert: Insert<{ user_id: string }, Omit<Database["public"]["Tables"]["aadhar_verification"]["Row"], "user_id">>;
        Update: Update<Database["public"]["Tables"]["aadhar_verification"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      check_auth_user_exists: {
        Args: { input_phone: string };
        Returns: { user_id: string; phone_number: string; full_name: string; email: string }[];
      };
      check_phone_exists: {
        Args: { p_phone?: string; input_phone?: string };
        Returns: { user_id: string; phone_number: string; full_name: string }[];
      };
      get_final_matches: {
        Args: { input_user_id: string };
        Returns: {
          match_user_id: string;
          full_name: string;
          gender: string;
          age: number;
          location: string;
          personality_score: number | string;
          indian_score: number | string;
          western_score: number | string;
          final_match_score: number | string;
          indian_recommendation: string | null;
          western_report: string | null;
          personality_vector: string | number[] | null;
        }[];
      };
      get_fallback_feed: Database["public"]["Functions"]["get_final_matches"];
      enqueue_synastry_prewarm: {
        Args: { p_user_id: string };
        Returns: { enqueued_count: number }[];
      };
      claim_synastry_prewarm_jobs: {
        Args: { p_limit?: number };
        Returns: { id: string; user_id: string; candidate_user_id: string; retry_count: number }[];
      };
      process_synastry_prewarm_job: {
        Args: { p_job_id: string };
        Returns: Json;
      };
      register_push_token: {
        Args: { p_expo_push_token: string; p_platform?: string; p_device_id?: string | null };
        Returns: string;
      };
      revoke_push_token: {
        Args: { p_expo_push_token?: string | null; p_device_id?: string | null };
        Returns: number;
      };
      update_notification_preferences: {
        Args: {
          p_new_matches_enabled?: boolean | null;
          p_new_messages_enabled?: boolean | null;
          p_marketing_enabled?: boolean | null;
          p_quiet_hours_start?: string | null;
          p_quiet_hours_end?: string | null;
        };
        Returns: Database["public"]["Tables"]["user_notification_preferences"]["Row"];
      };
      claim_notification_delivery_logs: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          user_id: string;
          notification_type: "new_match" | "new_message" | "marketing";
          reference_id: string;
          title: string;
          body: string;
          payload: Json;
          attempt_count: number;
        }[];
      };
      get_synastry_detail: {
        Args: { user_x: string; user_y: string };
        Returns: {
          sun_score: number | null;
          moon_score: number | null;
          venus_score: number | null;
          mars_score: number | null;
          mercury_score: number | null;
          dominant_element_match: boolean | null;
          compatibility_summary: string | null;
          badges: Json | null;
          computed_at: string | null;
          ashtakoota_score: number | null;
          ashtakoota_detail: Json | null;
        }[];
      };
      get_active_astro_events: {
        Args: Record<string, never>;
        Returns: Database["public"]["Tables"]["astro_events"]["Row"][];
      };
      get_my_membership: {
        Args: Record<string, never>;
        Returns: Json;
      };
      consume_super_like: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      consume_like: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      get_super_likes_remaining: {
        Args: { p_user_id: string };
        Returns: number;
      };
      get_likes_remaining: {
        Args: { p_user_id: string };
        Returns: number;
      };
      get_my_daily_pick: {
        Args: Record<string, never>;
        Returns: Json;
      };
      get_standouts: {
        Args: { input_user_id: string };
        Returns: {
          match_user_id: string;
          full_name: string;
          gender: string;
          location: string;
          astro_score: number;
          western_sign: string | null;
          dominant_element: string | null;
        }[];
      };
      delete_old_messages: {
        Args: Record<string, never>;
        Returns: { deleted_count: number; conversations_processed: number }[];
      };
      get_user_presence: {
        Args: { p_target_user_id: string };
        Returns: { user_id: string; is_online: boolean; last_seen: string }[];
      };
      get_matched_user_presence: {
        Args: { p_target_user_ids: string[] };
        Returns: { user_id: string; is_online: boolean; last_seen: string }[];
      };
      record_signal: {
        Args: { p_viewer_id: string; p_target_id: string; p_signal_type: string; p_score?: number };
        Returns: undefined;
      };
      get_signal_score: {
        Args: { p_viewer_id: string; p_target_id: string };
        Returns: number;
      };
      process_razorpay_payment_link_paid: {
        Args: {
          p_webhook_event_id: string;
          p_payment_id: string | null;
          p_order_id: string | null;
          p_payment_link_id: string;
          p_user_id: string;
          p_plan_id: string;
          p_payload_hash: string;
        };
        Returns: Json;
      };
      increment_ai_usage: {
        Args: { p_user: string; p_endpoint: string; p_limit: number };
        Returns: boolean;
      };
      get_sign_compatibility: {
        Args: { sign_a: string; sign_b: string };
        Returns: number;
      };
      cancel_my_subscription: {
        Args: Record<string, never>;
        Returns: Json;
      };
      sync_ios_subscription: {
        Args: { entitlement_id: string };
        Returns: boolean;
      };
      get_astro_for_ranking: {
        Args: { p_user_id: string };
        Returns: Pick<
          Database["public"]["Tables"]["astro_details"]["Row"],
          "western_sign" | "indian_sign" | "nakshatra_name" | "venus_sign" | "mars_sign" | "mercury_sign" | "rising_sign" | "dominant_element"
        >[];
      };
      compute_astro_score: {
        Args: { user_a: string; user_b: string };
        Returns: number;
      };
      compute_personality_score: {
        Args: { user_a: string; user_b: string };
        Returns: number;
      };
      get_user_display_name: {
        Args: { p_target_user_id: string };
        Returns: { user_id: string; full_name: string }[];
      };
      get_users_display_info: {
        Args: { p_target_user_ids: string[] };
        Returns: { user_id: string; full_name: string; location: string }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
