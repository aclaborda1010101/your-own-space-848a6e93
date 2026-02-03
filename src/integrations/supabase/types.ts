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
      dismissed_alerts: {
        Row: {
          alert_id: string
          dismissed_at: string
          id: string
          user_id: string
        }
        Insert: {
          alert_id: string
          dismissed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          alert_id?: string
          dismissed_at?: string
          id?: string
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
      jarvis_emails_cache: {
        Row: {
          account: string
          created_at: string
          from_addr: string
          id: string
          is_read: boolean | null
          preview: string | null
          subject: string
          synced_at: string
          user_id: string
        }
        Insert: {
          account: string
          created_at?: string
          from_addr: string
          id?: string
          is_read?: boolean | null
          preview?: string | null
          subject: string
          synced_at?: string
          user_id: string
        }
        Update: {
          account?: string
          created_at?: string
          from_addr?: string
          id?: string
          is_read?: boolean | null
          preview?: string | null
          subject?: string
          synced_at?: string
          user_id?: string
        }
        Relationships: []
      }
      jarvis_whatsapp_cache: {
        Row: {
          chat_name: string
          created_at: string
          id: string
          is_read: boolean | null
          last_message: string
          last_time: string
          user_id: string
        }
        Insert: {
          chat_name: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          last_message: string
          last_time?: string
          user_id: string
        }
        Update: {
          chat_name?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          last_message?: string
          last_time?: string
          user_id?: string
        }
        Relationships: []
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
          created_at: string
          id: string
          message: string
          processed: boolean | null
          role: string
          user_id: string
          webhook_sent_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          processed?: boolean | null
          role: string
          user_id: string
          webhook_sent_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          processed?: boolean | null
          role?: string
          user_id?: string
          webhook_sent_at?: string | null
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
          duration: number
          id: string
          priority: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          duration?: number
          id?: string
          priority?: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          duration?: number
          id?: string
          priority?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_integrations: {
        Row: {
          created_at: string
          google_access_token: string | null
          google_refresh_token: string | null
          google_token_expires_at: string | null
          icloud_calendars: Json | null
          icloud_email: string | null
          icloud_enabled: boolean | null
          icloud_last_sync: string | null
          icloud_password_encrypted: string | null
          id: string
          potus_webhook_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          google_access_token?: string | null
          google_refresh_token?: string | null
          google_token_expires_at?: string | null
          icloud_calendars?: Json | null
          icloud_email?: string | null
          icloud_enabled?: boolean | null
          icloud_last_sync?: string | null
          icloud_password_encrypted?: string | null
          id?: string
          potus_webhook_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          google_access_token?: string | null
          google_refresh_token?: string | null
          google_token_expires_at?: string | null
          icloud_calendars?: Json | null
          icloud_email?: string | null
          icloud_enabled?: boolean | null
          icloud_last_sync?: string | null
          icloud_password_encrypted?: string | null
          id?: string
          potus_webhook_url?: string | null
          updated_at?: string
          user_id?: string
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
      user_settings: {
        Row: {
          created_at: string
          font_size: string
          id: string
          language: string
          pomodoro_long_break: number
          pomodoro_short_break: number
          pomodoro_work_duration: number
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
          updated_at?: string
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
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
