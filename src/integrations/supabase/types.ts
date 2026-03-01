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
        Relationships: [
          {
            foreignKeyName: "analyzed_scripts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      bl_audits: {
        Row: {
          business_size: string | null
          business_type: string | null
          client_email: string | null
          client_name: string | null
          created_at: string
          id: string
          name: string
          project_id: string | null
          public_questionnaire_enabled: boolean | null
          public_token: string | null
          sector: string | null
          user_id: string
        }
        Insert: {
          business_size?: string | null
          business_type?: string | null
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          id?: string
          name: string
          project_id?: string | null
          public_questionnaire_enabled?: boolean | null
          public_token?: string | null
          sector?: string | null
          user_id: string
        }
        Update: {
          business_size?: string | null
          business_type?: string | null
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          id?: string
          name?: string
          project_id?: string | null
          public_questionnaire_enabled?: boolean | null
          public_token?: string | null
          sector?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bl_audits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "business_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      bl_client_proposals: {
        Row: {
          client_email: string | null
          client_name: string | null
          created_at: string | null
          id: string
          notes: string | null
          project_id: string
          responded_at: string | null
          roadmap_id: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          client_email?: string | null
          client_name?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          project_id: string
          responded_at?: string | null
          roadmap_id?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          client_email?: string | null
          client_name?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          responded_at?: string | null
          roadmap_id?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bl_client_proposals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "business_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bl_client_proposals_roadmap_id_fkey"
            columns: ["roadmap_id"]
            isOneToOne: false
            referencedRelation: "bl_roadmaps"
            referencedColumns: ["id"]
          },
        ]
      }
      bl_diagnostics: {
        Row: {
          ai_opportunity_score: number | null
          audit_id: string | null
          automation_level: number | null
          bottlenecks: Json | null
          created_at: string | null
          data_gaps: Json | null
          data_readiness: number | null
          digital_maturity_score: number | null
          id: string
          manual_processes: Json | null
          network_label: string | null
          network_size: number | null
          person_dependencies: Json | null
          project_id: string | null
          quick_wins: Json | null
          time_leaks: Json | null
          underused_tools: Json | null
          updated_at: string | null
        }
        Insert: {
          ai_opportunity_score?: number | null
          audit_id?: string | null
          automation_level?: number | null
          bottlenecks?: Json | null
          created_at?: string | null
          data_gaps?: Json | null
          data_readiness?: number | null
          digital_maturity_score?: number | null
          id?: string
          manual_processes?: Json | null
          network_label?: string | null
          network_size?: number | null
          person_dependencies?: Json | null
          project_id?: string | null
          quick_wins?: Json | null
          time_leaks?: Json | null
          underused_tools?: Json | null
          updated_at?: string | null
        }
        Update: {
          ai_opportunity_score?: number | null
          audit_id?: string | null
          automation_level?: number | null
          bottlenecks?: Json | null
          created_at?: string | null
          data_gaps?: Json | null
          data_readiness?: number | null
          digital_maturity_score?: number | null
          id?: string
          manual_processes?: Json | null
          network_label?: string | null
          network_size?: number | null
          person_dependencies?: Json | null
          project_id?: string | null
          quick_wins?: Json | null
          time_leaks?: Json | null
          underused_tools?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bl_diagnostics_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: true
            referencedRelation: "bl_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bl_diagnostics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "business_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      bl_questionnaire_responses: {
        Row: {
          audit_id: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          project_id: string | null
          responses: Json
          template_id: string | null
        }
        Insert: {
          audit_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          project_id?: string | null
          responses?: Json
          template_id?: string | null
        }
        Update: {
          audit_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          project_id?: string | null
          responses?: Json
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bl_questionnaire_responses_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "bl_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bl_questionnaire_responses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "business_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bl_questionnaire_responses_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "bl_questionnaire_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      bl_questionnaire_templates: {
        Row: {
          business_size: string
          created_at: string | null
          id: string
          max_questions: number
          questions: Json
          sector: string
          version: number | null
        }
        Insert: {
          business_size: string
          created_at?: string | null
          id?: string
          max_questions: number
          questions: Json
          sector: string
          version?: number | null
        }
        Update: {
          business_size?: string
          created_at?: string | null
          id?: string
          max_questions?: number
          questions?: Json
          sector?: string
          version?: number | null
        }
        Relationships: []
      }
      bl_recommendations: {
        Row: {
          audit_id: string | null
          confidence_display: string
          confidence_score_internal: number | null
          created_at: string | null
          description: string | null
          difficulty: string
          difficulty_score: number | null
          estimation_source: string
          id: string
          implementable_under_14_days: boolean | null
          implementation_time: string | null
          investment_month_max: number | null
          investment_month_min: number | null
          layer: number
          priority_score: number | null
          productivity_uplift_pct_max: number | null
          productivity_uplift_pct_min: number | null
          project_id: string | null
          revenue_impact_month_max: number | null
          revenue_impact_month_min: number | null
          time_saved_hours_week_max: number | null
          time_saved_hours_week_min: number | null
          title: string
        }
        Insert: {
          audit_id?: string | null
          confidence_display?: string
          confidence_score_internal?: number | null
          created_at?: string | null
          description?: string | null
          difficulty?: string
          difficulty_score?: number | null
          estimation_source?: string
          id?: string
          implementable_under_14_days?: boolean | null
          implementation_time?: string | null
          investment_month_max?: number | null
          investment_month_min?: number | null
          layer: number
          priority_score?: number | null
          productivity_uplift_pct_max?: number | null
          productivity_uplift_pct_min?: number | null
          project_id?: string | null
          revenue_impact_month_max?: number | null
          revenue_impact_month_min?: number | null
          time_saved_hours_week_max?: number | null
          time_saved_hours_week_min?: number | null
          title: string
        }
        Update: {
          audit_id?: string | null
          confidence_display?: string
          confidence_score_internal?: number | null
          created_at?: string | null
          description?: string | null
          difficulty?: string
          difficulty_score?: number | null
          estimation_source?: string
          id?: string
          implementable_under_14_days?: boolean | null
          implementation_time?: string | null
          investment_month_max?: number | null
          investment_month_min?: number | null
          layer?: number
          priority_score?: number | null
          productivity_uplift_pct_max?: number | null
          productivity_uplift_pct_min?: number | null
          project_id?: string | null
          revenue_impact_month_max?: number | null
          revenue_impact_month_min?: number | null
          time_saved_hours_week_max?: number | null
          time_saved_hours_week_min?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "bl_recommendations_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "bl_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bl_recommendations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "business_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      bl_roadmaps: {
        Row: {
          audit_id: string | null
          created_at: string | null
          economic_impact: Json | null
          executive_summary: string | null
          full_document_md: string | null
          id: string
          implementation_model: string | null
          plan_12_months: Json | null
          plan_90_days: Json | null
          pricing_recommendation: Json | null
          project_id: string | null
          quick_wins_plan: Json | null
          version: number | null
        }
        Insert: {
          audit_id?: string | null
          created_at?: string | null
          economic_impact?: Json | null
          executive_summary?: string | null
          full_document_md?: string | null
          id?: string
          implementation_model?: string | null
          plan_12_months?: Json | null
          plan_90_days?: Json | null
          pricing_recommendation?: Json | null
          project_id?: string | null
          quick_wins_plan?: Json | null
          version?: number | null
        }
        Update: {
          audit_id?: string | null
          created_at?: string | null
          economic_impact?: Json | null
          executive_summary?: string | null
          full_document_md?: string | null
          id?: string
          implementation_model?: string | null
          plan_12_months?: Json | null
          plan_90_days?: Json | null
          pricing_recommendation?: Json | null
          project_id?: string | null
          quick_wins_plan?: Json | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bl_roadmaps_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "bl_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bl_roadmaps_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "business_projects"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "bosco_interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      bosco_observations: {
        Row: {
          area: string
          created_at: string
          date: string
          id: string
          observation: string
          sentiment: string | null
          tags: string[] | null
          theory_reference: string | null
          transcription_id: string | null
          user_id: string
        }
        Insert: {
          area: string
          created_at?: string
          date?: string
          id?: string
          observation: string
          sentiment?: string | null
          tags?: string[] | null
          theory_reference?: string | null
          transcription_id?: string | null
          user_id: string
        }
        Update: {
          area?: string
          created_at?: string
          date?: string
          id?: string
          observation?: string
          sentiment?: string | null
          tags?: string[] | null
          theory_reference?: string | null
          transcription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bosco_observations_transcription_id_fkey"
            columns: ["transcription_id"]
            isOneToOne: false
            referencedRelation: "transcriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      bosco_profile: {
        Row: {
          ai_recommendations: Json | null
          bio_narrative: string | null
          created_at: string
          development_areas: Json | null
          emotional_map: Json | null
          focus_areas: Json | null
          gardner_scores: Json | null
          id: string
          last_analysis_at: string | null
          observation_count: number | null
          personality_traits: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_recommendations?: Json | null
          bio_narrative?: string | null
          created_at?: string
          development_areas?: Json | null
          emotional_map?: Json | null
          focus_areas?: Json | null
          gardner_scores?: Json | null
          id?: string
          last_analysis_at?: string | null
          observation_count?: number | null
          personality_traits?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_recommendations?: Json | null
          bio_narrative?: string | null
          created_at?: string
          development_areas?: Json | null
          emotional_map?: Json | null
          focus_areas?: Json | null
          gardner_scores?: Json | null
          id?: string
          last_analysis_at?: string | null
          observation_count?: number | null
          personality_traits?: string[] | null
          updated_at?: string
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
      business_project_contacts: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          notes: string | null
          project_id: string
          role: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          notes?: string | null
          project_id: string
          role?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          project_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_project_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "people_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_project_contacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "business_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      business_project_timeline: {
        Row: {
          auto_detected: boolean
          channel: string
          contact_id: string | null
          created_at: string
          description: string | null
          event_date: string
          id: string
          project_id: string
          source_id: string | null
          title: string
        }
        Insert: {
          auto_detected?: boolean
          channel: string
          contact_id?: string | null
          created_at?: string
          description?: string | null
          event_date: string
          id?: string
          project_id: string
          source_id?: string | null
          title: string
        }
        Update: {
          auto_detected?: boolean
          channel?: string
          contact_id?: string | null
          created_at?: string
          description?: string | null
          event_date?: string
          id?: string
          project_id?: string
          source_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_project_timeline_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "people_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_project_timeline_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "business_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      business_projects: {
        Row: {
          analysis: Json | null
          auto_patterns: boolean | null
          business_size: string | null
          business_type: string | null
          close_probability: string | null
          close_reason: string | null
          closed_at: string | null
          company: string | null
          created_at: string
          current_step: number | null
          detected_at: string
          estimated_value: number | null
          id: string
          input_content: string | null
          input_type: string | null
          linked_rag_id: string | null
          name: string
          need_budget: string | null
          need_deadline: string | null
          need_decision_maker: string | null
          need_source_url: string | null
          need_summary: string | null
          need_why: string | null
          notes: string | null
          origin: string | null
          origin_source_id: string | null
          primary_contact_id: string | null
          project_type: string | null
          sector: string | null
          status: string
          time_horizon: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis?: Json | null
          auto_patterns?: boolean | null
          business_size?: string | null
          business_type?: string | null
          close_probability?: string | null
          close_reason?: string | null
          closed_at?: string | null
          company?: string | null
          created_at?: string
          current_step?: number | null
          detected_at?: string
          estimated_value?: number | null
          id?: string
          input_content?: string | null
          input_type?: string | null
          linked_rag_id?: string | null
          name: string
          need_budget?: string | null
          need_deadline?: string | null
          need_decision_maker?: string | null
          need_source_url?: string | null
          need_summary?: string | null
          need_why?: string | null
          notes?: string | null
          origin?: string | null
          origin_source_id?: string | null
          primary_contact_id?: string | null
          project_type?: string | null
          sector?: string | null
          status?: string
          time_horizon?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis?: Json | null
          auto_patterns?: boolean | null
          business_size?: string | null
          business_type?: string | null
          close_probability?: string | null
          close_reason?: string | null
          closed_at?: string | null
          company?: string | null
          created_at?: string
          current_step?: number | null
          detected_at?: string
          estimated_value?: number | null
          id?: string
          input_content?: string | null
          input_type?: string | null
          linked_rag_id?: string | null
          name?: string
          need_budget?: string | null
          need_deadline?: string | null
          need_decision_maker?: string | null
          need_source_url?: string | null
          need_summary?: string | null
          need_why?: string | null
          notes?: string | null
          origin?: string | null
          origin_source_id?: string | null
          primary_contact_id?: string | null
          project_type?: string | null
          sector?: string | null
          status?: string
          time_horizon?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_projects_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "people_contacts"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "check_ins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
        ]
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
      contact_aliases: {
        Row: {
          alias: string
          confidence: number | null
          contact_id: string
          context: string | null
          created_at: string | null
          id: string
          is_dismissed: boolean | null
          source: string
          user_id: string
        }
        Insert: {
          alias: string
          confidence?: number | null
          contact_id: string
          context?: string | null
          created_at?: string | null
          id?: string
          is_dismissed?: boolean | null
          source: string
          user_id: string
        }
        Update: {
          alias?: string
          confidence?: number | null
          contact_id?: string
          context?: string | null
          created_at?: string | null
          id?: string
          is_dismissed?: boolean | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_aliases_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "people_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_link_suggestions: {
        Row: {
          confidence: number | null
          confidence_reasons: Json | null
          created_at: string | null
          id: string
          mentioned_by: string | null
          mentioned_in_id: string | null
          mentioned_in_source: string
          mentioned_name: string
          resolved_at: string | null
          status: string | null
          suggested_contact: string | null
          user_id: string
        }
        Insert: {
          confidence?: number | null
          confidence_reasons?: Json | null
          created_at?: string | null
          id?: string
          mentioned_by?: string | null
          mentioned_in_id?: string | null
          mentioned_in_source: string
          mentioned_name: string
          resolved_at?: string | null
          status?: string | null
          suggested_contact?: string | null
          user_id: string
        }
        Update: {
          confidence?: number | null
          confidence_reasons?: Json | null
          created_at?: string | null
          id?: string
          mentioned_by?: string | null
          mentioned_in_id?: string | null
          mentioned_in_source?: string
          mentioned_name?: string
          resolved_at?: string | null
          status?: string | null
          suggested_contact?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_link_suggestions_mentioned_by_fkey"
            columns: ["mentioned_by"]
            isOneToOne: false
            referencedRelation: "people_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_link_suggestions_suggested_contact_fkey"
            columns: ["suggested_contact"]
            isOneToOne: false
            referencedRelation: "people_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_links: {
        Row: {
          context: string | null
          created_at: string
          first_mention_date: string | null
          id: string
          mentioned_name: string
          source_contact_id: string
          status: string
          target_contact_id: string
          user_id: string
        }
        Insert: {
          context?: string | null
          created_at?: string
          first_mention_date?: string | null
          id?: string
          mentioned_name: string
          source_contact_id: string
          status?: string
          target_contact_id: string
          user_id: string
        }
        Update: {
          context?: string | null
          created_at?: string
          first_mention_date?: string | null
          id?: string
          mentioned_name?: string
          source_contact_id?: string
          status?: string
          target_contact_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_links_source_contact_id_fkey"
            columns: ["source_contact_id"]
            isOneToOne: false
            referencedRelation: "people_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_links_target_contact_id_fkey"
            columns: ["target_contact_id"]
            isOneToOne: false
            referencedRelation: "people_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          chat_name: string | null
          contact_id: string | null
          content: string
          created_at: string
          direction: string
          id: string
          message_date: string | null
          sender: string | null
          source: string
          user_id: string
        }
        Insert: {
          chat_name?: string | null
          contact_id?: string | null
          content: string
          created_at?: string
          direction?: string
          id?: string
          message_date?: string | null
          sender?: string | null
          source?: string
          user_id: string
        }
        Update: {
          chat_name?: string | null
          contact_id?: string | null
          content?: string
          created_at?: string
          direction?: string
          id?: string
          message_date?: string | null
          sender?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "people_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_relationships: {
        Row: {
          contact_a_id: string
          contact_b_id: string
          context: string | null
          first_detected: string | null
          id: string
          mention_count: number | null
          relationship_type: string | null
          source: string | null
          user_id: string
        }
        Insert: {
          contact_a_id: string
          contact_b_id: string
          context?: string | null
          first_detected?: string | null
          id?: string
          mention_count?: number | null
          relationship_type?: string | null
          source?: string | null
          user_id: string
        }
        Update: {
          contact_a_id?: string
          contact_b_id?: string
          context?: string | null
          first_detected?: string | null
          id?: string
          mention_count?: number | null
          relationship_type?: string | null
          source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_relationships_contact_a_id_fkey"
            columns: ["contact_a_id"]
            isOneToOne: false
            referencedRelation: "people_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_relationships_contact_b_id_fkey"
            columns: ["contact_b_id"]
            isOneToOne: false
            referencedRelation: "people_contacts"
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
        Relationships: [
          {
            foreignKeyName: "conversation_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "daily_briefings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "daily_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
        ]
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
      data_sources_registry: {
        Row: {
          coverage_period: string | null
          created_at: string
          data_type: string | null
          id: string
          last_accessed: string | null
          reliability_score: number | null
          run_id: string | null
          scraped_content: string | null
          source_name: string
          source_type: string | null
          status: string | null
          update_frequency: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          coverage_period?: string | null
          created_at?: string
          data_type?: string | null
          id?: string
          last_accessed?: string | null
          reliability_score?: number | null
          run_id?: string | null
          scraped_content?: string | null
          source_name: string
          source_type?: string | null
          status?: string | null
          update_frequency?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          coverage_period?: string | null
          created_at?: string
          data_type?: string | null
          id?: string
          last_accessed?: string | null
          reliability_score?: number | null
          run_id?: string | null
          scraped_content?: string | null
          source_name?: string
          source_type?: string | null
          status?: string | null
          update_frequency?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_sources_registry_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "pattern_detector_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      detected_patterns: {
        Row: {
          anticipation_days: number | null
          confidence: number | null
          counter_evidence: string | null
          created_at: string
          data_sources: Json | null
          description: string | null
          evidence_chunk_ids: string[] | null
          evidence_summary: string | null
          id: string
          impact: number | null
          layer: number
          layer_name: string
          name: string
          p_value: number | null
          project_id: string
          rag_id: string
          retrospective_cases: Json | null
          run_id: string
          uncertainty_type: string | null
          user_id: string
          validation_status: string | null
        }
        Insert: {
          anticipation_days?: number | null
          confidence?: number | null
          counter_evidence?: string | null
          created_at?: string
          data_sources?: Json | null
          description?: string | null
          evidence_chunk_ids?: string[] | null
          evidence_summary?: string | null
          id?: string
          impact?: number | null
          layer: number
          layer_name: string
          name: string
          p_value?: number | null
          project_id: string
          rag_id: string
          retrospective_cases?: Json | null
          run_id: string
          uncertainty_type?: string | null
          user_id: string
          validation_status?: string | null
        }
        Update: {
          anticipation_days?: number | null
          confidence?: number | null
          counter_evidence?: string | null
          created_at?: string
          data_sources?: Json | null
          description?: string | null
          evidence_chunk_ids?: string[] | null
          evidence_summary?: string | null
          id?: string
          impact?: number | null
          layer?: number
          layer_name?: string
          name?: string
          p_value?: number | null
          project_id?: string
          rag_id?: string
          retrospective_cases?: Json | null
          run_id?: string
          uncertainty_type?: string | null
          user_id?: string
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "detected_patterns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "business_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detected_patterns_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "pattern_detection_runs"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "dismissed_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      economic_backtests: {
        Row: {
          assumptions: Json | null
          backtest_id: string
          calculation_method: string | null
          capital_tied_up_cost: number | null
          cost_of_capital_pct: number | null
          created_at: string | null
          error_intelligence: Json | null
          event_breakdown: Json | null
          gross_revenue_protected: number | null
          id: string
          loyalty_bonus_included: boolean | null
          margin_used_pct: number | null
          net_economic_impact: number | null
          payback_period_days: number | null
          per_pharmacy_impact: number | null
          period_end: string | null
          period_start: string | null
          reputational_damage_included: boolean | null
          roi_multiplier: number | null
          run_id: string
          total_pharmacies: number | null
          unprevented_losses: number | null
          user_id: string
        }
        Insert: {
          assumptions?: Json | null
          backtest_id: string
          calculation_method?: string | null
          capital_tied_up_cost?: number | null
          cost_of_capital_pct?: number | null
          created_at?: string | null
          error_intelligence?: Json | null
          event_breakdown?: Json | null
          gross_revenue_protected?: number | null
          id?: string
          loyalty_bonus_included?: boolean | null
          margin_used_pct?: number | null
          net_economic_impact?: number | null
          payback_period_days?: number | null
          per_pharmacy_impact?: number | null
          period_end?: string | null
          period_start?: string | null
          reputational_damage_included?: boolean | null
          roi_multiplier?: number | null
          run_id: string
          total_pharmacies?: number | null
          unprevented_losses?: number | null
          user_id: string
        }
        Update: {
          assumptions?: Json | null
          backtest_id?: string
          calculation_method?: string | null
          capital_tied_up_cost?: number | null
          cost_of_capital_pct?: number | null
          created_at?: string | null
          error_intelligence?: Json | null
          event_breakdown?: Json | null
          gross_revenue_protected?: number | null
          id?: string
          loyalty_bonus_included?: boolean | null
          margin_used_pct?: number | null
          net_economic_impact?: number | null
          payback_period_days?: number | null
          per_pharmacy_impact?: number | null
          period_end?: string | null
          period_start?: string | null
          reputational_damage_included?: boolean | null
          roi_multiplier?: number | null
          run_id?: string
          total_pharmacies?: number | null
          unprevented_losses?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "economic_backtests_backtest_id_fkey"
            columns: ["backtest_id"]
            isOneToOne: false
            referencedRelation: "model_backtests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economic_backtests_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "pattern_detector_runs"
            referencedColumns: ["id"]
          },
        ]
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
      emails: {
        Row: {
          body: string | null
          contact_id: string | null
          created_at: string | null
          from_email: string
          from_name: string | null
          id: string
          is_read: boolean | null
          message_id: string
          received_at: string
          subject: string | null
          to_email: string
          user_id: string
        }
        Insert: {
          body?: string | null
          contact_id?: string | null
          created_at?: string | null
          from_email: string
          from_name?: string | null
          id?: string
          is_read?: boolean | null
          message_id: string
          received_at: string
          subject?: string | null
          to_email: string
          user_id: string
        }
        Update: {
          body?: string | null
          contact_id?: string | null
          created_at?: string | null
          from_email?: string
          from_name?: string | null
          id?: string
          is_read?: boolean | null
          message_id?: string
          received_at?: string
          subject?: string | null
          to_email?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emails_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "generation_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
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
        Relationships: [
          {
            foreignKeyName: "jarvis_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      jarvis_emails_cache: {
        Row: {
          account: string | null
          ai_extracted: Json | null
          ai_processed: boolean | null
          attachments_meta: Json | null
          bcc_addr: string | null
          body_html: string | null
          body_text: string | null
          cc_addr: string | null
          created_at: string | null
          direction: string | null
          email_language: string | null
          email_type: string | null
          from_addr: string | null
          has_attachments: boolean | null
          id: string
          importance: string | null
          is_auto_reply: boolean | null
          is_forwarded: boolean | null
          is_read: boolean | null
          message_id: string
          original_sender: string | null
          preview: string | null
          received_at: string | null
          reply_to_id: string | null
          signature_parsed: Json | null
          signature_raw: string | null
          subject: string | null
          synced_at: string | null
          thread_id: string | null
          to_addr: string | null
          user_id: string
        }
        Insert: {
          account?: string | null
          ai_extracted?: Json | null
          ai_processed?: boolean | null
          attachments_meta?: Json | null
          bcc_addr?: string | null
          body_html?: string | null
          body_text?: string | null
          cc_addr?: string | null
          created_at?: string | null
          direction?: string | null
          email_language?: string | null
          email_type?: string | null
          from_addr?: string | null
          has_attachments?: boolean | null
          id?: string
          importance?: string | null
          is_auto_reply?: boolean | null
          is_forwarded?: boolean | null
          is_read?: boolean | null
          message_id: string
          original_sender?: string | null
          preview?: string | null
          received_at?: string | null
          reply_to_id?: string | null
          signature_parsed?: Json | null
          signature_raw?: string | null
          subject?: string | null
          synced_at?: string | null
          thread_id?: string | null
          to_addr?: string | null
          user_id: string
        }
        Update: {
          account?: string | null
          ai_extracted?: Json | null
          ai_processed?: boolean | null
          attachments_meta?: Json | null
          bcc_addr?: string | null
          body_html?: string | null
          body_text?: string | null
          cc_addr?: string | null
          created_at?: string | null
          direction?: string | null
          email_language?: string | null
          email_type?: string | null
          from_addr?: string | null
          has_attachments?: boolean | null
          id?: string
          importance?: string | null
          is_auto_reply?: boolean | null
          is_forwarded?: boolean | null
          is_read?: boolean | null
          message_id?: string
          original_sender?: string | null
          preview?: string | null
          received_at?: string | null
          reply_to_id?: string | null
          signature_parsed?: Json | null
          signature_raw?: string | null
          subject?: string | null
          synced_at?: string | null
          thread_id?: string | null
          to_addr?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jarvis_emails_cache_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "jarvis_memory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "jarvis_whatsapp_cache_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      jarvis_whoop_data: {
        Row: {
          data_date: string | null
          date: string | null
          hrv: number | null
          id: string
          recovery_score: number | null
          resting_hr: number | null
          sleep_hours: number | null
          sleep_performance: number | null
          strain: number | null
          synced_at: string | null
          user_id: string | null
        }
        Insert: {
          data_date?: string | null
          date?: string | null
          hrv?: number | null
          id?: string
          recovery_score?: number | null
          resting_hr?: number | null
          sleep_hours?: number | null
          sleep_performance?: number | null
          strain?: number | null
          synced_at?: string | null
          user_id?: string | null
        }
        Update: {
          data_date?: string | null
          date?: string | null
          hrv?: number | null
          id?: string
          recovery_score?: number | null
          resting_hr?: number | null
          sleep_hours?: number | null
          sleep_performance?: number | null
          strain?: number | null
          synced_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jarvis_whoop_data_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
        ]
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
      model_backtests: {
        Row: {
          avg_anticipation_days: number | null
          baseline_rmse: number | null
          complexity_justified: boolean | null
          cost_simulation: Json | null
          created_at: string
          false_negatives: number | null
          false_positives: number | null
          id: string
          model_rmse: number | null
          naive_rmse: number | null
          precision_pct: number | null
          recall_pct: number | null
          retrospective_cases: Json | null
          run_id: string | null
          uplift_vs_baseline_pct: number | null
          uplift_vs_naive_pct: number | null
          user_id: string
          win_rate_pct: number | null
        }
        Insert: {
          avg_anticipation_days?: number | null
          baseline_rmse?: number | null
          complexity_justified?: boolean | null
          cost_simulation?: Json | null
          created_at?: string
          false_negatives?: number | null
          false_positives?: number | null
          id?: string
          model_rmse?: number | null
          naive_rmse?: number | null
          precision_pct?: number | null
          recall_pct?: number | null
          retrospective_cases?: Json | null
          run_id?: string | null
          uplift_vs_baseline_pct?: number | null
          uplift_vs_naive_pct?: number | null
          user_id: string
          win_rate_pct?: number | null
        }
        Update: {
          avg_anticipation_days?: number | null
          baseline_rmse?: number | null
          complexity_justified?: boolean | null
          cost_simulation?: Json | null
          created_at?: string
          false_negatives?: number | null
          false_positives?: number | null
          id?: string
          model_rmse?: number | null
          naive_rmse?: number | null
          precision_pct?: number | null
          recall_pct?: number | null
          retrospective_cases?: Json | null
          run_id?: string | null
          uplift_vs_baseline_pct?: number | null
          uplift_vs_naive_pct?: number | null
          user_id?: string
          win_rate_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "model_backtests_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "pattern_detector_runs"
            referencedColumns: ["id"]
          },
        ]
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
      pattern_detection_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          detected_sources: Json | null
          domain_context: Json | null
          error: string | null
          id: string
          patterns: Json | null
          project_id: string
          rag_id: string
          started_at: string | null
          status: string
          user_id: string
          validation_results: Json | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          detected_sources?: Json | null
          domain_context?: Json | null
          error?: string | null
          id?: string
          patterns?: Json | null
          project_id: string
          rag_id: string
          started_at?: string | null
          status?: string
          user_id: string
          validation_results?: Json | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          detected_sources?: Json | null
          domain_context?: Json | null
          error?: string | null
          id?: string
          patterns?: Json | null
          project_id?: string
          rag_id?: string
          started_at?: string | null
          status?: string
          user_id?: string
          validation_results?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "pattern_detection_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "business_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      pattern_detector_runs: {
        Row: {
          baseline_definition: string | null
          business_objective: string | null
          created_at: string
          current_phase: number
          dashboard_output: Json | null
          error_log: string | null
          geography: string | null
          id: string
          model_verdict: string | null
          phase_results: Json | null
          project_id: string | null
          quality_gate: Json | null
          quality_gate_passed: boolean | null
          sector: string | null
          status: string
          time_horizon: string | null
          tokens_used: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          baseline_definition?: string | null
          business_objective?: string | null
          created_at?: string
          current_phase?: number
          dashboard_output?: Json | null
          error_log?: string | null
          geography?: string | null
          id?: string
          model_verdict?: string | null
          phase_results?: Json | null
          project_id?: string | null
          quality_gate?: Json | null
          quality_gate_passed?: boolean | null
          sector?: string | null
          status?: string
          time_horizon?: string | null
          tokens_used?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          baseline_definition?: string | null
          business_objective?: string | null
          created_at?: string
          current_phase?: number
          dashboard_output?: Json | null
          error_log?: string | null
          geography?: string | null
          id?: string
          model_verdict?: string | null
          phase_results?: Json | null
          project_id?: string | null
          quality_gate?: Json | null
          quality_gate_passed?: boolean | null
          sector?: string | null
          status?: string
          time_horizon?: string | null
          tokens_used?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pattern_detector_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "business_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      pattern_discovery_log: {
        Row: {
          correlation_strength: number | null
          created_at: string | null
          discovery_mode: string
          id: string
          p_value: number | null
          pattern_description: string
          run_id: string
          user_id: string
          validated: boolean | null
          validation_result: string | null
          variables_involved: Json | null
        }
        Insert: {
          correlation_strength?: number | null
          created_at?: string | null
          discovery_mode: string
          id?: string
          p_value?: number | null
          pattern_description: string
          run_id: string
          user_id: string
          validated?: boolean | null
          validation_result?: string | null
          variables_involved?: Json | null
        }
        Update: {
          correlation_strength?: number | null
          created_at?: string | null
          discovery_mode?: string
          id?: string
          p_value?: number | null
          pattern_description?: string
          run_id?: string
          user_id?: string
          validated?: boolean | null
          validation_result?: string | null
          variables_involved?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "pattern_discovery_log_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "pattern_detector_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      people_contacts: {
        Row: {
          ai_tags: string[] | null
          brain: string | null
          categories: string[] | null
          category: string | null
          company: string | null
          context: string | null
          created_at: string
          email: string | null
          historical_analysis: Json | null
          id: string
          interaction_count: number
          is_favorite: boolean | null
          last_contact: string | null
          metadata: Json | null
          name: string
          personality_profile: Json | null
          phone_numbers: string[] | null
          relationship: string | null
          role: string | null
          scores: Json | null
          sentiment: string | null
          updated_at: string
          user_id: string
          vcard_raw: Json | null
          wa_id: string | null
          wa_message_count: number | null
        }
        Insert: {
          ai_tags?: string[] | null
          brain?: string | null
          categories?: string[] | null
          category?: string | null
          company?: string | null
          context?: string | null
          created_at?: string
          email?: string | null
          historical_analysis?: Json | null
          id?: string
          interaction_count?: number
          is_favorite?: boolean | null
          last_contact?: string | null
          metadata?: Json | null
          name: string
          personality_profile?: Json | null
          phone_numbers?: string[] | null
          relationship?: string | null
          role?: string | null
          scores?: Json | null
          sentiment?: string | null
          updated_at?: string
          user_id: string
          vcard_raw?: Json | null
          wa_id?: string | null
          wa_message_count?: number | null
        }
        Update: {
          ai_tags?: string[] | null
          brain?: string | null
          categories?: string[] | null
          category?: string | null
          company?: string | null
          context?: string | null
          created_at?: string
          email?: string | null
          historical_analysis?: Json | null
          id?: string
          interaction_count?: number
          is_favorite?: boolean | null
          last_contact?: string | null
          metadata?: Json | null
          name?: string
          personality_profile?: Json | null
          phone_numbers?: string[] | null
          relationship?: string | null
          role?: string | null
          scores?: Json | null
          sentiment?: string | null
          updated_at?: string
          user_id?: string
          vcard_raw?: Json | null
          wa_id?: string | null
          wa_message_count?: number | null
        }
        Relationships: []
      }
      phone_contacts: {
        Row: {
          birthday: string | null
          company: string | null
          created_at: string
          display_name: string
          email: string | null
          id: string
          linked_contact_id: string | null
          phone_numbers: string[] | null
          raw_data: Json | null
          user_id: string
        }
        Insert: {
          birthday?: string | null
          company?: string | null
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          linked_contact_id?: string | null
          phone_numbers?: string[] | null
          raw_data?: Json | null
          user_id: string
        }
        Update: {
          birthday?: string | null
          company?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          linked_contact_id?: string | null
          phone_numbers?: string[] | null
          raw_data?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_contacts_linked_contact_id_fkey"
            columns: ["linked_contact_id"]
            isOneToOne: false
            referencedRelation: "people_contacts"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "pipeline_presets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "pipeline_runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
        ]
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
      plaud_recordings: {
        Row: {
          agent_type: string | null
          audio_url: string | null
          full_text: string | null
          id: string
          mindmap_url: string | null
          processed: boolean | null
          raw_email_id: string | null
          received_at: string | null
          relevance_category: string | null
          relevance_score: number | null
          summary: string | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          agent_type?: string | null
          audio_url?: string | null
          full_text?: string | null
          id?: string
          mindmap_url?: string | null
          processed?: boolean | null
          raw_email_id?: string | null
          received_at?: string | null
          relevance_category?: string | null
          relevance_score?: number | null
          summary?: string | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          agent_type?: string | null
          audio_url?: string | null
          full_text?: string | null
          id?: string
          mindmap_url?: string | null
          processed?: boolean | null
          raw_email_id?: string | null
          received_at?: string | null
          relevance_category?: string | null
          relevance_score?: number | null
          summary?: string | null
          title?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      plaud_threads: {
        Row: {
          agent_type: string | null
          contacts_extracted: Json | null
          context_segments: Json | null
          context_type: string | null
          created_at: string | null
          event_date: string | null
          event_title: string | null
          id: string
          recording_ids: string[] | null
          speakers: Json | null
          unified_transcript: string | null
        }
        Insert: {
          agent_type?: string | null
          contacts_extracted?: Json | null
          context_segments?: Json | null
          context_type?: string | null
          created_at?: string | null
          event_date?: string | null
          event_title?: string | null
          id?: string
          recording_ids?: string[] | null
          speakers?: Json | null
          unified_transcript?: string | null
        }
        Update: {
          agent_type?: string | null
          contacts_extracted?: Json | null
          context_segments?: Json | null
          context_type?: string | null
          created_at?: string | null
          event_date?: string | null
          event_title?: string | null
          id?: string
          recording_ids?: string[] | null
          speakers?: Json | null
          unified_transcript?: string | null
        }
        Relationships: []
      }
      plaud_transcriptions: {
        Row: {
          ai_processed: boolean | null
          created_at: string | null
          id: string
          parsed_data: Json | null
          participants: Json | null
          processing_status: string | null
          recording_date: string
          source_email_id: string | null
          summary_structured: string | null
          title: string | null
          transcript_raw: string | null
          user_id: string
        }
        Insert: {
          ai_processed?: boolean | null
          created_at?: string | null
          id?: string
          parsed_data?: Json | null
          participants?: Json | null
          processing_status?: string | null
          recording_date: string
          source_email_id?: string | null
          summary_structured?: string | null
          title?: string | null
          transcript_raw?: string | null
          user_id: string
        }
        Update: {
          ai_processed?: boolean | null
          created_at?: string | null
          id?: string
          parsed_data?: Json | null
          participants?: Json | null
          processing_status?: string | null
          recording_date?: string
          source_email_id?: string | null
          summary_structured?: string | null
          title?: string | null
          transcript_raw?: string | null
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
        Relationships: [
          {
            foreignKeyName: "potus_chat_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "potus_daily_summary_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_log: {
        Row: {
          actual_outcome: string | null
          created_at: string | null
          error_analysis: string | null
          id: string
          lesson_learned: string | null
          missing_signal: string | null
          model_version: number | null
          predicted_confidence: number | null
          predicted_outcome: string
          prediction_date: string
          regime_flag: string | null
          run_id: string
          signals_used: Json | null
          target_medication: string
          target_pharmacy: string | null
          user_id: string
          was_correct: boolean | null
        }
        Insert: {
          actual_outcome?: string | null
          created_at?: string | null
          error_analysis?: string | null
          id?: string
          lesson_learned?: string | null
          missing_signal?: string | null
          model_version?: number | null
          predicted_confidence?: number | null
          predicted_outcome: string
          prediction_date: string
          regime_flag?: string | null
          run_id: string
          signals_used?: Json | null
          target_medication: string
          target_pharmacy?: string | null
          user_id: string
          was_correct?: boolean | null
        }
        Update: {
          actual_outcome?: string | null
          created_at?: string | null
          error_analysis?: string | null
          id?: string
          lesson_learned?: string | null
          missing_signal?: string | null
          model_version?: number | null
          predicted_confidence?: number | null
          predicted_outcome?: string
          prediction_date?: string
          regime_flag?: string | null
          run_id?: string
          signals_used?: Json | null
          target_medication?: string
          target_pharmacy?: string | null
          user_id?: string
          was_correct?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "prediction_log_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "pattern_detector_runs"
            referencedColumns: ["id"]
          },
        ]
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
      project_context: {
        Row: {
          company_description: string | null
          company_name: string | null
          competitors: Json | null
          confidence_score: number | null
          created_at: string | null
          geography_detected: string | null
          id: string
          news_mentions: Json | null
          products_services: Json | null
          project_id: string
          public_data: Json | null
          raw_research: string | null
          reviews_summary: Json | null
          sector_detected: string | null
          sector_trends: Json | null
          social_media: Json | null
          source_url: string | null
          tech_stack_detected: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_description?: string | null
          company_name?: string | null
          competitors?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          geography_detected?: string | null
          id?: string
          news_mentions?: Json | null
          products_services?: Json | null
          project_id: string
          public_data?: Json | null
          raw_research?: string | null
          reviews_summary?: Json | null
          sector_detected?: string | null
          sector_trends?: Json | null
          social_media?: Json | null
          source_url?: string | null
          tech_stack_detected?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_description?: string | null
          company_name?: string | null
          competitors?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          geography_detected?: string | null
          id?: string
          news_mentions?: Json | null
          products_services?: Json | null
          project_id?: string
          public_data?: Json | null
          raw_research?: string | null
          reviews_summary?: Json | null
          sector_detected?: string | null
          sector_trends?: Json | null
          social_media?: Json | null
          source_url?: string | null
          tech_stack_detected?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_context_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "business_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_context_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      project_costs: {
        Row: {
          api_calls: number | null
          cost_usd: number | null
          created_at: string
          id: string
          metadata: Json | null
          operation: string
          project_id: string
          service: string
          step_number: number
          tokens_input: number | null
          tokens_output: number | null
          user_id: string
        }
        Insert: {
          api_calls?: number | null
          cost_usd?: number | null
          created_at?: string
          id?: string
          metadata?: Json | null
          operation: string
          project_id: string
          service: string
          step_number: number
          tokens_input?: number | null
          tokens_output?: number | null
          user_id: string
        }
        Update: {
          api_calls?: number | null
          cost_usd?: number | null
          created_at?: string
          id?: string
          metadata?: Json | null
          operation?: string
          project_id?: string
          service?: string
          step_number?: number
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_costs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "business_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_datasets: {
        Row: {
          column_count: number | null
          confidential: boolean | null
          created_at: string
          file_url: string | null
          id: string
          name: string
          quality_report: Json | null
          row_count: number | null
          run_id: string | null
          source_type: string | null
          user_id: string
        }
        Insert: {
          column_count?: number | null
          confidential?: boolean | null
          created_at?: string
          file_url?: string | null
          id?: string
          name: string
          quality_report?: Json | null
          row_count?: number | null
          run_id?: string | null
          source_type?: string | null
          user_id: string
        }
        Update: {
          column_count?: number | null
          confidential?: boolean | null
          created_at?: string
          file_url?: string | null
          id?: string
          name?: string
          quality_report?: Json | null
          row_count?: number | null
          run_id?: string | null
          source_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_datasets_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "pattern_detector_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      project_documents: {
        Row: {
          content: string | null
          created_at: string
          file_format: string | null
          file_url: string | null
          format: string | null
          id: string
          is_client_facing: boolean | null
          project_id: string
          step_number: number
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          content?: string | null
          created_at?: string
          file_format?: string | null
          file_url?: string | null
          format?: string | null
          id?: string
          is_client_facing?: boolean | null
          project_id: string
          step_number: number
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          content?: string | null
          created_at?: string
          file_format?: string | null
          file_url?: string | null
          format?: string | null
          id?: string
          is_client_facing?: boolean | null
          project_id?: string
          step_number?: number
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "business_projects"
            referencedColumns: ["id"]
          },
        ]
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
      project_wizard_steps: {
        Row: {
          approved_at: string | null
          created_at: string
          id: string
          input_data: Json | null
          model_used: string | null
          output_data: Json | null
          project_id: string
          status: string
          step_name: string
          step_number: number
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          id?: string
          input_data?: Json | null
          model_used?: string | null
          output_data?: Json | null
          project_id: string
          status?: string
          step_name: string
          step_number: number
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          id?: string
          input_data?: Json | null
          model_used?: string | null
          output_data?: Json | null
          project_id?: string
          status?: string
          step_name?: string
          step_number?: number
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_wizard_steps_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "business_projects"
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
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_api_keys: {
        Row: {
          api_key: string
          client_name: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          monthly_query_limit: number | null
          queries_used_this_month: number | null
          rag_id: string
        }
        Insert: {
          api_key: string
          client_name?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          monthly_query_limit?: number | null
          queries_used_this_month?: number | null
          rag_id: string
        }
        Update: {
          api_key?: string
          client_name?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          monthly_query_limit?: number | null
          queries_used_this_month?: number | null
          rag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rag_api_keys_rag_id_fkey"
            columns: ["rag_id"]
            isOneToOne: false
            referencedRelation: "rag_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_build_profiles: {
        Row: {
          created_at: string | null
          default_config: Json | null
          description: string | null
          id: string
          label: string
          profile_key: string
        }
        Insert: {
          created_at?: string | null
          default_config?: Json | null
          description?: string | null
          id?: string
          label: string
          profile_key: string
        }
        Update: {
          created_at?: string | null
          default_config?: Json | null
          description?: string | null
          id?: string
          label?: string
          profile_key?: string
        }
        Relationships: []
      }
      rag_chunks: {
        Row: {
          chunk_index: number | null
          content: string
          content_hash: string | null
          content_tsv: unknown
          created_at: string | null
          embedding: string | null
          id: string
          lang: string | null
          metadata: Json | null
          quality: Json
          rag_id: string
          source_id: string | null
          subdomain: string | null
          title: string | null
          token_count: number | null
        }
        Insert: {
          chunk_index?: number | null
          content: string
          content_hash?: string | null
          content_tsv?: unknown
          created_at?: string | null
          embedding?: string | null
          id?: string
          lang?: string | null
          metadata?: Json | null
          quality?: Json
          rag_id: string
          source_id?: string | null
          subdomain?: string | null
          title?: string | null
          token_count?: number | null
        }
        Update: {
          chunk_index?: number | null
          content?: string
          content_hash?: string | null
          content_tsv?: unknown
          created_at?: string | null
          embedding?: string | null
          id?: string
          lang?: string | null
          metadata?: Json | null
          quality?: Json
          rag_id?: string
          source_id?: string | null
          subdomain?: string | null
          title?: string | null
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rag_chunks_rag_id_fkey"
            columns: ["rag_id"]
            isOneToOne: false
            referencedRelation: "rag_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rag_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "rag_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_contradictions: {
        Row: {
          claim_a: string
          claim_b: string
          created_at: string | null
          id: string
          rag_id: string
          resolution: string | null
          severity: string | null
          source_a: string | null
          source_b: string | null
        }
        Insert: {
          claim_a: string
          claim_b: string
          created_at?: string | null
          id?: string
          rag_id: string
          resolution?: string | null
          severity?: string | null
          source_a?: string | null
          source_b?: string | null
        }
        Update: {
          claim_a?: string
          claim_b?: string
          created_at?: string | null
          id?: string
          rag_id?: string
          resolution?: string | null
          severity?: string | null
          source_a?: string | null
          source_b?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rag_contradictions_rag_id_fkey"
            columns: ["rag_id"]
            isOneToOne: false
            referencedRelation: "rag_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rag_contradictions_source_a_fkey"
            columns: ["source_a"]
            isOneToOne: false
            referencedRelation: "rag_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rag_contradictions_source_b_fkey"
            columns: ["source_b"]
            isOneToOne: false
            referencedRelation: "rag_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_cross_learning: {
        Row: {
          created_at: string | null
          id: string
          overlap_score: number | null
          rag_id_a: string
          rag_id_b: string
          shared_concepts: string[] | null
          transfer_suggestions: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          overlap_score?: number | null
          rag_id_a: string
          rag_id_b: string
          shared_concepts?: string[] | null
          transfer_suggestions?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          overlap_score?: number | null
          rag_id_a?: string
          rag_id_b?: string
          shared_concepts?: string[] | null
          transfer_suggestions?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "rag_cross_learning_rag_id_a_fkey"
            columns: ["rag_id_a"]
            isOneToOne: false
            referencedRelation: "rag_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rag_cross_learning_rag_id_b_fkey"
            columns: ["rag_id_b"]
            isOneToOne: false
            referencedRelation: "rag_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_domain_intelligence: {
        Row: {
          created_at: string | null
          critical_variables: Json | null
          expert_sources: Json | null
          id: string
          interpreted_intent: Json | null
          known_debates: Json | null
          rag_id: string
          recommended_config: Json | null
          source_categories: Json | null
          subdomains: Json | null
          taxonomy: Json | null
          user_confirmed: boolean | null
          user_input: string | null
          validation_queries: Json | null
        }
        Insert: {
          created_at?: string | null
          critical_variables?: Json | null
          expert_sources?: Json | null
          id?: string
          interpreted_intent?: Json | null
          known_debates?: Json | null
          rag_id: string
          recommended_config?: Json | null
          source_categories?: Json | null
          subdomains?: Json | null
          taxonomy?: Json | null
          user_confirmed?: boolean | null
          user_input?: string | null
          validation_queries?: Json | null
        }
        Update: {
          created_at?: string | null
          critical_variables?: Json | null
          expert_sources?: Json | null
          id?: string
          interpreted_intent?: Json | null
          known_debates?: Json | null
          rag_id?: string
          recommended_config?: Json | null
          source_categories?: Json | null
          subdomains?: Json | null
          taxonomy?: Json | null
          user_confirmed?: boolean | null
          user_input?: string | null
          validation_queries?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "rag_domain_intelligence_rag_id_fkey"
            columns: ["rag_id"]
            isOneToOne: true
            referencedRelation: "rag_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_embedding_configs: {
        Row: {
          chunk_overlap: number | null
          chunk_size: number | null
          created_at: string | null
          dimensions: number | null
          id: string
          model_name: string | null
          rag_id: string
        }
        Insert: {
          chunk_overlap?: number | null
          chunk_size?: number | null
          created_at?: string | null
          dimensions?: number | null
          id?: string
          model_name?: string | null
          rag_id: string
        }
        Update: {
          chunk_overlap?: number | null
          chunk_size?: number | null
          created_at?: string | null
          dimensions?: number | null
          id?: string
          model_name?: string | null
          rag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rag_embedding_configs_rag_id_fkey"
            columns: ["rag_id"]
            isOneToOne: false
            referencedRelation: "rag_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_exports: {
        Row: {
          created_at: string | null
          download_count: number | null
          expires_at: string | null
          file_path: string | null
          file_size_mb: number | null
          format: string
          id: string
          rag_id: string
        }
        Insert: {
          created_at?: string | null
          download_count?: number | null
          expires_at?: string | null
          file_path?: string | null
          file_size_mb?: number | null
          format: string
          id?: string
          rag_id: string
        }
        Update: {
          created_at?: string | null
          download_count?: number | null
          expires_at?: string | null
          file_path?: string | null
          file_size_mb?: number | null
          format?: string
          id?: string
          rag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rag_exports_rag_id_fkey"
            columns: ["rag_id"]
            isOneToOne: false
            referencedRelation: "rag_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_gaps: {
        Row: {
          created_at: string | null
          gap_description: string
          id: string
          rag_id: string
          resolved: boolean | null
          severity: string | null
          subdomain: string | null
          suggested_sources: string[] | null
        }
        Insert: {
          created_at?: string | null
          gap_description: string
          id?: string
          rag_id: string
          resolved?: boolean | null
          severity?: string | null
          subdomain?: string | null
          suggested_sources?: string[] | null
        }
        Update: {
          created_at?: string | null
          gap_description?: string
          id?: string
          rag_id?: string
          resolved?: boolean | null
          severity?: string | null
          subdomain?: string | null
          suggested_sources?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "rag_gaps_rag_id_fkey"
            columns: ["rag_id"]
            isOneToOne: false
            referencedRelation: "rag_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_jobs: {
        Row: {
          attempt: number
          created_at: string
          error: Json | null
          id: string
          job_type: string
          locked_at: string | null
          locked_by: string | null
          payload: Json
          rag_id: string
          run_after: string
          source_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          error?: Json | null
          id?: string
          job_type: string
          locked_at?: string | null
          locked_by?: string | null
          payload?: Json
          rag_id: string
          run_after?: string
          source_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempt?: number
          created_at?: string
          error?: Json | null
          id?: string
          job_type?: string
          locked_at?: string | null
          locked_by?: string | null
          payload?: Json
          rag_id?: string
          run_after?: string
          source_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      rag_knowledge_graph_edges: {
        Row: {
          created_at: string | null
          edge_type: string
          id: string
          metadata: Json | null
          rag_id: string
          source_node: string
          target_node: string
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          edge_type: string
          id?: string
          metadata?: Json | null
          rag_id: string
          source_node: string
          target_node: string
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          edge_type?: string
          id?: string
          metadata?: Json | null
          rag_id?: string
          source_node?: string
          target_node?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rag_knowledge_graph_edges_rag_id_fkey"
            columns: ["rag_id"]
            isOneToOne: false
            referencedRelation: "rag_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rag_knowledge_graph_edges_source_node_fkey"
            columns: ["source_node"]
            isOneToOne: false
            referencedRelation: "rag_knowledge_graph_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rag_knowledge_graph_edges_target_node_fkey"
            columns: ["target_node"]
            isOneToOne: false
            referencedRelation: "rag_knowledge_graph_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_knowledge_graph_nodes: {
        Row: {
          created_at: string | null
          description: string | null
          embedding: string | null
          id: string
          label: string
          node_type: string | null
          properties: Json | null
          rag_id: string
          source_count: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          id?: string
          label: string
          node_type?: string | null
          properties?: Json | null
          rag_id: string
          source_count?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          id?: string
          label?: string
          node_type?: string | null
          properties?: Json | null
          rag_id?: string
          source_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rag_knowledge_graph_nodes_rag_id_fkey"
            columns: ["rag_id"]
            isOneToOne: false
            referencedRelation: "rag_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_projects: {
        Row: {
          build_profile: string | null
          config: Json | null
          coverage_pct: number | null
          created_at: string | null
          current_phase: number | null
          domain_adjustments: Json | null
          domain_confirmed: boolean | null
          domain_description: string
          domain_map: Json | null
          error_log: string | null
          freshness_score: number | null
          id: string
          moral_mode: string
          project_id: string | null
          quality_verdict: string | null
          status: string
          total_chunks: number | null
          total_sources: number | null
          total_variables: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          build_profile?: string | null
          config?: Json | null
          coverage_pct?: number | null
          created_at?: string | null
          current_phase?: number | null
          domain_adjustments?: Json | null
          domain_confirmed?: boolean | null
          domain_description: string
          domain_map?: Json | null
          error_log?: string | null
          freshness_score?: number | null
          id?: string
          moral_mode?: string
          project_id?: string | null
          quality_verdict?: string | null
          status?: string
          total_chunks?: number | null
          total_sources?: number | null
          total_variables?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          build_profile?: string | null
          config?: Json | null
          coverage_pct?: number | null
          created_at?: string | null
          current_phase?: number | null
          domain_adjustments?: Json | null
          domain_confirmed?: boolean | null
          domain_description?: string
          domain_map?: Json | null
          error_log?: string | null
          freshness_score?: number | null
          id?: string
          moral_mode?: string
          project_id?: string | null
          quality_verdict?: string | null
          status?: string
          total_chunks?: number | null
          total_sources?: number | null
          total_variables?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rag_projects_build_profile_fkey"
            columns: ["build_profile"]
            isOneToOne: false
            referencedRelation: "rag_build_profiles"
            referencedColumns: ["profile_key"]
          },
          {
            foreignKeyName: "rag_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "business_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_quality_checks: {
        Row: {
          check_type: string
          created_at: string | null
          details: Json | null
          id: string
          rag_id: string
          score: number | null
          verdict: string | null
        }
        Insert: {
          check_type: string
          created_at?: string | null
          details?: Json | null
          id?: string
          rag_id: string
          score?: number | null
          verdict?: string | null
        }
        Update: {
          check_type?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          rag_id?: string
          score?: number | null
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rag_quality_checks_rag_id_fkey"
            columns: ["rag_id"]
            isOneToOne: false
            referencedRelation: "rag_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_quality_logs: {
        Row: {
          avg_reliability_score: number | null
          coverage_pct: number | null
          created_at: string
          freshness_pct: number | null
          gap_analysis: Json | null
          id: string
          run_id: string | null
          self_healing_iterations: number | null
          source_diversity: number | null
          status: string | null
          user_id: string
        }
        Insert: {
          avg_reliability_score?: number | null
          coverage_pct?: number | null
          created_at?: string
          freshness_pct?: number | null
          gap_analysis?: Json | null
          id?: string
          run_id?: string | null
          self_healing_iterations?: number | null
          source_diversity?: number | null
          status?: string | null
          user_id: string
        }
        Update: {
          avg_reliability_score?: number | null
          coverage_pct?: number | null
          created_at?: string
          freshness_pct?: number | null
          gap_analysis?: Json | null
          id?: string
          run_id?: string | null
          self_healing_iterations?: number | null
          source_diversity?: number | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rag_quality_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "pattern_detector_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_query_log: {
        Row: {
          chunks_used: string[] | null
          created_at: string | null
          id: string
          latency_ms: number | null
          quality_score: number | null
          query: string
          rag_id: string
          response: string | null
        }
        Insert: {
          chunks_used?: string[] | null
          created_at?: string | null
          id?: string
          latency_ms?: number | null
          quality_score?: number | null
          query: string
          rag_id: string
          response?: string | null
        }
        Update: {
          chunks_used?: string[] | null
          created_at?: string | null
          id?: string
          latency_ms?: number | null
          quality_score?: number | null
          query?: string
          rag_id?: string
          response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rag_query_log_rag_id_fkey"
            columns: ["rag_id"]
            isOneToOne: false
            referencedRelation: "rag_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_research_runs: {
        Row: {
          chunks_generated: number | null
          completed_at: string | null
          created_at: string | null
          error_log: string | null
          id: string
          rag_id: string
          research_level: string
          sources_found: number | null
          started_at: string | null
          status: string | null
          subdomain: string
        }
        Insert: {
          chunks_generated?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_log?: string | null
          id?: string
          rag_id: string
          research_level: string
          sources_found?: number | null
          started_at?: string | null
          status?: string | null
          subdomain: string
        }
        Update: {
          chunks_generated?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_log?: string | null
          id?: string
          rag_id?: string
          research_level?: string
          sources_found?: number | null
          started_at?: string | null
          status?: string | null
          subdomain?: string
        }
        Relationships: [
          {
            foreignKeyName: "rag_research_runs_rag_id_fkey"
            columns: ["rag_id"]
            isOneToOne: false
            referencedRelation: "rag_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_sources: {
        Row: {
          authority_score: number | null
          content_hash: string | null
          content_type: string | null
          created_at: string | null
          error: Json | null
          evidence_level: string | null
          extraction_quality: string | null
          http_status: number | null
          id: string
          lang_detected: string | null
          metadata: Json | null
          peer_reviewed: boolean | null
          quality_score: number | null
          rag_id: string
          relevance_score: number | null
          run_id: string | null
          source_name: string
          source_type: string | null
          source_url: string | null
          status: string
          subdomain: string | null
          tier: string | null
          updated_at: string
          word_count: number | null
        }
        Insert: {
          authority_score?: number | null
          content_hash?: string | null
          content_type?: string | null
          created_at?: string | null
          error?: Json | null
          evidence_level?: string | null
          extraction_quality?: string | null
          http_status?: number | null
          id?: string
          lang_detected?: string | null
          metadata?: Json | null
          peer_reviewed?: boolean | null
          quality_score?: number | null
          rag_id: string
          relevance_score?: number | null
          run_id?: string | null
          source_name: string
          source_type?: string | null
          source_url?: string | null
          status?: string
          subdomain?: string | null
          tier?: string | null
          updated_at?: string
          word_count?: number | null
        }
        Update: {
          authority_score?: number | null
          content_hash?: string | null
          content_type?: string | null
          created_at?: string | null
          error?: Json | null
          evidence_level?: string | null
          extraction_quality?: string | null
          http_status?: number | null
          id?: string
          lang_detected?: string | null
          metadata?: Json | null
          peer_reviewed?: boolean | null
          quality_score?: number | null
          rag_id?: string
          relevance_score?: number | null
          run_id?: string | null
          source_name?: string
          source_type?: string | null
          source_url?: string | null
          status?: string
          subdomain?: string | null
          tier?: string | null
          updated_at?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rag_sources_rag_id_fkey"
            columns: ["rag_id"]
            isOneToOne: false
            referencedRelation: "rag_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rag_sources_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "rag_research_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_taxonomy: {
        Row: {
          chunk_count: number | null
          created_at: string | null
          description: string | null
          id: string
          level: number | null
          name: string
          parent_id: string | null
          rag_id: string
        }
        Insert: {
          chunk_count?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          level?: number | null
          name: string
          parent_id?: string | null
          rag_id: string
        }
        Update: {
          chunk_count?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          level?: number | null
          name?: string
          parent_id?: string | null
          rag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rag_taxonomy_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "rag_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rag_taxonomy_rag_id_fkey"
            columns: ["rag_id"]
            isOneToOne: false
            referencedRelation: "rag_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_traces: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          metadata: Json | null
          phase: string | null
          rag_id: string
          trace_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          phase?: string | null
          rag_id: string
          trace_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          phase?: string | null
          rag_id?: string
          trace_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "rag_traces_rag_id_fkey"
            columns: ["rag_id"]
            isOneToOne: false
            referencedRelation: "rag_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_variables: {
        Row: {
          category: string | null
          confidence: number | null
          created_at: string | null
          description: string | null
          detected_values: Json | null
          examples: string | null
          extraction_hint: string | null
          id: string
          name: string
          rag_id: string
          scale: string | null
          source_chunks: string[] | null
          unit: string | null
          updated_at: string | null
          variable_type: string | null
        }
        Insert: {
          category?: string | null
          confidence?: number | null
          created_at?: string | null
          description?: string | null
          detected_values?: Json | null
          examples?: string | null
          extraction_hint?: string | null
          id?: string
          name: string
          rag_id: string
          scale?: string | null
          source_chunks?: string[] | null
          unit?: string | null
          updated_at?: string | null
          variable_type?: string | null
        }
        Update: {
          category?: string | null
          confidence?: number | null
          created_at?: string | null
          description?: string | null
          detected_values?: Json | null
          examples?: string | null
          extraction_hint?: string | null
          id?: string
          name?: string
          rag_id?: string
          scale?: string | null
          source_chunks?: string[] | null
          unit?: string | null
          updated_at?: string | null
          variable_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rag_variables_rag_id_fkey"
            columns: ["rag_id"]
            isOneToOne: false
            referencedRelation: "rag_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_shares: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          resource_id: string | null
          resource_type: string
          role: string
          shared_with_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          resource_id?: string | null
          resource_type: string
          role?: string
          shared_with_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          resource_id?: string | null
          resource_type?: string
          role?: string
          shared_with_id?: string
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
      signal_credibility_matrix: {
        Row: {
          anticipation_days: number | null
          created_at: string | null
          cross_replication_score: number | null
          final_credibility_score: number
          id: string
          pattern_id: string | null
          regime_flag: string | null
          run_id: string
          signal_class: string
          signal_id: string | null
          signal_to_noise_ratio: number | null
          temporal_stability_score: number | null
          user_id: string
          weights_version: number | null
        }
        Insert: {
          anticipation_days?: number | null
          created_at?: string | null
          cross_replication_score?: number | null
          final_credibility_score: number
          id?: string
          pattern_id?: string | null
          regime_flag?: string | null
          run_id: string
          signal_class: string
          signal_id?: string | null
          signal_to_noise_ratio?: number | null
          temporal_stability_score?: number | null
          user_id: string
          weights_version?: number | null
        }
        Update: {
          anticipation_days?: number | null
          created_at?: string | null
          cross_replication_score?: number | null
          final_credibility_score?: number
          id?: string
          pattern_id?: string | null
          regime_flag?: string | null
          run_id?: string
          signal_class?: string
          signal_id?: string | null
          signal_to_noise_ratio?: number | null
          temporal_stability_score?: number | null
          user_id?: string
          weights_version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "signal_credibility_matrix_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "pattern_discovery_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signal_credibility_matrix_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "pattern_detector_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signal_credibility_matrix_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signal_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      signal_registry: {
        Row: {
          confidence: number | null
          contradicting_evidence: string | null
          created_at: string
          data_source: string | null
          description: string | null
          devil_advocate_result: string | null
          id: string
          impact: string | null
          layer_id: number
          layer_name: string
          p_value: number | null
          run_id: string | null
          sector: string | null
          signal_name: string
          trend: string | null
          uncertainty_type: string | null
          user_id: string
        }
        Insert: {
          confidence?: number | null
          contradicting_evidence?: string | null
          created_at?: string
          data_source?: string | null
          description?: string | null
          devil_advocate_result?: string | null
          id?: string
          impact?: string | null
          layer_id: number
          layer_name: string
          p_value?: number | null
          run_id?: string | null
          sector?: string | null
          signal_name: string
          trend?: string | null
          uncertainty_type?: string | null
          user_id: string
        }
        Update: {
          confidence?: number | null
          contradicting_evidence?: string | null
          created_at?: string
          data_source?: string | null
          description?: string | null
          devil_advocate_result?: string | null
          id?: string
          impact?: string | null
          layer_id?: number
          layer_name?: string
          p_value?: number | null
          run_id?: string | null
          sector?: string | null
          signal_name?: string
          trend?: string | null
          uncertainty_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signal_registry_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "pattern_detector_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      specialist_invocations: {
        Row: {
          created_at: string | null
          id: string
          latency_ms: number | null
          model_used: string | null
          query: string
          response: string | null
          retrieved_chunks: number | null
          specialist: string
          sub_rag: string | null
          tokens_used: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          latency_ms?: number | null
          model_used?: string | null
          query: string
          response?: string | null
          retrieved_chunks?: number | null
          specialist: string
          sub_rag?: string | null
          tokens_used?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          latency_ms?: number | null
          model_used?: string | null
          query?: string
          response?: string | null
          retrieved_chunks?: number | null
          specialist?: string
          sub_rag?: string | null
          tokens_used?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      specialist_knowledge: {
        Row: {
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          metadata: Json | null
          specialist: string
          sub_rag: string
          title: string | null
          token_count: number | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          specialist: string
          sub_rag: string
          title?: string | null
          token_count?: number | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          specialist?: string
          sub_rag?: string
          title?: string | null
          token_count?: number | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
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
        Relationships: [
          {
            foreignKeyName: "specialist_memory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      specialist_metadata: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string
          embedding_dims: number | null
          embedding_model: string | null
          last_updated: string | null
          model: string | null
          specialist: string
          sub_rags: Json
          system_prompt: string | null
          total_chunks: number | null
          total_tokens: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name: string
          embedding_dims?: number | null
          embedding_model?: string | null
          last_updated?: string | null
          model?: string | null
          specialist: string
          sub_rags: Json
          system_prompt?: string | null
          total_chunks?: number | null
          total_tokens?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string
          embedding_dims?: number | null
          embedding_model?: string | null
          last_updated?: string | null
          model?: string | null
          specialist?: string
          sub_rags?: Json
          system_prompt?: string | null
          total_chunks?: number | null
          total_tokens?: number | null
        }
        Relationships: []
      }
      suggested_responses: {
        Row: {
          contact_id: string | null
          context_summary: string | null
          created_at: string
          detected_style: string | null
          id: string
          original_message_id: string | null
          status: string
          suggestion_1: string | null
          suggestion_2: string | null
          suggestion_3: string | null
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          context_summary?: string | null
          created_at?: string
          detected_style?: string | null
          id?: string
          original_message_id?: string | null
          status?: string
          suggestion_1?: string | null
          suggestion_2?: string | null
          suggestion_3?: string | null
          user_id: string
        }
        Update: {
          contact_id?: string | null
          context_summary?: string | null
          created_at?: string
          detected_style?: string | null
          id?: string
          original_message_id?: string | null
          status?: string
          suggestion_1?: string | null
          suggestion_2?: string | null
          suggestion_3?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggested_responses_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "people_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggested_responses_original_message_id_fkey"
            columns: ["original_message_id"]
            isOneToOne: false
            referencedRelation: "contact_messages"
            referencedColumns: ["id"]
          },
        ]
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
          contact_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          duration: number
          id: string
          priority: string
          project_id: string | null
          source: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          duration?: number
          id?: string
          priority?: string
          project_id?: string | null
          source?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          duration?: number
          id?: string
          priority?: string
          project_id?: string | null
          source?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "people_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "business_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      transcriptions: {
        Row: {
          brain: string | null
          created_at: string
          entities_json: Json | null
          group_id: string | null
          id: string
          is_ambient: boolean | null
          processed_at: string | null
          raw_text: string
          sentiment: string | null
          source: string
          summary: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          brain?: string | null
          created_at?: string
          entities_json?: Json | null
          group_id?: string | null
          id?: string
          is_ambient?: boolean | null
          processed_at?: string | null
          raw_text: string
          sentiment?: string | null
          source?: string
          summary?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          brain?: string | null
          created_at?: string
          entities_json?: Json | null
          group_id?: string | null
          id?: string
          is_ambient?: boolean | null
          processed_at?: string | null
          raw_text?: string
          sentiment?: string | null
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
        Relationships: [
          {
            foreignKeyName: "user_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "user_integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
        ]
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
          my_identifiers: Json | null
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
          my_identifiers?: Json | null
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
          my_identifiers?: Json | null
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
        Relationships: [
          {
            foreignKeyName: "user_profile_extended_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          font_size: string
          hidden_menu_items: Json | null
          id: string
          language: string
          onboarding_completed: boolean | null
          pomodoro_long_break: number
          pomodoro_short_break: number
          pomodoro_work_duration: number
          section_visibility: Json
          show_contacts_card: boolean
          show_day_summary: boolean
          show_notifications_panel: boolean
          show_quick_actions: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          font_size?: string
          hidden_menu_items?: Json | null
          id?: string
          language?: string
          onboarding_completed?: boolean | null
          pomodoro_long_break?: number
          pomodoro_short_break?: number
          pomodoro_work_duration?: number
          section_visibility?: Json
          show_contacts_card?: boolean
          show_day_summary?: boolean
          show_notifications_panel?: boolean
          show_quick_actions?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          font_size?: string
          hidden_menu_items?: Json | null
          id?: string
          language?: string
          onboarding_completed?: boolean | null
          pomodoro_long_break?: number
          pomodoro_short_break?: number
          pomodoro_work_duration?: number
          section_visibility?: Json
          show_contacts_card?: boolean
          show_day_summary?: boolean
          show_notifications_panel?: boolean
          show_quick_actions?: boolean
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
        Relationships: [
          {
            foreignKeyName: "user_telegram_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "whoop_data_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "whoop_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      user_directory: {
        Row: {
          display_name: string | null
          email: string | null
          id: string | null
        }
        Insert: {
          display_name?: never
          email?: string | null
          id?: string | null
        }
        Update: {
          display_name?: never
          email?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_chunk_duplicate: {
        Args: {
          match_rag_id: string
          query_embedding: string
          similarity_threshold?: number
        }
        Returns: {
          id: string
          similarity: number
        }[]
      }
      complete_external_job: {
        Args: {
          p_extracted_text: string
          p_extraction_quality?: string
          p_job_id: string
        }
        Returns: undefined
      }
      enqueue_taxonomy_batches_for_rag: {
        Args: { p_batch_size?: number; p_rag_id: string }
        Returns: number
      }
      fetch_external_job_stats: {
        Args: { match_rag_id: string }
        Returns: {
          count: number
          status: string
        }[]
      }
      find_user_by_email: {
        Args: { p_email: string }
        Returns: {
          display_name: string
          email: string
          id: string
        }[]
      }
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
      has_shared_access: {
        Args: {
          p_resource_id: string
          p_resource_type: string
          p_user_id: string
        }
        Returns: boolean
      }
      has_shared_access_via_project: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: boolean
      }
      has_shared_edit_access: {
        Args: {
          p_resource_id: string
          p_resource_type: string
          p_user_id: string
        }
        Returns: boolean
      }
      has_shared_edit_via_project: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: boolean
      }
      increment_node_source_count: {
        Args: { node_id: string }
        Returns: undefined
      }
      mark_job_done: { Args: { job_id: string }; Returns: undefined }
      mark_job_retry: {
        Args: { err: Json; job_id: string }
        Returns: undefined
      }
      pick_external_job: {
        Args: { p_worker_id: string }
        Returns: {
          attempt: number
          created_at: string
          error: Json | null
          id: string
          job_type: string
          locked_at: string | null
          locked_by: string | null
          payload: Json
          rag_id: string
          run_after: string
          source_id: string | null
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "rag_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      pick_next_job: {
        Args: { worker_id: string }
        Returns: {
          attempt: number
          created_at: string
          error: Json | null
          id: string
          job_type: string
          locked_at: string | null
          locked_by: string | null
          payload: Json
          rag_id: string
          run_after: string
          source_id: string | null
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "rag_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      rag_job_stats: {
        Args: { match_rag_id: string }
        Returns: {
          count: number
          status: string
        }[]
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
      search_graph_nodes: {
        Args: {
          match_count?: number
          match_rag_id: string
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          description: string
          id: string
          label: string
          node_type: string
          similarity: number
          source_count: number
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
      search_rag_chunks: {
        Args: {
          match_count?: number
          match_rag_id: string
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          metadata: Json
          similarity: number
          source_name: string
          source_url: string
          subdomain: string
        }[]
      }
      search_rag_hybrid: {
        Args: {
          match_count?: number
          match_rag_id: string
          query_embedding: string
          query_text: string
          rrf_k?: number
        }
        Returns: {
          authority_score: number
          content: string
          embedding: string
          evidence_level: string
          id: string
          quality: Json
          rrf_score: number
          similarity: number
          source_name: string
          source_tier: string
          source_url: string
        }[]
      }
      search_specialist_knowledge: {
        Args: {
          p_limit?: number
          p_query_embedding: string
          p_similarity_threshold?: number
          p_specialist: string
          p_sub_rag: string
        }
        Returns: {
          content: string
          id: string
          metadata: Json
          similarity: number
          specialist: string
          sub_rag: string
          title: string
          url: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      user_owns_audit: { Args: { p_audit_id: string }; Returns: boolean }
      user_owns_business_project: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      user_owns_pattern_run: { Args: { p_run_id: string }; Returns: boolean }
      user_owns_pipeline: { Args: { p_pipeline_id: string }; Returns: boolean }
      user_owns_rag_project: { Args: { p_rag_id: string }; Returns: boolean }
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
