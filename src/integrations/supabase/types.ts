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
