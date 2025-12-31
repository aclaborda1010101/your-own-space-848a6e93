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
          id: string
          pomodoro_long_break: number
          pomodoro_short_break: number
          pomodoro_work_duration: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pomodoro_long_break?: number
          pomodoro_short_break?: number
          pomodoro_work_duration?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
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
