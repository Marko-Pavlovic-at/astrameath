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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_usage: {
        Row: {
          companion_id: string | null
          cost_usd: number
          created_at: string
          id: string
          input_tokens: number
          output_tokens: number
          user_id: string
        }
        Insert: {
          companion_id?: string | null
          cost_usd?: number
          created_at?: string
          id?: string
          input_tokens?: number
          output_tokens?: number
          user_id?: string
        }
        Update: {
          companion_id?: string | null
          cost_usd?: number
          created_at?: string
          id?: string
          input_tokens?: number
          output_tokens?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_companion_id_fkey"
            columns: ["companion_id"]
            isOneToOne: false
            referencedRelation: "companions"
            referencedColumns: ["id"]
          },
        ]
      }
      companion_memories: {
        Row: {
          companion_id: string
          content: string
          created_at: string
          id: string
          importance: number | null
          user_id: string
        }
        Insert: {
          companion_id: string
          content: string
          created_at?: string
          id?: string
          importance?: number | null
          user_id?: string
        }
        Update: {
          companion_id?: string
          content?: string
          created_at?: string
          id?: string
          importance?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "companion_memories_companion_id_fkey"
            columns: ["companion_id"]
            isOneToOne: false
            referencedRelation: "companions"
            referencedColumns: ["id"]
          },
        ]
      }
      companion_messages: {
        Row: {
          companion_id: string
          content: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["message_role"]
          user_id: string
        }
        Insert: {
          companion_id: string
          content: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["message_role"]
          user_id?: string
        }
        Update: {
          companion_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["message_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "companion_messages_companion_id_fkey"
            columns: ["companion_id"]
            isOneToOne: false
            referencedRelation: "companions"
            referencedColumns: ["id"]
          },
        ]
      }
      companion_state: {
        Row: {
          companion_id: string
          last_seen_at: string | null
          mood: string | null
          mood_reason: string | null
          recent_events: Json
          relationship: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          companion_id: string
          last_seen_at?: string | null
          mood?: string | null
          mood_reason?: string | null
          recent_events?: Json
          relationship?: Json
          updated_at?: string
          user_id?: string
        }
        Update: {
          companion_id?: string
          last_seen_at?: string | null
          mood?: string | null
          mood_reason?: string | null
          recent_events?: Json
          relationship?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "companion_state_companion_id_fkey"
            columns: ["companion_id"]
            isOneToOne: true
            referencedRelation: "companions"
            referencedColumns: ["id"]
          },
        ]
      }
      companions: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          model: string
          name: string
          persona: Json
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          model?: string
          name: string
          persona?: Json
          user_id?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          model?: string
          name?: string
          persona?: Json
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          completed_at: string | null
          created_at: string
          deadline: string | null
          id: string
          position: number
          project_id: string
          title: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          position?: number
          project_id: string
          title: string
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          position?: number
          project_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          completed_at: string | null
          created_at: string
          deadline: string | null
          goal_id: string
          id: string
          position: number
          title: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          goal_id: string
          id?: string
          position?: number
          title: string
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          goal_id?: string
          id?: string
          position?: number
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_theme: string | null
          active_title: string | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          last_seen_at: string | null
        }
        Insert: {
          active_theme?: string | null
          active_title?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          last_seen_at?: string | null
        }
        Update: {
          active_theme?: string | null
          active_title?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_seen_at?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          no_xp: boolean
          position: number
          stat: Database["public"]["Enums"]["stat_kind"]
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          no_xp?: boolean
          position?: number
          stat: Database["public"]["Enums"]["stat_kind"]
          user_id?: string
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          no_xp?: boolean
          position?: number
          stat?: Database["public"]["Enums"]["stat_kind"]
          user_id?: string
        }
        Relationships: []
      }
      subtasks: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          position: number
          task_id: string
          title: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          position?: number
          task_id: string
          title: string
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          position?: number
          task_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_completions: {
        Row: {
          completed_at: string
          date: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          date: string
          id?: string
          task_id: string
          user_id?: string
        }
        Update: {
          completed_at?: string
          date?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          estimate_minutes: number | null
          id: string
          notes: string | null
          position: number
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string
          recurrence: Json | null
          scheduled_date: string | null
          scheduled_time: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          estimate_minutes?: number | null
          id?: string
          notes?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id: string
          recurrence?: Json | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          estimate_minutes?: number | null
          id?: string
          notes?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string
          recurrence?: Json | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      time_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          note: string | null
          source: Database["public"]["Enums"]["session_source"]
          started_at: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          note?: string | null
          source?: Database["public"]["Enums"]["session_source"]
          started_at?: string
          task_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          note?: string | null
          source?: Database["public"]["Enums"]["session_source"]
          started_at?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      unlocks: {
        Row: {
          id: string
          key: string
          kind: Database["public"]["Enums"]["unlock_kind"]
          unlocked_at: string
          user_id: string
        }
        Insert: {
          id?: string
          key: string
          kind: Database["public"]["Enums"]["unlock_kind"]
          unlocked_at?: string
          user_id?: string
        }
        Update: {
          id?: string
          key?: string
          kind?: Database["public"]["Enums"]["unlock_kind"]
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      xp_events: {
        Row: {
          amount: number
          created_at: string
          id: string
          ref_id: string | null
          source: Database["public"]["Enums"]["xp_source"]
          stat: Database["public"]["Enums"]["stat_kind"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          ref_id?: string | null
          source: Database["public"]["Enums"]["xp_source"]
          stat: Database["public"]["Enums"]["stat_kind"]
          user_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          ref_id?: string | null
          source?: Database["public"]["Enums"]["xp_source"]
          stat?: Database["public"]["Enums"]["stat_kind"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      project_time_totals: {
        Row: {
          project_id: string | null
          total_seconds: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      task_time_totals: {
        Row: {
          task_id: string | null
          total_seconds: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_totals: {
        Row: {
          stat: Database["public"]["Enums"]["stat_kind"] | null
          total_xp: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      goal_awards_xp: { Args: { p_goal_id: string }; Returns: boolean }
      goal_stat: {
        Args: { p_goal_id: string }
        Returns: Database["public"]["Enums"]["stat_kind"]
      }
      project_awards_xp: { Args: { p_project_id: string }; Returns: boolean }
      task_awards_xp: { Args: { p_task_id: string }; Returns: boolean }
      task_stat: {
        Args: { p_task_id: string }
        Returns: Database["public"]["Enums"]["stat_kind"]
      }
    }
    Enums: {
      message_role: "user" | "assistant"
      session_source: "timer" | "manual"
      stat_kind:
        | "strength"
        | "vitality"
        | "intelligence"
        | "discipline"
        | "creativity"
        | "social"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "done"
      unlock_kind: "title" | "item" | "theme"
      xp_source: "time" | "task_completion" | "milestone" | "goal" | "streak"
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
      message_role: ["user", "assistant"],
      session_source: ["timer", "manual"],
      stat_kind: [
        "strength",
        "vitality",
        "intelligence",
        "discipline",
        "creativity",
        "social",
      ],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "done"],
      unlock_kind: ["title", "item", "theme"],
      xp_source: ["time", "task_completion", "milestone", "goal", "streak"],
    },
  },
} as const
