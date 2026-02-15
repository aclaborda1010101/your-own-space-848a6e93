export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_course_lessons: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          created_at: string
          id: string
          lesson_id: number
          notes: string | null
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          id?: string
          lesson_id: number
          notes?: string | null
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          id?: string
          lesson_id?: number
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_course_projects: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          progress: number | null
          project_id: string
          started_at: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          progress?: number | null
          project_id: string
          started_at?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          progress?: number | null
          project_id?: string
          started_at?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_course_skills: {
        Row: {
          created_at: string
          id: string
          last_updated: string | null
          notes: string | null
          progress: number | null
          skill_id: string
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_updated?: string | null
          notes?: string | null
          progress?: number | null
          skill_id: string
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_updated?: string | null
          notes?: string | null
          progress?: number | null
          skill_id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_daily_summaries: {
        Row: {
          created_at: string
          date: string
          generated_at: string
          id: string
          key_insights: Json | null
          summary: string
          top_news_ids: string[] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          generated_at?: string
          id?: string
          key_insights?: Json | null
          summary: string
          top_news_ids?: string[] | null
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          generated_at?: string
          id?: string
          key_insights?: Json | null
          summary?: string
          top_news_ids?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      ai_news: {
        Row: {
          category: string | null
          created_at: string
          creator_name: string | null
          date: string
          id: string
          is_video: boolean | null
          relevance_score: number | null
          source_name: string | null
          source_url: string | null
          summary: string | null
          title: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          creator_name?: string | null
          date?: string
          id?: string
          is_video?: boolean | null
          relevance_score?: number | null
          source_name?: string | null
          source_url?: string | null
          summary?: string | null
          title: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          creator_name?: string | null
          date?: string
          id?: string
          is_video?: boolean | null
          relevance_score?: number | null
          source_name?: string | null
          source_url?: string | null
          summary?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_news_favorites: {
        Row: {
          created_at: string
          id: string
          news_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          news_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          news_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_news_favorites_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
            referencedRelation: "ai_news"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_video_alerts: {
        Row: {
          created_at: string
          creator_name: string
          enabled: boolean
          id: string
          last_notified_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          creator_name: string
          enabled?: boolean
          id?: string
          last_notified_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          creator_name?: string
          enabled?: boolean
          id?: string
          last_notified_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      analyzed_scripts: {
        Row: {
          act_structure: Json | null
          audio_analysis: Json | null
          camera_patterns: Json | null
          color_palettes: Json | null
          created_at: string
          dialogue_ratio: number | null
          director: string | null
          edit_rhythm: Json | null
          embedding: string | null
          episode_code: string | null
          genre: string[] | null
          id: string
          lighting_setups: Json | null
          music_patterns: Json | null
          oscar_winner: boolean | null
          pdf_url: string | null
          raw_text: string | null
          ready_prompts: Json | null
          scene_stats: Json | null
          series_name: string | null
          showrunner: string | null
          title: string | null
          total_pages: number | null
          transition_patterns: Json | null
          updated_at: string
          user_id: string | null
          vocabulary_analysis: Json | null
          voice_profiles: Json[] | null
          year: number | null
        }
        Insert: {
          act_structure?: Json | null
          audio_analysis?: Json | null
          camera_patterns?: Json | null
          color_palettes?: Json | null
          created_at?: string
          dialogue_ratio?: number | null
          director?: string | null
          edit_rhythm?: Json | null
          embedding?: string | null
          episode_code?: string | null
          genre?: string[] | null
          id?: string
          lighting_setups?: Json | null
          music_patterns?: Json | null
          oscar_winner?: boolean | null
          pdf_url?: string | null
          raw_text?: string | null
          ready_prompts?: Json | null
          scene_stats?: Json | null
          series_name?: string | null
          showrunner?: string | null
          title?: string | null
          total_pages?: number | null
          transition_patterns?: Json | null
          updated_at?: string
          user_id?: string | null
          vocabulary_analysis?: Json | null
          voice_profiles?: Json[] | null
          year?: number | null
        }
        Update: {
          act_structure?: Json | null
          audio_analysis?: Json | null
          camera_patterns?: Json | null
          color_palettes?: Json | null
          created_at?: string
          dialogue_ratio?: number | null
          director?: string | null
          edit_rhythm?: Json | null
          embedding?: string | null
          episode_code?: string | null
          genre?: string[] | null
          id?: string
          lighting_setups?: Json | null
          music_patterns?: Json | null
          oscar_winner?: boolean | null
          pdf_url?: string | null
          raw_text?: string | null
          ready_prompts?: Json | null
          scene_stats?: Json | null
          series_name?: string | null
          showrunner?: string | null
          title?: string | null
          total_pages?: number | null
          transition_patterns?: Json | null
          updated_at?: string
          user_id?: string | null
          vocabulary_analysis?: Json | null
          voice_profiles?: Json[] | null
          year?: number | null
        }
        Relationships: []
      }
      bosco_activities: {
        Row: {
          activity_type: string
          completed: boolean | null
          completed_at: string | null
          created_at: string
          date: string
          description: string | null
          duration_minutes: number | null
          energy_level: string | null
          id: string
          language: string | null
          notes: string | null
          title: string
          user_id: string
        }
        Insert: {
          activity_type: string
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          date?: string
          description?: string | null
          duration_minutes?: number | null
          energy_level?: string | null
          id?: string
          language?: string | null
          notes?: string | null
          title: string
          user_id: string
        }
        Update: {
          activity_type?: string
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          date?: string
          description?: string | null
          duration_minutes?: number | null
          energy_level?: string | null
          id?: string
          language?: string | null
          notes?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      bosco_interactions: {
        Row: {
          activity_category: string | null
          ai_analysis: string | null
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          emotion_detected: string | null
          emotion_intensity: number | null
          happened_at: string | null
          id: string
          interaction_type: string
          metadata: Json | null
          parent_reflection: string | null
          title: string
          user_id: string
        }
        Insert: {
          activity_category?: string | null
          ai_analysis?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          emotion_detected?: string | null
          emotion_intensity?: number | null
          happened_at?: string | null
          id?: string
          interaction_type: string
          metadata?: Json | null
          parent_reflection?: string | null
          title: string
          user_id: string
        }
        Update: {
          activity_category?: string | null
          ai_analysis?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          emotion_detected?: string | null
          emotion_intensity?: number | null
          happened_at?: string | null
          id?: string
          interaction_type?: string
          metadata?: Json | null
          parent_reflection?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      bosco_vocabulary: {
        Row: {
          category: string | null
          created_at: string
          id: string
          is_mastered: boolean | null
          last_practiced_at: string | null
          times_practiced: number | null
          user_id: string
          word_en: string
          word_es: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          is_mastered?: boolean | null
          last_practiced_at?: string | null
          times_practiced?: number | null
          user_id: string
          word_en: string
          word_es: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          is_mastered?: boolean | null
          last_practiced_at?: string | null
          times_practiced?: number | null
          user_id?: string
          word_en?: string
          word_es?: string
        }
        Relationships: []
      }
      bosco_vocabulary_sessions: {
        Row: {
          correct_count: number | null
          created_at: string
          date: string
          id: string
          notes: string | null
          total_count: number | null
          user_id: string
          words_practiced: string[] | null
        }
        Insert: {
          correct_count?: number | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          total_count?: number | null
          user_id: string
          words_practiced?: string[] | null
        }
        Update: {
          correct_count?: number | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          total_count?: number | null
          user_id?: string
          words_practiced?: string[] | null
        }
        Relationships: []
      }
      challenge_goals: {
        Row: {
          challenge_id: string
          created_at: string
          description: string | null
          frequency: string
          goal_type: string
          id: string
          sort_order: number | null
          target_count: number | null
          title: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          description?: string | null
          frequency?: string
          goal_type?: string
          id?: string
          sort_order?: number | null
          target_count?: number | null
          title: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          description?: string | null
          frequency?: string
          goal_type?: string
          id?: string
          sort_order?: number | null
          target_count?: number | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_goals_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_logs: {
        Row: {
          challenge_id: string
          completed: boolean
          created_at: string
          date: string
          goal_id: string | null
          id: string
          mood: number | null
          notes: string | null
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed?: boolean
          created_at?: string
          date?: string
          goal_id?: string | null
          id?: string
          mood?: number | null
          notes?: string | null
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed?: boolean
          created_at?: string
          date?: string
          goal_id?: string | null
          id?: string
          mood?: number | null
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_logs_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_logs_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "challenge_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          created_at: string
          description: string | null
          duration_days: number
          end_date: string
          id: string
          motivation: string | null
          name: string
          reward: string | null
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_days?: number
          end_date: string
          id?: string
          motivation?: string | null
          name: string
          reward?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_days?: number
          end_date?: string
          id?: string
          motivation?: string | null
          name?: string
          reward?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      characters: {
        Row: {
          arc: string | null
          bio: string | null
          canon_rules: Json | null
          character_role: string | null
          created_at: string
          expressions: Json[] | null
          id: string
          name: string
          pack_completeness_score: number | null
          profile_json: Json | null
          project_id: string
          role: string | null
          updated_at: string
          voice_card: Json | null
        }
        Insert: {
          arc?: string | null
          bio?: string | null
          canon_rules?: Json | null
          character_role?: string | null
          created_at?: string
          expressions?: Json[] | null
          id?: string
          name: string
          pack_completeness_score?: number | null
          profile_json?: Json | null
          project_id: string
          role?: string | null
          updated_at?: string
          voice_card?: Json | null
        }
        Update: {
          arc?: string | null
          bio?: string | null
          canon_rules?: Json | null
          character_role?: string | null
          created_at?: string
          expressions?: Json[] | null
          id?: string
          name?: string
          pack_completeness_score?: number | null
          profile_json?: Json | null
          project_id?: string
          role?: string | null
          updated_at?: string
          voice_card?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "characters_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      check_ins: {
        Row: {
          available_time: number
          created_at: string
          date: string
          day_mode: string
          energy: number
          focus: number
          id: string
          interruption_risk: string
          mood: number
          user_id: string
        }
        Insert: {
          available_time?: number
          created_at?: string
          date?: string
          day_mode?: string
          energy: number
          focus: number
          id?: string
          interruption_risk?: string
          mood: number
          user_id: string
        }
        Update: {
          available_time?: number
          created_at?: string
          date?: string
          day_mode?: string
          energy?: number
          focus?: number
          id?: string
          interruption_risk?: string
          mood?: number
          user_id?: string
        }
        Relationships: []
      }
      cinematographic_patterns: {
        Row: {
          created_at: string
          description: string | null
          example_films: string[] | null
          generation_prompt: string | null
          genre: string[] | null
          id: string
          mood: string[] | null
          name: string
          negative_prompt: string | null
          pattern_data: Json | null
          pattern_type: string
          quality_score: number | null
          scene_types: string[] | null
          updated_at: string
          usage_count: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          example_films?: string[] | null
          generation_prompt?: string | null
          genre?: string[] | null
          id?: string
          mood?: string[] | null
          name: string
          negative_prompt?: string | null
          pattern_data?: Json | null
          pattern_type: string
          quality_score?: number | null
          scene_types?: string[] | null
          updated_at?: string
          usage_count?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          example_films?: string[] | null
          generation_prompt?: string | null
          genre?: string[] | null
          id?: string
          mood?: string[] | null
          name?: string
          negative_prompt?: string | null
          pattern_data?: Json | null
          pattern_type?: string
          quality_score?: number | null
          scene_types?: string[] | null
          updated_at?: string
          usage_count?: number | null
        }
        Relationships: []
      }
      cloudbot_chat: {
        Row: {
          approved_at: string | null
          created_at: string | null
          executed_at: string | null
          id: string
          is_command: boolean | null
          message: string
          sender: string
          structured_intent: Json | null
        }
        Insert: {
          approved_at?: string | null
          created_at?: string | null
          executed_at?: string | null
          id?: string
          is_command?: boolean | null
          message: string
          sender: string
          structured_intent?: Json | null
        }
        Update: {
          approved_at?: string | null
          created_at?: string | null
          executed_at?: string | null
          id?: string
          is_command?: boolean | null
          message?: string
          sender?: string
          structured_intent?: Json | null
        }
        Relationships: []
      }
      cloudbot_nodes: {
        Row: {
          active_workers: number | null
          current_load: Json | null
          ip_address: unknown
          last_heartbeat: string | null
          metadata: Json | null
          node_id: string
          status: Database["public"]["Enums"]["node_status"] | null
        }
        Insert: {
          active_workers?: number | null
          current_load?: Json | null
          ip_address?: unknown
          last_heartbeat?: string | null
          metadata?: Json | null
          node_id: string
          status?: Database["public"]["Enums"]["node_status"] | null
        }
        Update: {
          active_workers?: number | null
          current_load?: Json | null
          ip_address?: unknown
          last_heartbeat?: string | null
          metadata?: Json | null
          node_id?: string
          status?: Database["public"]["Enums"]["node_status"] | null
        }
        Relationships: []
      }
      cloudbot_tasks_log: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          full_logs: Json | null
          priority: Database["public"]["Enums"]["task_priority"] | null
          result_summary: string | null
          status: Database["public"]["Enums"]["task_state"] | null
          task_id: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          full_logs?: Json | null
          priority?: Database["public"]["Enums"]["task_priority"] | null
          result_summary?: string | null
          status?: Database["public"]["Enums"]["task_state"] | null
          task_id?: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          full_logs?: Json | null
          priority?: Database["public"]["Enums"]["task_priority"] | null
          result_summary?: string | null
          status?: Database["public"]["Enums"]["task_state"] | null
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "cloudbot_tasks_log_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "cloudbot_nodes"
            referencedColumns: ["node_id"]
          },
        ]
      }
      coach_habits: {
        Row: {
          created_at: string
          id: string
          last_completed_at: string | null
          name: string
          streak: number | null
          target: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_completed_at?: string | null
          name: string
          streak?: number | null
          target?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_completed_at?: string | null
          name?: string
          streak?: number | null
          target?: number | null
          user_id?: string
        }
        Relationships: []
      }
      coach_kpis: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
          target: number
          unit: string | null
          updated_at: string | null
          user_id: string
          value: number | null
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          name: string
          target: number
          unit?: string | null
          updated_at?: string | null
          user_id: string
          value?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
          target?: number
          unit?: string | null
          updated_at?: string | null
          user_id?: string
          value?: number | null
        }
        Relationships: []
      }
      coach_sessions: {
        Row: {
          created_at: string
          date: string
          emotional_state: Json | null
          id: string
          insights: Json | null
          interventions: Json | null
          messages: Json
          next_steps: string | null
          protocol: string | null
          session_type: string
          summary: string | null
          topics: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          emotional_state?: Json | null
          id?: string
          insights?: Json | null
          interventions?: Json | null
          messages?: Json
          next_steps?: string | null
          protocol?: string | null
          session_type?: string
          summary?: string | null
          topics?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          emotional_state?: Json | null
          id?: string
          insights?: Json | null
          interventions?: Json | null
          messages?: Json
          next_steps?: string | null
          protocol?: string | null
          session_type?: string
          summary?: string | null
          topics?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coach_stats: {
        Row: {
          created_at: string
          goal_90_days: string | null
          goal_progress: number | null
          id: string
          streak_days: number | null
          total_insights: number | null
          total_sessions: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          goal_90_days?: string | null
          goal_progress?: number | null
          id?: string
          streak_days?: number | null
          total_insights?: number | null
          total_sessions?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          goal_90_days?: string | null
          goal_progress?: number | null
          id?: string
          streak_days?: number | null
          total_insights?: number | null
          total_sessions?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      coaching_knowledge: {
        Row: {
          category: string
          content: string
          created_at: string | null
          domain: string
          embedding: string | null
          id: string
          metadata: Json | null
          source: string
          title: string
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          domain: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source: string
          title: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          domain?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source?: string
          title?: string
        }
        Relationships: []
      }
      commitments: {
        Row: {
          commitment_type: string
          created_at: string
          deadline: string | null
          description: string
          id: string
          person_name: string | null
          source_transcription_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          commitment_type?: string
          created_at?: string
          deadline?: string | null
          description: string
          id?: string
          person_name?: string | null
          source_transcription_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          commitment_type?: string
          created_at?: string
          deadline?: string | null
          description?: string
          id?: string
          person_name?: string | null
          source_transcription_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commitments_source_transcription_id_fkey"
            columns: ["source_transcription_id"]
            isOneToOne: false
            referencedRelation: "transcriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      content_bank: {
        Row: {
          category: string | null
          created_at: string
          cta: string | null
          id: string
          image_url: string | null
          notes: string | null
          phrase_text: string
          reflection: string
          tags: string[] | null
          times_used: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          cta?: string | null
          id?: string
          image_url?: string | null
          notes?: string | null
          phrase_text: string
          reflection: string
          tags?: string[] | null
          times_used?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          cta?: string | null
          id?: string
          image_url?: string | null
          notes?: string | null
          phrase_text?: string
          reflection?: string
          tags?: string[] | null
          times_used?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversation_embeddings: {
        Row: {
          brain: string | null
          content: string
          created_at: string
          date: string
          embedding: string | null
          id: string
          metadata: Json | null
          people: string[] | null
          summary: string
          transcription_id: string | null
          user_id: string
        }
        Insert: {
          brain?: string | null
          content: string
          created_at?: string
          date?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          people?: string[] | null
          summary: string
          transcription_id?: string | null
          user_id: string
        }
        Update: {
          brain?: string | null
          content?: string
          created_at?: string
          date?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          people?: string[] | null
          summary?: string
          transcription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_embeddings_transcription_id_fkey"
            columns: ["transcription_id"]
            isOneToOne: false
            referencedRelation: "transcriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_history: {
        Row: {
          agent_type: string
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
          user_id: string | null
        }
        Insert: {
          agent_type?: string
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
          user_id?: string | null
        }
        Update: {
          agent_type?: string
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
          user_id?: string | null
        }
        Relationships: []
      }
      daily_briefings: {
        Row: {
          ai_news: Json | null
          briefing_date: string
          briefing_type: string | null
          calendar_events: Json | null
          coach_tip: string | null
          emails_summary: Json | null
          generated_at: string | null
          health_summary: Json | null
          id: string
          pending_tasks: Json | null
          read_at: string | null
          user_id: string
          world_news: Json | null
        }
        Insert: {
          ai_news?: Json | null
          briefing_date?: string
          briefing_type?: string | null
          calendar_events?: Json | null
          coach_tip?: string | null
          emails_summary?: Json | null
          generated_at?: string | null
          health_summary?: Json | null
          id?: string
          pending_tasks?: Json | null
          read_at?: string | null
          user_id: string
          world_news?: Json | null
        }
        Update: {
          ai_news?: Json | null
          briefing_date?: string
          briefing_type?: string | null
          calendar_events?: Json | null
          coach_tip?: string | null
          emails_summary?: Json | null
          generated_at?: string | null
          health_summary?: Json | null
          id?: string
          pending_tasks?: Json | null
          read_at?: string | null
          user_id?: string
          world_news?: Json | null
        }
        Relationships: []
      }
      daily_logs: {
        Row: {
          completed_count: number | null
          created_at: string
          date: string
          energy_avg: number | null
          focus_avg: number | null
          id: string
          life_win: string | null
          mood_avg: number | null
          moved_count: number | null
          planned_count: number | null
          tomorrow_adjust: string | null
          updated_at: string
          user_id: string
          work_win: string | null
        }
        Insert: {
          completed_count?: number | null
          created_at?: string
          date?: string
          energy_avg?: number | null
          focus_avg?: number | null
          id?: string
          life_win?: string | null
          mood_avg?: number | null
          moved_count?: number | null
          planned_count?: number | null
          tomorrow_adjust?: string | null
          updated_at?: string
          user_id: string
          work_win?: string | null
        }
        Update: {
          completed_count?: number | null
          created_at?: string
          date?: string
          energy_avg?: number | null
          focus_avg?: number | null
          id?: string
          life_win?: string | null
          mood_avg?: number | null
          moved_count?: number | null
          planned_count?: number | null
          tomorrow_adjust?: string | null
          updated_at?: string
          user_id?: string
          work_win?: string | null
        }
        Relationships: []
      }
      daily_observations: {
        Row: {
          created_at: string
          date: string
          id: string
          observations: string | null
          selected_dinner: string | null
          selected_lunch: string | null
          updated_at: string
          user_id: string
          whoops_summary: string | null
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          observations?: string | null
          selected_dinner?: string | null
          selected_lunch?: string | null
          updated_at?: string
          user_id: string
          whoops_summary?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          observations?: string | null
          selected_dinner?: string | null
          selected_lunch?: string | null
          updated_at?: string
          user_id?: string
          whoops_summary?: string | null
        }
        Relationships: []
      }
      daily_publications: {
        Row: {
          copy_long: string | null
          copy_short: string | null
          created_at: string
          date: string
          engagement: Json | null
          hashtags: string[] | null
          id: string
          phrases: Json
          platform: string | null
          published: boolean
          published_at: string | null
          selected_phrase: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          copy_long?: string | null
          copy_short?: string | null
          created_at?: string
          date?: string
          engagement?: Json | null
          hashtags?: string[] | null
          id?: string
          phrases?: Json
          platform?: string | null
          published?: boolean
          published_at?: string | null
          selected_phrase?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          copy_long?: string | null
          copy_short?: string | null
          created_at?: string
          date?: string
          engagement?: Json | null
          hashtags?: string[] | null
          id?: string
          phrases?: Json
          platform?: string | null
          published?: boolean
          published_at?: string | null
          selected_phrase?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string | null
          id: string
          platform: string | null
          token: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          platform?: string | null
          token: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          platform?: string | null
          token?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      dismissed_alerts: {
        Row: {
          alert_id: string
          dismissed_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          alert_id: string
          dismissed_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          alert_id?: string
          dismissed_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      email_accounts: {
        Row: {
          created_at: string
          credentials_encrypted: Json | null
          display_name: string | null
          email_address: string
          id: string
          imap_host: string | null
          imap_port: number | null
          is_active: boolean
          last_sync_at: string | null
          provider: string
          sync_error: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credentials_encrypted?: Json | null
          display_name?: string | null
          email_address: string
          id?: string
          imap_host?: string | null
          imap_port?: number | null
          is_active?: boolean
          last_sync_at?: string | null
          provider: string
          sync_error?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credentials_encrypted?: Json | null
          display_name?: string | null
          email_address?: string
          id?: string
          imap_host?: string | null
          imap_port?: number | null
          is_active?: boolean
          last_sync_at?: string | null
          provider?: string
          sync_error?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      english_chunks: {
        Row: {
          category: string | null
          created_at: string
          id: string
          last_practiced_at: string | null
          mastered: boolean | null
          phrase_en: string
          phrase_es: string
          times_practiced: number | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          last_practiced_at?: string | null
          mastered?: boolean | null
          phrase_en: string
          phrase_es: string
          times_practiced?: number | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          last_practiced_at?: string | null
          mastered?: boolean | null
          phrase_en?: string
          phrase_es?: string
          times_practiced?: number | null
          user_id?: string
        }
        Relationships: []
      }
      english_stats: {
        Row: {
          bosco_games_played: number | null
          created_at: string
          id: string
          mini_tests_completed: number | null
          roleplay_sessions: number | null
          shadowing_sessions: number | null
          streak_days: number | null
          total_chunks_learned: number | null
          total_practice_minutes: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bosco_games_played?: number | null
          created_at?: string
          id?: string
          mini_tests_completed?: number | null
          roleplay_sessions?: number | null
          shadowing_sessions?: number | null
          streak_days?: number | null
          total_chunks_learned?: number | null
          total_practice_minutes?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bosco_games_played?: number | null
          created_at?: string
          id?: string
          mini_tests_completed?: number | null
          roleplay_sessions?: number | null
          shadowing_sessions?: number | null
          streak_days?: number | null
          total_chunks_learned?: number | null
          total_practice_minutes?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      film_knowledge_index: {
        Row: {
          camera_style: string | null
          color_mood: string | null
          created_at: string
          dialogue_density: string | null
          director: string | null
          embedding: string | null
          film_id: string | null
          genre: string[] | null
          id: string
          pacing: string | null
          tags: string[] | null
          title: string | null
          tone: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          camera_style?: string | null
          color_mood?: string | null
          created_at?: string
          dialogue_density?: string | null
          director?: string | null
          embedding?: string | null
          film_id?: string | null
          genre?: string[] | null
          id?: string
          pacing?: string | null
          tags?: string[] | null
          title?: string | null
          tone?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          camera_style?: string | null
          color_mood?: string | null
          created_at?: string
          dialogue_density?: string | null
          director?: string | null
          embedding?: string | null
          film_id?: string | null
          genre?: string[] | null
          id?: string
          pacing?: string | null
          tags?: string[] | null
          title?: string | null
          tone?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "film_knowledge_index_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: true
            referencedRelation: "analyzed_scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_accounts: {
        Row: {
          account_type: string
          balance: number | null
          created_at: string
          currency: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: string
          balance?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string
          balance?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_budgets: {
        Row: {
          alert_threshold: number | null
          budget_amount: number
          category: string
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean | null
          period: string
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_threshold?: number | null
          budget_amount: number
          category: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          period?: string
          start_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_threshold?: number | null
          budget_amount?: number
          category?: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          period?: string
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_goals: {
        Row: {
          created_at: string
          current_amount: number | null
          deadline: string | null
          id: string
          name: string
          priority: string | null
          status: string | null
          target_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_amount?: number | null
          deadline?: string | null
          id?: string
          name: string
          priority?: string | null
          status?: string | null
          target_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_amount?: number | null
          deadline?: string | null
          id?: string
          name?: string
          priority?: string | null
          status?: string | null
          target_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_transactions: {
        Row: {
          account_id: string | null
          amount: number
          category: string
          created_at: string
          currency: string | null
          description: string | null
          due_date: string | null
          id: string
          invoice_number: string | null
          invoice_status: string | null
          is_recurring: boolean | null
          recurring_frequency: string | null
          subcategory: string | null
          tags: Json | null
          transaction_date: string
          transaction_type: string
          updated_at: string
          user_id: string
          vendor: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          category: string
          created_at?: string
          currency?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          invoice_status?: string | null
          is_recurring?: boolean | null
          recurring_frequency?: string | null
          subcategory?: string | null
          tags?: Json | null
          transaction_date?: string
          transaction_type: string
          updated_at?: string
          user_id: string
          vendor?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string
          created_at?: string
          currency?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          invoice_status?: string | null
          is_recurring?: boolean | null
          recurring_frequency?: string | null
          subcategory?: string | null
          tags?: Json | null
          transaction_date?: string
          transaction_type?: string
          updated_at?: string
          user_id?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_ups: {
        Row: {
          created_at: string
          detected_at: string
          id: string
          last_mention: string | null
          notes: string | null
          related_person_id: string | null
          resolve_by: string | null
          source_transcription_id: string | null
          status: string
          topic: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detected_at?: string
          id?: string
          last_mention?: string | null
          notes?: string | null
          related_person_id?: string | null
          resolve_by?: string | null
          source_transcription_id?: string | null
          status?: string
          topic: string
          user_id: string
        }
        Update: {
          created_at?: string
          detected_at?: string
          id?: string
          last_mention?: string | null
          notes?: string | null
          related_person_id?: string | null
          resolve_by?: string | null
          source_transcription_id?: string | null
          status?: string
          topic?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_related_person_id_fkey"
            columns: ["related_person_id"]
            isOneToOne: false
            referencedRelation: "people_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_source_transcription_id_fkey"
            columns: ["source_transcription_id"]
            isOneToOne: false
            referencedRelation: "transcriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_state: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step: string | null
          error_message: string | null
          generation_type: string | null
          id: string
          progress_percent: number | null
          project_id: string
          state_json: Json | null
          status: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step?: string | null
          error_message?: string | null
          generation_type?: string | null
          id?: string
          progress_percent?: number | null
          project_id: string
          state_json?: Json | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step?: string | null
          error_message?: string | null
          generation_type?: string | null
          id?: string
          progress_percent?: number | null
          project_id?: string
          state_json?: Json | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generation_state_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_insights: {
        Row: {
          category: string | null
          confidence_score: number | null
          created_at: string | null
          description: string | null
          evidence: Json | null
          id: string
          insight_type: string
          is_active: boolean | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          confidence_score?: number | null
          created_at?: string | null
          description?: string | null
          evidence?: Json | null
          id?: string
          insight_type: string
          is_active?: boolean | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          confidence_score?: number | null
          created_at?: string | null
          description?: string | null
          evidence?: Json | null
          id?: string
          insight_type?: string
          is_active?: boolean | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ideas_projects: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          interest_score: number
          maturity_state: string
          mention_count: number
          name: string
          notes: Json | null
          origin: string
          related_people: Json | null
          source_transcription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          interest_score?: number
          maturity_state?: string
          mention_count?: number
          name: string
          notes?: Json | null
          origin?: string
          related_people?: Json | null
          source_transcription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          interest_score?: number
          maturity_state?: string
          mention_count?: number
          name?: string
          notes?: Json | null
          origin?: string
          related_people?: Json | null
          source_transcription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ideas_projects_source_transcription_id_fkey"
            columns: ["source_transcription_id"]
            isOneToOne: false
            referencedRelation: "transcriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          channel: string
          commitments: Json | null
          contact_id: string | null
          created_at: string
          date: string
          id: string
          interaction_type: string | null
          sentiment: string | null
          summary: string | null
          user_id: string
        }
        Insert: {
          channel?: string
          commitments?: Json | null
          contact_id?: string | null
          created_at?: string
          date?: string
          id?: string
          interaction_type?: string | null
          sentiment?: string | null
          summary?: string | null
          user_id: string
        }
        Update: {
          channel?: string
          commitments?: Json | null
          contact_id?: string | null
          created_at?: string
          date?: string
          id?: string
          interaction_type?: string | null
          sentiment?: string | null
          summary?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "people_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      jarvis_bosco_log: {
        Row: {
          activity: string | null
          created_at: string | null
          date: string | null
          duration_min: number | null
          id: string
          mood: string | null
          notes: string | null
        }
        Insert: {
          activity?: string | null
          created_at?: string | null
          date?: string | null
          duration_min?: number | null
          id?: string
          mood?: string | null
          notes?: string | null
        }
        Update: {
          activity?: string | null
          created_at?: string | null
          date?: string | null
          duration_min?: number | null
          id?: string
          mood?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      jarvis_chat: {
        Row: {
          content: string
          created_at: string | null
          id: string
          role: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          role: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          role?: string
        }
        Relationships: []
      }
      jarvis_conversations: {
        Row: {
          agent: string | null
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
          session_id: string
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          agent?: string | null
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
          session_id?: string
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          agent?: string | null
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: []
      }
      jarvis_emails_cache: {
        Row: {
          account: string | null
          created_at: string | null
          from_addr: string | null
          id: string
          is_read: boolean | null
          preview: string | null
          subject: string | null
          synced_at: string | null
          user_id: string
        }
        Insert: {
          account?: string | null
          created_at?: string | null
          from_addr?: string | null
          id?: string
          is_read?: boolean | null
          preview?: string | null
          subject?: string | null
          synced_at?: string | null
          user_id: string
        }
        Update: {
          account?: string | null
          created_at?: string | null
          from_addr?: string | null
          id?: string
          is_read?: boolean | null
          preview?: string | null
          subject?: string | null
          synced_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      jarvis_memory: {
        Row: {
          access_count: number | null
          category: string
          content: string
          created_at: string | null
          expires_at: string | null
          id: string
          importance: number | null
          last_accessed: string | null
          memory_type: string
          metadata: Json | null
          source: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_count?: number | null
          category: string
          content: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          importance?: number | null
          last_accessed?: string | null
          memory_type: string
          metadata?: Json | null
          source?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_count?: number | null
          category?: string
          content?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          importance?: number | null
          last_accessed?: string | null
          memory_type?: string
          metadata?: Json | null
          source?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      jarvis_messages: {
        Row: {
          created_at: string | null
          from_jarvis: string
          id: string
          message: string
          priority: string | null
          read: boolean | null
          read_at: string | null
          to_jarvis: string
        }
        Insert: {
          created_at?: string | null
          from_jarvis: string
          id?: string
          message: string
          priority?: string | null
          read?: boolean | null
          read_at?: string | null
          to_jarvis: string
        }
        Update: {
          created_at?: string | null
          from_jarvis?: string
          id?: string
          message?: string
          priority?: string | null
          read?: boolean | null
          read_at?: string | null
          to_jarvis?: string
        }
        Relationships: []
      }
      jarvis_notifications: {
        Row: {
          body: string | null
          created_at: string | null
          id: string
          read: boolean | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: string
          read?: boolean | null
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string
          read?: boolean | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      jarvis_whatsapp_cache: {
        Row: {
          chat_name: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          last_message: string | null
          last_time: string | null
          user_id: string
        }
        Insert: {
          chat_name?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          last_message?: string | null
          last_time?: string | null
          user_id: string
        }
        Update: {
          chat_name?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          last_message?: string | null
          last_time?: string | null
          user_id?: string
        }
        Relationships: []
      }
      jarvis_whoop_data: {
        Row: {
          date: string | null
          hrv: number | null
          id: string
          recovery_score: number | null
          sleep_hours: number | null
          strain: number | null
          synced_at: string | null
        }
        Insert: {
          date?: string | null
          hrv?: number | null
          id?: string
          recovery_score?: number | null
          sleep_hours?: number | null
          strain?: number | null
          synced_at?: string | null
        }
        Update: {
          date?: string | null
          hrv?: number | null
          id?: string
          recovery_score?: number | null
          sleep_hours?: number | null
          strain?: number | null
          synced_at?: string | null
        }
        Relationships: []
      }
      knowledge_embeddings: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          metadata: Json | null
          source: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      linking_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          platform: string
          telegram_chat_id: string | null
          telegram_first_name: string | null
          telegram_user_id: string | null
          telegram_username: string | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          platform: string
          telegram_chat_id?: string | null
          telegram_first_name?: string | null
          telegram_user_id?: string | null
          telegram_username?: string | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          platform?: string
          telegram_chat_id?: string | null
          telegram_first_name?: string | null
          telegram_user_id?: string | null
          telegram_username?: string | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          profile_json: Json | null
          project_id: string
          props: Json | null
          reference_urls: Json[] | null
          sound_profile: Json | null
          status: string | null
          updated_at: string
          variants: Json | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          profile_json?: Json | null
          project_id: string
          props?: Json | null
          reference_urls?: Json[] | null
          sound_profile?: Json | null
          status?: string | null
          updated_at?: string
          variants?: Json | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          profile_json?: Json | null
          project_id?: string
          props?: Json | null
          reference_urls?: Json[] | null
          sound_profile?: Json | null
          status?: string | null
          updated_at?: string
          variants?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_history: {
        Row: {
          created_at: string
          date: string
          energy_after: number | null
          id: string
          meal_name: string
          meal_type: string
          notes: string | null
          recipe_data: Json | null
          user_id: string
          was_completed: boolean | null
        }
        Insert: {
          created_at?: string
          date?: string
          energy_after?: number | null
          id?: string
          meal_name: string
          meal_type: string
          notes?: string | null
          recipe_data?: Json | null
          user_id: string
          was_completed?: boolean | null
        }
        Update: {
          created_at?: string
          date?: string
          energy_after?: number | null
          id?: string
          meal_name?: string
          meal_type?: string
          notes?: string | null
          recipe_data?: Json | null
          user_id?: string
          was_completed?: boolean | null
        }
        Relationships: []
      }
      nutrition_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      nutrition_preferences: {
        Row: {
          allergies: string[] | null
          calories_target: number | null
          carbs_target: number | null
          created_at: string
          diet_type: string | null
          fats_target: number | null
          goals: string | null
          id: string
          meal_count: number | null
          preferences_notes: string | null
          proteins_target: number | null
          restrictions: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allergies?: string[] | null
          calories_target?: number | null
          carbs_target?: number | null
          created_at?: string
          diet_type?: string | null
          fats_target?: number | null
          goals?: string | null
          id?: string
          meal_count?: number | null
          preferences_notes?: string | null
          proteins_target?: number | null
          restrictions?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allergies?: string[] | null
          calories_target?: number | null
          carbs_target?: number | null
          created_at?: string
          diet_type?: string | null
          fats_target?: number | null
          goals?: string | null
          id?: string
          meal_count?: number | null
          preferences_notes?: string | null
          proteins_target?: number | null
          restrictions?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      nutrition_profile: {
        Row: {
          active_diet: string | null
          created_at: string
          decision_fatigue: string | null
          dinner_time: string | null
          eating_style: string | null
          first_meal_time: string | null
          id: string
          intermittent_fasting: boolean | null
          learned_patterns: Json | null
          main_meal_time: string | null
          max_complexity: string | null
          menu_templates: Json | null
          nutritional_goal: string | null
          personal_rules: Json | null
          preferred_foods: Json | null
          rejected_foods: Json | null
          supplements: Json | null
          tolerated_foods: Json | null
          training_frequency: string | null
          training_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_diet?: string | null
          created_at?: string
          decision_fatigue?: string | null
          dinner_time?: string | null
          eating_style?: string | null
          first_meal_time?: string | null
          id?: string
          intermittent_fasting?: boolean | null
          learned_patterns?: Json | null
          main_meal_time?: string | null
          max_complexity?: string | null
          menu_templates?: Json | null
          nutritional_goal?: string | null
          personal_rules?: Json | null
          preferred_foods?: Json | null
          rejected_foods?: Json | null
          supplements?: Json | null
          tolerated_foods?: Json | null
          training_frequency?: string | null
          training_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_diet?: string | null
          created_at?: string
          decision_fatigue?: string | null
          dinner_time?: string | null
          eating_style?: string | null
          first_meal_time?: string | null
          id?: string
          intermittent_fasting?: boolean | null
          learned_patterns?: Json | null
          main_meal_time?: string | null
          max_complexity?: string | null
          menu_templates?: Json | null
          nutritional_goal?: string | null
          personal_rules?: Json | null
          preferred_foods?: Json | null
          rejected_foods?: Json | null
          supplements?: Json | null
          tolerated_foods?: Json | null
          training_frequency?: string | null
          training_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      people_contacts: {
        Row: {
          ai_tags: string[] | null
          brain: string | null
          company: string | null
          context: string | null
          created_at: string
          email: string | null
          id: string
          interaction_count: number
          last_contact: string | null
          metadata: Json | null
          name: string
          relationship: string | null
          role: string | null
          scores: Json | null
          sentiment: string | null
          updated_at: string
          user_id: string
          wa_id: string | null
        }
        Insert: {
          ai_tags?: string[] | null
          brain?: string | null
          company?: string | null
          context?: string | null
          created_at?: string
          email?: string | null
          id?: string
          interaction_count?: number
          last_contact?: string | null
          metadata?: Json | null
          name: string
          relationship?: string | null
          role?: string | null
          scores?: Json | null
          sentiment?: string | null
          updated_at?: string
          user_id: string
          wa_id?: string | null
        }
        Update: {
          ai_tags?: string[] | null
          brain?: string | null
          company?: string | null
          context?: string | null
          created_at?: string
          email?: string | null
          id?: string
          interaction_count?: number
          last_contact?: string | null
          metadata?: Json | null
          name?: string
          relationship?: string | null
          role?: string | null
          scores?: Json | null
          sentiment?: string | null
          updated_at?: string
          user_id?: string
          wa_id?: string | null
        }
        Relationships: []
      }
      pipeline_presets: {
        Row: {
          config: Json
          created_at: string | null
          description: string | null
          id: string
          is_system: boolean | null
          name: string
          user_id: string | null
        }
        Insert: {
          config: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          user_id?: string | null
        }
        Update: {
          config?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pipeline_runs: {
        Row: {
          classification: Json | null
          completed_at: string | null
          config: Json | null
          created_at: string | null
          current_step: number | null
          error_log: string | null
          execution_time_ms: number | null
          final_document: string | null
          id: string
          idea: string
          idea_title: string | null
          pipeline_version: string | null
          quality_gate_passed: boolean | null
          quality_gate_result: Json | null
          retry_count: number | null
          status: string
          step_results: Json | null
          tokens_used: Json | null
          total_cost_usd: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          classification?: Json | null
          completed_at?: string | null
          config?: Json | null
          created_at?: string | null
          current_step?: number | null
          error_log?: string | null
          execution_time_ms?: number | null
          final_document?: string | null
          id?: string
          idea: string
          idea_title?: string | null
          pipeline_version?: string | null
          quality_gate_passed?: boolean | null
          quality_gate_result?: Json | null
          retry_count?: number | null
          status?: string
          step_results?: Json | null
          tokens_used?: Json | null
          total_cost_usd?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          classification?: Json | null
          completed_at?: string | null
          config?: Json | null
          created_at?: string | null
          current_step?: number | null
          error_log?: string | null
          execution_time_ms?: number | null
          final_document?: string | null
          id?: string
          idea?: string
          idea_title?: string | null
          pipeline_version?: string | null
          quality_gate_passed?: boolean | null
          quality_gate_result?: Json | null
          retry_count?: number | null
          status?: string
          step_results?: Json | null
          tokens_used?: Json | null
          total_cost_usd?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      pipeline_steps: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          input_content: string | null
          model_name: string
          output_content: string | null
          pipeline_id: string | null
          role_description: string | null
          started_at: string | null
          status: string | null
          step_number: number
          tokens_used: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          input_content?: string | null
          model_name: string
          output_content?: string | null
          pipeline_id?: string | null
          role_description?: string | null
          started_at?: string | null
          status?: string | null
          step_number: number
          tokens_used?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          input_content?: string | null
          model_name?: string
          output_content?: string | null
          pipeline_id?: string | null
          role_description?: string | null
          started_at?: string | null
          status?: string | null
          step_number?: number
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_steps_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "project_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_users: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          platform: string
          platform_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          platform: string
          platform_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          platform?: string
          platform_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
      pomodoro_sessions: {
        Row: {
          completed_at: string
          created_at: string
          duration: number
          id: string
          task_id: string | null
          task_title: string | null
          type: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          created_at?: string
          duration?: number
          id?: string
          task_id?: string | null
          task_title?: string | null
          type?: string
          user_id: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          duration?: number
          id?: string
          task_id?: string | null
          task_title?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pomodoro_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      potus_chat: {
        Row: {
          created_at: string | null
          id: string
          message: string
          platform: string | null
          processed: boolean | null
          processed_at: string | null
          role: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          platform?: string | null
          processed?: boolean | null
          processed_at?: string | null
          role: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          platform?: string | null
          processed?: boolean | null
          processed_at?: string | null
          role?: string
          user_id?: string | null
        }
        Relationships: []
      }
      potus_daily_summary: {
        Row: {
          correlations: Json | null
          created_at: string | null
          daily_insight: string | null
          id: string
          productivity_score: number | null
          recommendations: Json | null
          sessions_summary: Json | null
          summary_date: string
          tasks_summary: Json | null
          updated_at: string | null
          user_id: string | null
          wellbeing_score: number | null
          whoop_summary: Json | null
        }
        Insert: {
          correlations?: Json | null
          created_at?: string | null
          daily_insight?: string | null
          id?: string
          productivity_score?: number | null
          recommendations?: Json | null
          sessions_summary?: Json | null
          summary_date?: string
          tasks_summary?: Json | null
          updated_at?: string | null
          user_id?: string | null
          wellbeing_score?: number | null
          whoop_summary?: Json | null
        }
        Update: {
          correlations?: Json | null
          created_at?: string | null
          daily_insight?: string | null
          id?: string
          productivity_score?: number | null
          recommendations?: Json | null
          sessions_summary?: Json | null
          summary_date?: string
          tasks_summary?: Json | null
          updated_at?: string | null
          user_id?: string | null
          wellbeing_score?: number | null
          whoop_summary?: Json | null
        }
        Relationships: []
      }
      prices: {
        Row: {
          close: number
          created_at: string | null
          high: number
          id: number
          low: number
          open: number
          source: string
          symbol: string
          timestamp: string
          volume: number | null
        }
        Insert: {
          close: number
          created_at?: string | null
          high: number
          id?: number
          low: number
          open: number
          source: string
          symbol: string
          timestamp: string
          volume?: number | null
        }
        Update: {
          close?: number
          created_at?: string | null
          high?: number
          id?: number
          low?: number
          open?: number
          source?: string
          symbol?: string
          timestamp?: string
          volume?: number | null
        }
        Relationships: []
      }
      project_outlines: {
        Row: {
          created_at: string
          id: string
          outline_json: Json | null
          project_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          outline_json?: Json | null
          project_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          outline_json?: Json | null
          project_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_outlines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_pipelines: {
        Row: {
          created_at: string | null
          current_step: number | null
          error_message: string | null
          final_document: string | null
          id: string
          idea_description: string
          lovable_prompt: string | null
          project_id: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_step?: number | null
          error_message?: string | null
          final_document?: string | null
          id?: string
          idea_description: string
          lovable_prompt?: string | null
          project_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_step?: number | null
          error_message?: string | null
          final_document?: string | null
          id?: string
          idea_description?: string
          lovable_prompt?: string | null
          project_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_pipelines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          act_structure: Json | null
          action_density: string | null
          action_intensity_average: number | null
          age_rating: string | null
          antagonist_type: string | null
          avg_scene_length: string | null
          bible_completeness_score: number | null
          budget_cap_episode_eur: number | null
          budget_cap_project_eur: number | null
          budget_cap_scene_eur: number | null
          budget_range: string | null
          camera_movement_style: string | null
          character_arc_complexity: string | null
          character_arc_depth: string | null
          character_count: number | null
          character_development_score: number | null
          character_transformation_depth: string | null
          comedy_density: number | null
          commercial_potential_score: number | null
          comparative_films: Json | null
          content_warnings: string[] | null
          created_at: string
          cultural_context: string | null
          day_night_ratio: string | null
          dialogue_character_voices: Json | null
          dialogue_density: number | null
          dialogue_quality_score: number | null
          distribution_format: string | null
          dramatic_irony_count: number | null
          dramatic_tension_baseline: number | null
          ensemble_cast: boolean | null
          episodes_count: number | null
          exposition_level: string | null
          extracted_at: string | null
          format: string | null
          framing_device: string | null
          generated_at: string | null
          generation_mode: string | null
          genre_extensions: Json | null
          geographic_scope: string | null
          horror_index: number | null
          id: string
          intertextual_analysis: Json | null
          location_count: number | null
          master_language: string | null
          mcguffin: boolean | null
          mentor_figure: boolean | null
          meta_narrative_elements: boolean | null
          metadata_completeness: number | null
          monologue_count: number | null
          mood: string | null
          moral_ambiguity_level: string | null
          narrative_density: string | null
          narrative_structure_type: string | null
          non_linear_elements: boolean | null
          number_of_acts: number | null
          original_title: string | null
          owner_id: string | null
          pacing: string | null
          pacing_score: number | null
          parallel_timelines: boolean | null
          parser_metadata: Json | null
          pov_style: string | null
          practical_effects_ratio: number | null
          primary_theme: string | null
          production_scale: string | null
          protagonist_count: number | null
          protagonist_type: string | null
          quality_metrics: Json | null
          quiet_moments_frequency: string | null
          rag_analysis_version: string | null
          recurring_motifs: string[] | null
          relationship_density: string | null
          romance_level: number | null
          scene_count: number | null
          secondary_themes: string[] | null
          setting_period: string | null
          shot_variety: string | null
          slug: string | null
          social_commentary: string | null
          special_effects_usage: string | null
          story_originality_score: number | null
          studio_system: string | null
          subplot_count: number | null
          symbolic_density: string | null
          target_audience: string | null
          target_duration_min: number | null
          target_languages: string[] | null
          tension_curve: string | null
          thematic_resolution: string | null
          title: string
          tonal_shifts_count: number | null
          tone: string | null
          tone_consistency: string | null
          updated_at: string
          vfx_complexity: string | null
          vfx_requirements: string | null
          voice_over_usage: boolean | null
        }
        Insert: {
          act_structure?: Json | null
          action_density?: string | null
          action_intensity_average?: number | null
          age_rating?: string | null
          antagonist_type?: string | null
          avg_scene_length?: string | null
          bible_completeness_score?: number | null
          budget_cap_episode_eur?: number | null
          budget_cap_project_eur?: number | null
          budget_cap_scene_eur?: number | null
          budget_range?: string | null
          camera_movement_style?: string | null
          character_arc_complexity?: string | null
          character_arc_depth?: string | null
          character_count?: number | null
          character_development_score?: number | null
          character_transformation_depth?: string | null
          comedy_density?: number | null
          commercial_potential_score?: number | null
          comparative_films?: Json | null
          content_warnings?: string[] | null
          created_at?: string
          cultural_context?: string | null
          day_night_ratio?: string | null
          dialogue_character_voices?: Json | null
          dialogue_density?: number | null
          dialogue_quality_score?: number | null
          distribution_format?: string | null
          dramatic_irony_count?: number | null
          dramatic_tension_baseline?: number | null
          ensemble_cast?: boolean | null
          episodes_count?: number | null
          exposition_level?: string | null
          extracted_at?: string | null
          format?: string | null
          framing_device?: string | null
          generated_at?: string | null
          generation_mode?: string | null
          genre_extensions?: Json | null
          geographic_scope?: string | null
          horror_index?: number | null
          id?: string
          intertextual_analysis?: Json | null
          location_count?: number | null
          master_language?: string | null
          mcguffin?: boolean | null
          mentor_figure?: boolean | null
          meta_narrative_elements?: boolean | null
          metadata_completeness?: number | null
          monologue_count?: number | null
          mood?: string | null
          moral_ambiguity_level?: string | null
          narrative_density?: string | null
          narrative_structure_type?: string | null
          non_linear_elements?: boolean | null
          number_of_acts?: number | null
          original_title?: string | null
          owner_id?: string | null
          pacing?: string | null
          pacing_score?: number | null
          parallel_timelines?: boolean | null
          parser_metadata?: Json | null
          pov_style?: string | null
          practical_effects_ratio?: number | null
          primary_theme?: string | null
          production_scale?: string | null
          protagonist_count?: number | null
          protagonist_type?: string | null
          quality_metrics?: Json | null
          quiet_moments_frequency?: string | null
          rag_analysis_version?: string | null
          recurring_motifs?: string[] | null
          relationship_density?: string | null
          romance_level?: number | null
          scene_count?: number | null
          secondary_themes?: string[] | null
          setting_period?: string | null
          shot_variety?: string | null
          slug?: string | null
          social_commentary?: string | null
          special_effects_usage?: string | null
          story_originality_score?: number | null
          studio_system?: string | null
          subplot_count?: number | null
          symbolic_density?: string | null
          target_audience?: string | null
          target_duration_min?: number | null
          target_languages?: string[] | null
          tension_curve?: string | null
          thematic_resolution?: string | null
          title: string
          tonal_shifts_count?: number | null
          tone?: string | null
          tone_consistency?: string | null
          updated_at?: string
          vfx_complexity?: string | null
          vfx_requirements?: string | null
          voice_over_usage?: boolean | null
        }
        Update: {
          act_structure?: Json | null
          action_density?: string | null
          action_intensity_average?: number | null
          age_rating?: string | null
          antagonist_type?: string | null
          avg_scene_length?: string | null
          bible_completeness_score?: number | null
          budget_cap_episode_eur?: number | null
          budget_cap_project_eur?: number | null
          budget_cap_scene_eur?: number | null
          budget_range?: string | null
          camera_movement_style?: string | null
          character_arc_complexity?: string | null
          character_arc_depth?: string | null
          character_count?: number | null
          character_development_score?: number | null
          character_transformation_depth?: string | null
          comedy_density?: number | null
          commercial_potential_score?: number | null
          comparative_films?: Json | null
          content_warnings?: string[] | null
          created_at?: string
          cultural_context?: string | null
          day_night_ratio?: string | null
          dialogue_character_voices?: Json | null
          dialogue_density?: number | null
          dialogue_quality_score?: number | null
          distribution_format?: string | null
          dramatic_irony_count?: number | null
          dramatic_tension_baseline?: number | null
          ensemble_cast?: boolean | null
          episodes_count?: number | null
          exposition_level?: string | null
          extracted_at?: string | null
          format?: string | null
          framing_device?: string | null
          generated_at?: string | null
          generation_mode?: string | null
          genre_extensions?: Json | null
          geographic_scope?: string | null
          horror_index?: number | null
          id?: string
          intertextual_analysis?: Json | null
          location_count?: number | null
          master_language?: string | null
          mcguffin?: boolean | null
          mentor_figure?: boolean | null
          meta_narrative_elements?: boolean | null
          metadata_completeness?: number | null
          monologue_count?: number | null
          mood?: string | null
          moral_ambiguity_level?: string | null
          narrative_density?: string | null
          narrative_structure_type?: string | null
          non_linear_elements?: boolean | null
          number_of_acts?: number | null
          original_title?: string | null
          owner_id?: string | null
          pacing?: string | null
          pacing_score?: number | null
          parallel_timelines?: boolean | null
          parser_metadata?: Json | null
          pov_style?: string | null
          practical_effects_ratio?: number | null
          primary_theme?: string | null
          production_scale?: string | null
          protagonist_count?: number | null
          protagonist_type?: string | null
          quality_metrics?: Json | null
          quiet_moments_frequency?: string | null
          rag_analysis_version?: string | null
          recurring_motifs?: string[] | null
          relationship_density?: string | null
          romance_level?: number | null
          scene_count?: number | null
          secondary_themes?: string[] | null
          setting_period?: string | null
          shot_variety?: string | null
          slug?: string | null
          social_commentary?: string | null
          special_effects_usage?: string | null
          story_originality_score?: number | null
          studio_system?: string | null
          subplot_count?: number | null
          symbolic_density?: string | null
          target_audience?: string | null
          target_duration_min?: number | null
          target_languages?: string[] | null
          tension_curve?: string | null
          thematic_resolution?: string | null
          title?: string
          tonal_shifts_count?: number | null
          tone?: string | null
          tone_consistency?: string | null
          updated_at?: string
          vfx_complexity?: string | null
          vfx_requirements?: string | null
          voice_over_usage?: boolean | null
        }
        Relationships: []
      }
      scenes: {
        Row: {
          action_density: number | null
          action_line_count: number | null
          approval_status: string | null
          approved: boolean | null
          beats: Json | null
          camera_directions_explicit: string | null
          character_decision_moment: boolean | null
          character_emotional_arc: Json | null
          character_ids: string[] | null
          character_status_change: Json | null
          choreography_complexity: string | null
          conflict_intensity: number | null
          conflict_type: string | null
          created_at: string
          depth_of_field_implied: string | null
          dialect_usage: string | null
          dialogue_line_count: number | null
          dialogue_percentage: number | null
          diegetic_sound_cues: string[] | null
          emotional_carryover: number | null
          episode_no: number | null
          estimated_cost: Json | null
          estimated_duration_sec: number | null
          exposition_through_dialogue: boolean | null
          id: string
          lighting_implied: string | null
          location_change_type: string | null
          location_id: string | null
          location_name: string | null
          location_sublocation: string | null
          location_type: string | null
          longest_speech_words: number | null
          monologue_present: boolean | null
          mood: Json | null
          movement_energy: string | null
          music_cue_type: string | null
          new_information_revealed: Json | null
          non_diegetic_suggestions: string[] | null
          objective: string | null
          overlapping_dialogue: boolean | null
          parenthetical_count: number | null
          physical_environment_detail: string | null
          pov_character: string | null
          power_dynamic_shift: boolean | null
          priority: string | null
          project_id: string
          prop_continuity_items: Json | null
          quality_mode: string | null
          resolution_within_scene: boolean | null
          scene_function: string | null
          scene_length_pages: number | null
          scene_no: number
          scene_objective: string | null
          scene_type: string | null
          script_id: string | null
          season: string | null
          sensory_descriptions: Json | null
          silence_beats: number | null
          silence_intentional: boolean | null
          slugline: string | null
          sound_transitions: Json | null
          spatial_relationships: Json | null
          subtext_density: string | null
          suggested_shot_types: string[] | null
          summary: string | null
          time_gap_from_previous: string | null
          time_of_day: string | null
          time_specific: string | null
          transition_from_previous: string | null
          transition_type: string | null
          unfilmable_descriptions: number | null
          updated_at: string
          verbal_tic_tracking: Json | null
          visual_metaphor: string | null
          wardrobe_continuity_notes: string | null
          weather: string | null
          word_count: number | null
          wrylies_count: number | null
        }
        Insert: {
          action_density?: number | null
          action_line_count?: number | null
          approval_status?: string | null
          approved?: boolean | null
          beats?: Json | null
          camera_directions_explicit?: string | null
          character_decision_moment?: boolean | null
          character_emotional_arc?: Json | null
          character_ids?: string[] | null
          character_status_change?: Json | null
          choreography_complexity?: string | null
          conflict_intensity?: number | null
          conflict_type?: string | null
          created_at?: string
          depth_of_field_implied?: string | null
          dialect_usage?: string | null
          dialogue_line_count?: number | null
          dialogue_percentage?: number | null
          diegetic_sound_cues?: string[] | null
          emotional_carryover?: number | null
          episode_no?: number | null
          estimated_cost?: Json | null
          estimated_duration_sec?: number | null
          exposition_through_dialogue?: boolean | null
          id?: string
          lighting_implied?: string | null
          location_change_type?: string | null
          location_id?: string | null
          location_name?: string | null
          location_sublocation?: string | null
          location_type?: string | null
          longest_speech_words?: number | null
          monologue_present?: boolean | null
          mood?: Json | null
          movement_energy?: string | null
          music_cue_type?: string | null
          new_information_revealed?: Json | null
          non_diegetic_suggestions?: string[] | null
          objective?: string | null
          overlapping_dialogue?: boolean | null
          parenthetical_count?: number | null
          physical_environment_detail?: string | null
          pov_character?: string | null
          power_dynamic_shift?: boolean | null
          priority?: string | null
          project_id: string
          prop_continuity_items?: Json | null
          quality_mode?: string | null
          resolution_within_scene?: boolean | null
          scene_function?: string | null
          scene_length_pages?: number | null
          scene_no: number
          scene_objective?: string | null
          scene_type?: string | null
          script_id?: string | null
          season?: string | null
          sensory_descriptions?: Json | null
          silence_beats?: number | null
          silence_intentional?: boolean | null
          slugline?: string | null
          sound_transitions?: Json | null
          spatial_relationships?: Json | null
          subtext_density?: string | null
          suggested_shot_types?: string[] | null
          summary?: string | null
          time_gap_from_previous?: string | null
          time_of_day?: string | null
          time_specific?: string | null
          transition_from_previous?: string | null
          transition_type?: string | null
          unfilmable_descriptions?: number | null
          updated_at?: string
          verbal_tic_tracking?: Json | null
          visual_metaphor?: string | null
          wardrobe_continuity_notes?: string | null
          weather?: string | null
          word_count?: number | null
          wrylies_count?: number | null
        }
        Update: {
          action_density?: number | null
          action_line_count?: number | null
          approval_status?: string | null
          approved?: boolean | null
          beats?: Json | null
          camera_directions_explicit?: string | null
          character_decision_moment?: boolean | null
          character_emotional_arc?: Json | null
          character_ids?: string[] | null
          character_status_change?: Json | null
          choreography_complexity?: string | null
          conflict_intensity?: number | null
          conflict_type?: string | null
          created_at?: string
          depth_of_field_implied?: string | null
          dialect_usage?: string | null
          dialogue_line_count?: number | null
          dialogue_percentage?: number | null
          diegetic_sound_cues?: string[] | null
          emotional_carryover?: number | null
          episode_no?: number | null
          estimated_cost?: Json | null
          estimated_duration_sec?: number | null
          exposition_through_dialogue?: boolean | null
          id?: string
          lighting_implied?: string | null
          location_change_type?: string | null
          location_id?: string | null
          location_name?: string | null
          location_sublocation?: string | null
          location_type?: string | null
          longest_speech_words?: number | null
          monologue_present?: boolean | null
          mood?: Json | null
          movement_energy?: string | null
          music_cue_type?: string | null
          new_information_revealed?: Json | null
          non_diegetic_suggestions?: string[] | null
          objective?: string | null
          overlapping_dialogue?: boolean | null
          parenthetical_count?: number | null
          physical_environment_detail?: string | null
          pov_character?: string | null
          power_dynamic_shift?: boolean | null
          priority?: string | null
          project_id?: string
          prop_continuity_items?: Json | null
          quality_mode?: string | null
          resolution_within_scene?: boolean | null
          scene_function?: string | null
          scene_length_pages?: number | null
          scene_no?: number
          scene_objective?: string | null
          scene_type?: string | null
          script_id?: string | null
          season?: string | null
          sensory_descriptions?: Json | null
          silence_beats?: number | null
          silence_intentional?: boolean | null
          slugline?: string | null
          sound_transitions?: Json | null
          spatial_relationships?: Json | null
          subtext_density?: string | null
          suggested_shot_types?: string[] | null
          summary?: string | null
          time_gap_from_previous?: string | null
          time_of_day?: string | null
          time_specific?: string | null
          transition_from_previous?: string | null
          transition_type?: string | null
          unfilmable_descriptions?: number | null
          updated_at?: string
          verbal_tic_tracking?: Json | null
          visual_metaphor?: string | null
          wardrobe_continuity_notes?: string | null
          weather?: string | null
          word_count?: number | null
          wrylies_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scenes_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenes_pov_character_fkey"
            columns: ["pov_character"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenes_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      screenplay_acts: {
        Row: {
          act_arc: string | null
          act_name: string | null
          act_number: number
          act_type: string | null
          action_to_dialogue_ratio: number | null
          alliance_shifts: Json | null
          avg_scene_length_pages: number | null
          betrayal_moments: Json | null
          character_entrances_count: number | null
          character_exits_count: number | null
          climax_type: string | null
          comedic_relief_placement: string | null
          created_at: string
          crisis_point: boolean | null
          dramatic_question: string | null
          duration_estimated_min: number | null
          emotional_peak_type: string | null
          emotional_valley_type: string | null
          id: string
          inciting_incident: boolean | null
          longest_scene_pages: number | null
          midpoint_turn: boolean | null
          montage_count: number | null
          pacing_overall: string | null
          page_count: number | null
          page_end: number | null
          page_start: number | null
          pov_character: string | null
          project_id: string
          resolution_type: string | null
          revelation_moments: Json | null
          scene_count: number | null
          shortest_scene_pages: number | null
          stakes_level: string | null
          suspense_sustained_minutes: number | null
          tension_curve_type: string | null
          time_compression: boolean | null
          time_expansion: boolean | null
          tonal_shift_from_previous: string | null
          updated_at: string
          word_count: number | null
        }
        Insert: {
          act_arc?: string | null
          act_name?: string | null
          act_number: number
          act_type?: string | null
          action_to_dialogue_ratio?: number | null
          alliance_shifts?: Json | null
          avg_scene_length_pages?: number | null
          betrayal_moments?: Json | null
          character_entrances_count?: number | null
          character_exits_count?: number | null
          climax_type?: string | null
          comedic_relief_placement?: string | null
          created_at?: string
          crisis_point?: boolean | null
          dramatic_question?: string | null
          duration_estimated_min?: number | null
          emotional_peak_type?: string | null
          emotional_valley_type?: string | null
          id?: string
          inciting_incident?: boolean | null
          longest_scene_pages?: number | null
          midpoint_turn?: boolean | null
          montage_count?: number | null
          pacing_overall?: string | null
          page_count?: number | null
          page_end?: number | null
          page_start?: number | null
          pov_character?: string | null
          project_id: string
          resolution_type?: string | null
          revelation_moments?: Json | null
          scene_count?: number | null
          shortest_scene_pages?: number | null
          stakes_level?: string | null
          suspense_sustained_minutes?: number | null
          tension_curve_type?: string | null
          time_compression?: boolean | null
          time_expansion?: boolean | null
          tonal_shift_from_previous?: string | null
          updated_at?: string
          word_count?: number | null
        }
        Update: {
          act_arc?: string | null
          act_name?: string | null
          act_number?: number
          act_type?: string | null
          action_to_dialogue_ratio?: number | null
          alliance_shifts?: Json | null
          avg_scene_length_pages?: number | null
          betrayal_moments?: Json | null
          character_entrances_count?: number | null
          character_exits_count?: number | null
          climax_type?: string | null
          comedic_relief_placement?: string | null
          created_at?: string
          crisis_point?: boolean | null
          dramatic_question?: string | null
          duration_estimated_min?: number | null
          emotional_peak_type?: string | null
          emotional_valley_type?: string | null
          id?: string
          inciting_incident?: boolean | null
          longest_scene_pages?: number | null
          midpoint_turn?: boolean | null
          montage_count?: number | null
          pacing_overall?: string | null
          page_count?: number | null
          page_end?: number | null
          page_start?: number | null
          pov_character?: string | null
          project_id?: string
          resolution_type?: string | null
          revelation_moments?: Json | null
          scene_count?: number | null
          shortest_scene_pages?: number | null
          stakes_level?: string | null
          suspense_sustained_minutes?: number | null
          tension_curve_type?: string | null
          time_compression?: boolean | null
          time_expansion?: boolean | null
          tonal_shift_from_previous?: string | null
          updated_at?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "screenplay_acts_pov_character_fkey"
            columns: ["pov_character"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screenplay_acts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      screenplay_beats: {
        Row: {
          audience_effect: string | null
          beat_duration_estimated_sec: number | null
          beat_function: string | null
          beat_number: number
          beat_text: string
          beat_timestamp_in_scene_sec: number | null
          beat_type: string | null
          character_action: string | null
          character_reaction: string | null
          connection_to_next_beat: string | null
          created_at: string
          cut_point_potential: boolean | null
          depth_layers: number | null
          dramatic_weight: number | null
          emotional_shift: string | null
          facial_expression_implied: string | null
          focus_subject: string | null
          gesture_implied: string | null
          id: string
          implied_angle: string | null
          implied_camera_movement: string | null
          implied_shot_scale: string | null
          information_payload: string | null
          music_sync_point: boolean | null
          pace_within_beat: string | null
          physical_intensity: number | null
          project_id: string
          scene_id: string
          shot_id: string | null
          silence_beat: boolean | null
          sound_event: string | null
          updated_at: string
          visual_rhythm: string | null
          voice_quality: string | null
        }
        Insert: {
          audience_effect?: string | null
          beat_duration_estimated_sec?: number | null
          beat_function?: string | null
          beat_number: number
          beat_text: string
          beat_timestamp_in_scene_sec?: number | null
          beat_type?: string | null
          character_action?: string | null
          character_reaction?: string | null
          connection_to_next_beat?: string | null
          created_at?: string
          cut_point_potential?: boolean | null
          depth_layers?: number | null
          dramatic_weight?: number | null
          emotional_shift?: string | null
          facial_expression_implied?: string | null
          focus_subject?: string | null
          gesture_implied?: string | null
          id?: string
          implied_angle?: string | null
          implied_camera_movement?: string | null
          implied_shot_scale?: string | null
          information_payload?: string | null
          music_sync_point?: boolean | null
          pace_within_beat?: string | null
          physical_intensity?: number | null
          project_id: string
          scene_id: string
          shot_id?: string | null
          silence_beat?: boolean | null
          sound_event?: string | null
          updated_at?: string
          visual_rhythm?: string | null
          voice_quality?: string | null
        }
        Update: {
          audience_effect?: string | null
          beat_duration_estimated_sec?: number | null
          beat_function?: string | null
          beat_number?: number
          beat_text?: string
          beat_timestamp_in_scene_sec?: number | null
          beat_type?: string | null
          character_action?: string | null
          character_reaction?: string | null
          connection_to_next_beat?: string | null
          created_at?: string
          cut_point_potential?: boolean | null
          depth_layers?: number | null
          dramatic_weight?: number | null
          emotional_shift?: string | null
          facial_expression_implied?: string | null
          focus_subject?: string | null
          gesture_implied?: string | null
          id?: string
          implied_angle?: string | null
          implied_camera_movement?: string | null
          implied_shot_scale?: string | null
          information_payload?: string | null
          music_sync_point?: boolean | null
          pace_within_beat?: string | null
          physical_intensity?: number | null
          project_id?: string
          scene_id?: string
          shot_id?: string | null
          silence_beat?: boolean | null
          sound_event?: string | null
          updated_at?: string
          visual_rhythm?: string | null
          voice_quality?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "screenplay_beats_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screenplay_beats_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screenplay_beats_shot_id_fkey"
            columns: ["shot_id"]
            isOneToOne: false
            referencedRelation: "shots"
            referencedColumns: ["id"]
          },
        ]
      }
      screenplay_cross_cutting: {
        Row: {
          action_writing_score: number | null
          ai_model_used: string | null
          character_depth_score: number | null
          comparable_budget_films: string[] | null
          confidence_score: number | null
          created_at: string
          cultural_references: string[] | null
          dialogue_quality_score: number | null
          emotional_impact_score: number | null
          genre_convention_adherence: number | null
          genre_subversion_moments: string[] | null
          homage_references: string[] | null
          id: string
          manual_overrides_count: number | null
          meta_awareness: boolean | null
          overall_screenplay_score: number | null
          pacing_effectiveness_score: number | null
          parse_duration_sec: number | null
          parse_timestamp: string | null
          parser_version: string | null
          period_accuracy: string | null
          project_id: string
          similar_directors: string[] | null
          similar_films: string[] | null
          similar_writers: string[] | null
          structural_comparisons: string[] | null
          structural_innovation_score: number | null
          tonal_comparisons: string[] | null
          updated_at: string
          visual_storytelling_score: number | null
        }
        Insert: {
          action_writing_score?: number | null
          ai_model_used?: string | null
          character_depth_score?: number | null
          comparable_budget_films?: string[] | null
          confidence_score?: number | null
          created_at?: string
          cultural_references?: string[] | null
          dialogue_quality_score?: number | null
          emotional_impact_score?: number | null
          genre_convention_adherence?: number | null
          genre_subversion_moments?: string[] | null
          homage_references?: string[] | null
          id?: string
          manual_overrides_count?: number | null
          meta_awareness?: boolean | null
          overall_screenplay_score?: number | null
          pacing_effectiveness_score?: number | null
          parse_duration_sec?: number | null
          parse_timestamp?: string | null
          parser_version?: string | null
          period_accuracy?: string | null
          project_id: string
          similar_directors?: string[] | null
          similar_films?: string[] | null
          similar_writers?: string[] | null
          structural_comparisons?: string[] | null
          structural_innovation_score?: number | null
          tonal_comparisons?: string[] | null
          updated_at?: string
          visual_storytelling_score?: number | null
        }
        Update: {
          action_writing_score?: number | null
          ai_model_used?: string | null
          character_depth_score?: number | null
          comparable_budget_films?: string[] | null
          confidence_score?: number | null
          created_at?: string
          cultural_references?: string[] | null
          dialogue_quality_score?: number | null
          emotional_impact_score?: number | null
          genre_convention_adherence?: number | null
          genre_subversion_moments?: string[] | null
          homage_references?: string[] | null
          id?: string
          manual_overrides_count?: number | null
          meta_awareness?: boolean | null
          overall_screenplay_score?: number | null
          pacing_effectiveness_score?: number | null
          parse_duration_sec?: number | null
          parse_timestamp?: string | null
          parser_version?: string | null
          period_accuracy?: string | null
          project_id?: string
          similar_directors?: string[] | null
          similar_films?: string[] | null
          similar_writers?: string[] | null
          structural_comparisons?: string[] | null
          structural_innovation_score?: number | null
          tonal_comparisons?: string[] | null
          updated_at?: string
          visual_storytelling_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "screenplay_cross_cutting_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      screenplay_genre_extensions: {
        Row: {
          action_body_count: number | null
          action_choreography_style: string | null
          action_climax_scale: string | null
          action_destruction_scale: string | null
          action_injury_realism: string | null
          action_one_on_one_ratio: number | null
          action_sequence_count: number | null
          animation_action_style: string | null
          animation_anthropomorphism_level: string | null
          animation_color_palette_vibrancy: number | null
          animation_comedic_physics: boolean | null
          animation_emotional_depth: string | null
          animation_style: string | null
          animation_target_age_group: string | null
          comedy_joke_density: number | null
          comedy_laugh_moments: number | null
          comedy_misunderstanding_count: number | null
          comedy_pratfall_count: number | null
          comedy_running_gags: number | null
          comedy_style: string | null
          comedy_timing_precision: string | null
          comedy_visual_gags_count: number | null
          created_at: string
          drama_class_representation: string | null
          drama_core_conflict: string | null
          drama_gender_dynamics: string | null
          drama_moral_ambiguity: number | null
          drama_reconciliation_possibility: number | null
          drama_relationship_dynamics: Json | null
          drama_sacrifice_moment: boolean | null
          drama_social_commentary: string[] | null
          horror_final_girl_archetype: boolean | null
          horror_gore_level: string | null
          horror_jump_scare_count: number | null
          horror_subgenre: string | null
          horror_supernatural_elements: string[] | null
          horror_sustained_dread: boolean | null
          horror_victim_count: number | null
          id: string
          primary_genre: string
          project_id: string
          scifi_ai_consciousness: boolean | null
          scifi_alien_species_count: number | null
          scifi_hard_science_accuracy: string | null
          scifi_paradox_count: number | null
          scifi_setting: string | null
          scifi_tech_level: string | null
          scifi_time_travel_elements: boolean | null
          scifi_world_building_depth: string | null
          updated_at: string
        }
        Insert: {
          action_body_count?: number | null
          action_choreography_style?: string | null
          action_climax_scale?: string | null
          action_destruction_scale?: string | null
          action_injury_realism?: string | null
          action_one_on_one_ratio?: number | null
          action_sequence_count?: number | null
          animation_action_style?: string | null
          animation_anthropomorphism_level?: string | null
          animation_color_palette_vibrancy?: number | null
          animation_comedic_physics?: boolean | null
          animation_emotional_depth?: string | null
          animation_style?: string | null
          animation_target_age_group?: string | null
          comedy_joke_density?: number | null
          comedy_laugh_moments?: number | null
          comedy_misunderstanding_count?: number | null
          comedy_pratfall_count?: number | null
          comedy_running_gags?: number | null
          comedy_style?: string | null
          comedy_timing_precision?: string | null
          comedy_visual_gags_count?: number | null
          created_at?: string
          drama_class_representation?: string | null
          drama_core_conflict?: string | null
          drama_gender_dynamics?: string | null
          drama_moral_ambiguity?: number | null
          drama_reconciliation_possibility?: number | null
          drama_relationship_dynamics?: Json | null
          drama_sacrifice_moment?: boolean | null
          drama_social_commentary?: string[] | null
          horror_final_girl_archetype?: boolean | null
          horror_gore_level?: string | null
          horror_jump_scare_count?: number | null
          horror_subgenre?: string | null
          horror_supernatural_elements?: string[] | null
          horror_sustained_dread?: boolean | null
          horror_victim_count?: number | null
          id?: string
          primary_genre: string
          project_id: string
          scifi_ai_consciousness?: boolean | null
          scifi_alien_species_count?: number | null
          scifi_hard_science_accuracy?: string | null
          scifi_paradox_count?: number | null
          scifi_setting?: string | null
          scifi_tech_level?: string | null
          scifi_time_travel_elements?: boolean | null
          scifi_world_building_depth?: string | null
          updated_at?: string
        }
        Update: {
          action_body_count?: number | null
          action_choreography_style?: string | null
          action_climax_scale?: string | null
          action_destruction_scale?: string | null
          action_injury_realism?: string | null
          action_one_on_one_ratio?: number | null
          action_sequence_count?: number | null
          animation_action_style?: string | null
          animation_anthropomorphism_level?: string | null
          animation_color_palette_vibrancy?: number | null
          animation_comedic_physics?: boolean | null
          animation_emotional_depth?: string | null
          animation_style?: string | null
          animation_target_age_group?: string | null
          comedy_joke_density?: number | null
          comedy_laugh_moments?: number | null
          comedy_misunderstanding_count?: number | null
          comedy_pratfall_count?: number | null
          comedy_running_gags?: number | null
          comedy_style?: string | null
          comedy_timing_precision?: string | null
          comedy_visual_gags_count?: number | null
          created_at?: string
          drama_class_representation?: string | null
          drama_core_conflict?: string | null
          drama_gender_dynamics?: string | null
          drama_moral_ambiguity?: number | null
          drama_reconciliation_possibility?: number | null
          drama_relationship_dynamics?: Json | null
          drama_sacrifice_moment?: boolean | null
          drama_social_commentary?: string[] | null
          horror_final_girl_archetype?: boolean | null
          horror_gore_level?: string | null
          horror_jump_scare_count?: number | null
          horror_subgenre?: string | null
          horror_supernatural_elements?: string[] | null
          horror_sustained_dread?: boolean | null
          horror_victim_count?: number | null
          id?: string
          primary_genre?: string
          project_id?: string
          scifi_ai_consciousness?: boolean | null
          scifi_alien_species_count?: number | null
          scifi_hard_science_accuracy?: string | null
          scifi_paradox_count?: number | null
          scifi_setting?: string | null
          scifi_tech_level?: string | null
          scifi_time_travel_elements?: boolean | null
          scifi_world_building_depth?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "screenplay_genre_extensions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      scripts: {
        Row: {
          created_at: string
          file_url: string | null
          id: string
          parsed_json: Json | null
          project_id: string
          raw_text: string | null
          status: string | null
          updated_at: string
          version: number | null
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          id?: string
          parsed_json?: Json | null
          project_id: string
          raw_text?: string | null
          status?: string | null
          updated_at?: string
          version?: number | null
        }
        Update: {
          created_at?: string
          file_url?: string | null
          id?: string
          parsed_json?: Json | null
          project_id?: string
          raw_text?: string | null
          status?: string | null
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scripts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_memory: {
        Row: {
          created_at: string | null
          id: string
          key: string
          node_id: string
          updated_at: string | null
          value: Json
          version: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          node_id: string
          updated_at?: string | null
          value: Json
          version?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          node_id?: string
          updated_at?: string | null
          value?: Json
          version?: number | null
        }
        Relationships: []
      }
      shopping_list: {
        Row: {
          created_at: string
          id: string
          is_completed: boolean | null
          items: Json
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_completed?: boolean | null
          items?: Json
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          is_completed?: boolean | null
          items?: Json
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      shots: {
        Row: {
          approval_status: string | null
          approved: boolean | null
          assigned_role: string | null
          blocking: Json | null
          camera: Json | null
          camera_angle: string | null
          camera_movement: string | null
          color_temperature: string | null
          composition_rule: string | null
          created_at: string
          dialogue_text: string | null
          duration_target: number | null
          editing_intention: string | null
          effective_mode: string | null
          engine: string | null
          estimated_cost: Json | null
          fields_json: Json | null
          focus_depth: string | null
          hero: boolean | null
          id: string
          lighting_key: string | null
          prompt_json: Json | null
          render_status: string | null
          scene_id: string
          shot_no: number
          shot_scale: string | null
          shot_type: Json | null
          sound_plan: Json | null
          updated_at: string
        }
        Insert: {
          approval_status?: string | null
          approved?: boolean | null
          assigned_role?: string | null
          blocking?: Json | null
          camera?: Json | null
          camera_angle?: string | null
          camera_movement?: string | null
          color_temperature?: string | null
          composition_rule?: string | null
          created_at?: string
          dialogue_text?: string | null
          duration_target?: number | null
          editing_intention?: string | null
          effective_mode?: string | null
          engine?: string | null
          estimated_cost?: Json | null
          fields_json?: Json | null
          focus_depth?: string | null
          hero?: boolean | null
          id?: string
          lighting_key?: string | null
          prompt_json?: Json | null
          render_status?: string | null
          scene_id: string
          shot_no: number
          shot_scale?: string | null
          shot_type?: Json | null
          sound_plan?: Json | null
          updated_at?: string
        }
        Update: {
          approval_status?: string | null
          approved?: boolean | null
          assigned_role?: string | null
          blocking?: Json | null
          camera?: Json | null
          camera_angle?: string | null
          camera_movement?: string | null
          color_temperature?: string | null
          composition_rule?: string | null
          created_at?: string
          dialogue_text?: string | null
          duration_target?: number | null
          editing_intention?: string | null
          effective_mode?: string | null
          engine?: string | null
          estimated_cost?: Json | null
          fields_json?: Json | null
          focus_depth?: string | null
          hero?: boolean | null
          id?: string
          lighting_key?: string | null
          prompt_json?: Json | null
          render_status?: string | null
          scene_id?: string
          shot_no?: number
          shot_scale?: string | null
          shot_type?: Json | null
          sound_plan?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shots_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      specialist_memory: {
        Row: {
          content: string
          context: Json | null
          created_at: string | null
          expires_at: string | null
          id: string
          importance: number | null
          last_used: string | null
          memory_type: string
          specialist: string
          user_id: string | null
        }
        Insert: {
          content: string
          context?: Json | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          importance?: number | null
          last_used?: string | null
          memory_type: string
          specialist: string
          user_id?: string | null
        }
        Update: {
          content?: string
          context?: Json | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          importance?: number | null
          last_used?: string | null
          memory_type?: string
          specialist?: string
          user_id?: string | null
        }
        Relationships: []
      }
      suggestions: {
        Row: {
          content: Json
          created_at: string
          id: string
          source_transcription_id: string | null
          status: string
          suggestion_type: string
          user_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          source_transcription_id?: string | null
          status?: string
          suggestion_type: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          source_transcription_id?: string | null
          status?: string
          suggestion_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_source_transcription_id_fkey"
            columns: ["source_transcription_id"]
            isOneToOne: false
            referencedRelation: "transcriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      supplement_logs: {
        Row: {
          date: string
          id: string
          supplement_name: string
          taken_at: string
          user_id: string
        }
        Insert: {
          date?: string
          id?: string
          supplement_name: string
          taken_at?: string
          user_id: string
        }
        Update: {
          date?: string
          id?: string
          supplement_name?: string
          taken_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          due_date: string | null
          duration: number
          id: string
          priority: string
          source: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          duration?: number
          id?: string
          priority?: string
          source?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          duration?: number
          id?: string
          priority?: string
          source?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      transcriptions: {
        Row: {
          brain: string | null
          created_at: string
          entities_json: Json | null
          id: string
          processed_at: string | null
          raw_text: string
          source: string
          summary: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          brain?: string | null
          created_at?: string
          entities_json?: Json | null
          id?: string
          processed_at?: string | null
          raw_text: string
          source?: string
          summary?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          brain?: string | null
          created_at?: string
          entities_json?: Json | null
          id?: string
          processed_at?: string | null
          raw_text?: string
          source?: string
          summary?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_devices: {
        Row: {
          created_at: string | null
          device_token: string
          id: string
          last_notification_at: string | null
          platform: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          device_token: string
          id?: string
          last_notification_at?: string | null
          platform: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          device_token?: string
          id?: string
          last_notification_at?: string | null
          platform?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_integrations: {
        Row: {
          created_at: string
          google_access_token: string | null
          google_calendar_enabled: boolean | null
          google_refresh_token: string | null
          google_token_expires_at: string | null
          icloud_calendars: Json | null
          icloud_email: string | null
          icloud_enabled: boolean | null
          icloud_last_sync: string | null
          icloud_password_encrypted: string | null
          id: string
          telegram_chat_id: string | null
          updated_at: string
          user_id: string
          whatsapp_phone: string | null
        }
        Insert: {
          created_at?: string
          google_access_token?: string | null
          google_calendar_enabled?: boolean | null
          google_refresh_token?: string | null
          google_token_expires_at?: string | null
          icloud_calendars?: Json | null
          icloud_email?: string | null
          icloud_enabled?: boolean | null
          icloud_last_sync?: string | null
          icloud_password_encrypted?: string | null
          id?: string
          telegram_chat_id?: string | null
          updated_at?: string
          user_id: string
          whatsapp_phone?: string | null
        }
        Update: {
          created_at?: string
          google_access_token?: string | null
          google_calendar_enabled?: boolean | null
          google_refresh_token?: string | null
          google_token_expires_at?: string | null
          icloud_calendars?: Json | null
          icloud_email?: string | null
          icloud_enabled?: boolean | null
          icloud_last_sync?: string | null
          icloud_password_encrypted?: string | null
          id?: string
          telegram_chat_id?: string | null
          updated_at?: string
          user_id?: string
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      user_profile: {
        Row: {
          auto_decisions: Json | null
          best_focus_time: string | null
          bosco_settings: Json | null
          cognitive_style: string | null
          communication_style: Json | null
          created_at: string
          current_context: string | null
          current_mode: string | null
          daily_routine: Json | null
          emotional_history: Json | null
          family_context: Json | null
          fatigue_time: string | null
          food_dislikes: Json | null
          food_preferences: Json | null
          health_profile: Json | null
          id: string
          learned_patterns: Json | null
          life_goals: Json | null
          mode_activated_at: string | null
          name: string | null
          needs_buffers: boolean | null
          personal_principles: Json | null
          personal_rules: Json | null
          planning_rules: Json | null
          primary_language: string | null
          professional_goals: Json | null
          require_confirmation: Json | null
          rest_rules: Json | null
          secondary_language: string | null
          special_days: Json | null
          updated_at: string
          user_id: string
          vital_role: string | null
        }
        Insert: {
          auto_decisions?: Json | null
          best_focus_time?: string | null
          bosco_settings?: Json | null
          cognitive_style?: string | null
          communication_style?: Json | null
          created_at?: string
          current_context?: string | null
          current_mode?: string | null
          daily_routine?: Json | null
          emotional_history?: Json | null
          family_context?: Json | null
          fatigue_time?: string | null
          food_dislikes?: Json | null
          food_preferences?: Json | null
          health_profile?: Json | null
          id?: string
          learned_patterns?: Json | null
          life_goals?: Json | null
          mode_activated_at?: string | null
          name?: string | null
          needs_buffers?: boolean | null
          personal_principles?: Json | null
          personal_rules?: Json | null
          planning_rules?: Json | null
          primary_language?: string | null
          professional_goals?: Json | null
          require_confirmation?: Json | null
          rest_rules?: Json | null
          secondary_language?: string | null
          special_days?: Json | null
          updated_at?: string
          user_id: string
          vital_role?: string | null
        }
        Update: {
          auto_decisions?: Json | null
          best_focus_time?: string | null
          bosco_settings?: Json | null
          cognitive_style?: string | null
          communication_style?: Json | null
          created_at?: string
          current_context?: string | null
          current_mode?: string | null
          daily_routine?: Json | null
          emotional_history?: Json | null
          family_context?: Json | null
          fatigue_time?: string | null
          food_dislikes?: Json | null
          food_preferences?: Json | null
          health_profile?: Json | null
          id?: string
          learned_patterns?: Json | null
          life_goals?: Json | null
          mode_activated_at?: string | null
          name?: string | null
          needs_buffers?: boolean | null
          personal_principles?: Json | null
          personal_rules?: Json | null
          planning_rules?: Json | null
          primary_language?: string | null
          professional_goals?: Json | null
          require_confirmation?: Json | null
          rest_rules?: Json | null
          secondary_language?: string | null
          special_days?: Json | null
          updated_at?: string
          user_id?: string
          vital_role?: string | null
        }
        Relationships: []
      }
      user_profile_extended: {
        Row: {
          bosco_child_info: Json | null
          coach_notes: Json | null
          created_at: string | null
          english_level: string | null
          english_notes: Json | null
          english_progress: Json | null
          goals: Json | null
          id: string
          last_coach_session: string | null
          last_potus_analysis: string | null
          nutrition_notes: Json | null
          nutrition_preferences: Json | null
          potus_insights: Json | null
          preferences: Json | null
          total_coach_sessions: number | null
          updated_at: string | null
          user_id: string | null
          workout_preferences: Json | null
        }
        Insert: {
          bosco_child_info?: Json | null
          coach_notes?: Json | null
          created_at?: string | null
          english_level?: string | null
          english_notes?: Json | null
          english_progress?: Json | null
          goals?: Json | null
          id?: string
          last_coach_session?: string | null
          last_potus_analysis?: string | null
          nutrition_notes?: Json | null
          nutrition_preferences?: Json | null
          potus_insights?: Json | null
          preferences?: Json | null
          total_coach_sessions?: number | null
          updated_at?: string | null
          user_id?: string | null
          workout_preferences?: Json | null
        }
        Update: {
          bosco_child_info?: Json | null
          coach_notes?: Json | null
          created_at?: string | null
          english_level?: string | null
          english_notes?: Json | null
          english_progress?: Json | null
          goals?: Json | null
          id?: string
          last_coach_session?: string | null
          last_potus_analysis?: string | null
          nutrition_notes?: Json | null
          nutrition_preferences?: Json | null
          potus_insights?: Json | null
          preferences?: Json | null
          total_coach_sessions?: number | null
          updated_at?: string | null
          user_id?: string | null
          workout_preferences?: Json | null
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          font_size: string
          id: string
          language: string
          pomodoro_long_break: number
          pomodoro_short_break: number
          pomodoro_work_duration: number
          section_visibility: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          font_size?: string
          id?: string
          language?: string
          pomodoro_long_break?: number
          pomodoro_short_break?: number
          pomodoro_work_duration?: number
          section_visibility?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          font_size?: string
          id?: string
          language?: string
          pomodoro_long_break?: number
          pomodoro_short_break?: number
          pomodoro_work_duration?: number
          section_visibility?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_telegram_links: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          linked_at: string
          telegram_chat_id: string | null
          telegram_first_name: string | null
          telegram_user_id: string
          telegram_username: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          linked_at?: string
          telegram_chat_id?: string | null
          telegram_first_name?: string | null
          telegram_user_id: string
          telegram_username?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          linked_at?: string
          telegram_chat_id?: string | null
          telegram_first_name?: string | null
          telegram_user_id?: string
          telegram_username?: string | null
          user_id?: string
        }
        Relationships: []
      }
      weekly_patterns: {
        Row: {
          created_at: string | null
          id: string
          metrics: Json
          patterns: Json
          summary: string | null
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          metrics?: Json
          patterns?: Json
          summary?: string | null
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string | null
          id?: string
          metrics?: Json
          patterns?: Json
          summary?: string | null
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      whoop_data: {
        Row: {
          created_at: string
          data_date: string
          fetched_at: string
          hrv: number | null
          id: string
          raw_data: Json | null
          recovery_score: number | null
          resting_hr: number | null
          sleep_hours: number | null
          sleep_performance: number | null
          strain: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_date?: string
          fetched_at?: string
          hrv?: number | null
          id?: string
          raw_data?: Json | null
          recovery_score?: number | null
          resting_hr?: number | null
          sleep_hours?: number | null
          sleep_performance?: number | null
          strain?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_date?: string
          fetched_at?: string
          hrv?: number | null
          id?: string
          raw_data?: Json | null
          recovery_score?: number | null
          resting_hr?: number | null
          sleep_hours?: number | null
          sleep_performance?: number | null
          strain?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whoop_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_jarvis_context: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          category: string
          content: string
          importance: number
          last_accessed: string
          memory_type: string
        }[]
      }
      has_project_access: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: boolean
      }
      search_coaching_knowledge: {
        Args: {
          match_count?: number
          match_domain?: string
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          category: string
          content: string
          domain: string
          id: string
          similarity: number
          source: string
          title: string
        }[]
      }
      search_conversations: {
        Args: {
          match_count?: number
          match_threshold?: number
          p_brain?: string
          p_user_id: string
          query_embedding: string
        }
        Returns: {
          brain: string
          content: string
          date: string
          id: string
          metadata: Json
          people: string[]
          similarity: number
          summary: string
          transcription_id: string
        }[]
      }
      search_knowledge: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          category: string
          content: string
          id: string
          similarity: number
          source: string
        }[]
      }
      search_knowledge_text: {
        Args: { match_count?: number; query_text: string }
        Returns: {
          category: string
          content: string
          id: string
          rank: number
          source: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      user_owns_pipeline: { Args: { p_pipeline_id: string }; Returns: boolean }
    }
    Enums: {
      approval_status: "pending" | "approved" | "rejected"
      node_status: "online" | "offline" | "busy" | "maintenance" | "critical"
      priority_level: "P0" | "P1" | "P2"
      project_format: "series" | "mini" | "film" | "short" | "ad" | "comic"
      quality_mode: "CINE" | "ULTRA"
      task_priority: "low" | "normal" | "high" | "critical"
      task_state:
        | "pending_approval"
        | "queued"
        | "processing"
        | "completed"
        | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      approval_status: ["pending", "approved", "rejected"],
      node_status: ["online", "offline", "busy", "maintenance", "critical"],
      priority_level: ["P0", "P1", "P2"],
      project_format: ["series", "mini", "film", "short", "ad", "comic"],
      quality_mode: ["CINE", "ULTRA"],
      task_priority: ["low", "normal", "high", "critical"],
      task_state: [
        "pending_approval",
        "queued",
        "processing",
        "completed",
        "failed",
      ],
    },
  },
} as const
