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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      bookmarks: {
        Row: {
          created_at: string
          drop_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          drop_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          drop_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "drops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      corporate_sources: {
        Row: {
          branding: string | null
          corp_user_id: string
          created_at: string
          id: number
          source_url: string
          status: string
        }
        Insert: {
          branding?: string | null
          corp_user_id: string
          created_at?: string
          id?: number
          source_url: string
          status?: string
        }
        Update: {
          branding?: string | null
          corp_user_id?: string
          created_at?: string
          id?: number
          source_url?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "corporate_sources_corp_user_id_fkey"
            columns: ["corp_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_batch_items: {
        Row: {
          batch_id: number
          drop_id: number
          is_sponsored: boolean
          position: number | null
        }
        Insert: {
          batch_id: number
          drop_id: number
          is_sponsored?: boolean
          position?: number | null
        }
        Update: {
          batch_id?: number
          drop_id?: number
          is_sponsored?: boolean
          position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_batch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "daily_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_batch_items_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "drops"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_batches: {
        Row: {
          created_at: string
          drop_date: string
          id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          drop_date: string
          id?: number
          user_id: string
        }
        Update: {
          created_at?: string
          drop_date?: string
          id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_batches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drops: {
        Row: {
          created_at: string
          id: number
          image_url: string | null
          lang_id: number | null
          published_at: string | null
          score: number | null
          source_id: number | null
          summary: string | null
          tags: string[]
          title: string
          type: Database["public"]["Enums"]["drop_type"]
          url: string
          url_hash: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          image_url?: string | null
          lang_id?: number | null
          published_at?: string | null
          score?: number | null
          source_id?: number | null
          summary?: string | null
          tags?: string[]
          title: string
          type: Database["public"]["Enums"]["drop_type"]
          url: string
          url_hash?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          image_url?: string | null
          lang_id?: number | null
          published_at?: string | null
          score?: number | null
          source_id?: number | null
          summary?: string | null
          tags?: string[]
          title?: string
          type?: Database["public"]["Enums"]["drop_type"]
          url?: string
          url_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drops_lang_id_fkey"
            columns: ["lang_id"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drops_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_events: {
        Row: {
          action: string
          channel: string
          created_at: string
          drop_id: number
          dwell_time_seconds: number | null
          id: number
          user_id: string
        }
        Insert: {
          action: string
          channel: string
          created_at?: string
          drop_id: number
          dwell_time_seconds?: number | null
          id?: number
          user_id: string
        }
        Update: {
          action?: string
          channel?: string
          created_at?: string
          drop_id?: number
          dwell_time_seconds?: number | null
          id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_events_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "drops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_queue: {
        Row: {
          created_at: string
          error: string | null
          id: number
          lang: string | null
          source_id: number | null
          status: string
          tries: number
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: number
          lang?: string | null
          source_id?: number | null
          status?: string
          tries?: number
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: number
          lang?: string | null
          source_id?: number | null
          status?: string
          tries?: number
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_queue_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      languages: {
        Row: {
          code: string
          id: number
          label: string
        }
        Insert: {
          code: string
          id?: number
          label: string
        }
        Update: {
          code?: string
          id?: number
          label?: string
        }
        Relationships: []
      }
      newsletter_subscriptions: {
        Row: {
          active: boolean
          slot: string
          user_id: string
        }
        Insert: {
          active?: boolean
          slot?: string
          user_id: string
        }
        Update: {
          active?: boolean
          slot?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      preferences: {
        Row: {
          selected_language_ids: number[]
          selected_topic_ids: number[]
          updated_at: string
          user_id: string
        }
        Insert: {
          selected_language_ids?: number[]
          selected_topic_ids?: number[]
          updated_at?: string
          user_id: string
        }
        Update: {
          selected_language_ids?: number[]
          selected_topic_ids?: number[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_provider: Database["public"]["Enums"]["auth_provider"]
          created_at: string
          display_name: string | null
          email: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
        }
        Insert: {
          auth_provider?: Database["public"]["Enums"]["auth_provider"]
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
        }
        Update: {
          auth_provider?: Database["public"]["Enums"]["auth_provider"]
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
        }
        Relationships: []
      }
      sources: {
        Row: {
          created_at: string
          feed_url: string | null
          homepage_url: string | null
          id: number
          name: string
          official: boolean
          status: string
        }
        Insert: {
          created_at?: string
          feed_url?: string | null
          homepage_url?: string | null
          id?: number
          name: string
          official?: boolean
          status?: string
        }
        Update: {
          created_at?: string
          feed_url?: string | null
          homepage_url?: string | null
          id?: number
          name?: string
          official?: boolean
          status?: string
        }
        Relationships: []
      }
      sponsor_contents: {
        Row: {
          article_url: string
          budget_cents: number
          created_at: string
          duration_days: number
          id: number
          sponsor_user_id: string
          status: string
          targeting: Json
        }
        Insert: {
          article_url: string
          budget_cents?: number
          created_at?: string
          duration_days?: number
          id?: number
          sponsor_user_id: string
          status?: string
          targeting?: Json
        }
        Update: {
          article_url?: string
          budget_cents?: number
          created_at?: string
          duration_days?: number
          id?: number
          sponsor_user_id?: string
          status?: string
          targeting?: Json
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_contents_sponsor_user_id_fkey"
            columns: ["sponsor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          id: number
          label: string
          slug: string
        }
        Insert: {
          id?: number
          label: string
          slug: string
        }
        Update: {
          id?: number
          label?: string
          slug?: string
        }
        Relationships: []
      }
      whatsapp_subscriptions: {
        Row: {
          active: boolean
          phone: string | null
          slots: string[]
          user_id: string
          verified: boolean
        }
        Insert: {
          active?: boolean
          phone?: string | null
          slots?: string[]
          user_id: string
          verified?: boolean
        }
        Update: {
          active?: boolean
          phone?: string | null
          slots?: string[]
          user_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bookmark_upsert: {
        Args: { _drop_id: number }
        Returns: undefined
      }
      ensure_profile: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_candidate_drops: {
        Args: { limit_n?: number }
        Returns: {
          created_at: string
          id: number
          image_url: string | null
          lang_id: number | null
          published_at: string | null
          score: number | null
          source_id: number | null
          summary: string | null
          tags: string[]
          title: string
          type: Database["public"]["Enums"]["drop_type"]
          url: string
          url_hash: string | null
        }[]
      }
      record_engagement: {
        Args: { _action: string; _channel?: string; _drop_id: number }
        Returns: undefined
      }
      upsert_preferences: {
        Args: { _langs: number[]; _topics: number[] }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "user" | "editor" | "admin" | "superadmin"
      auth_provider: "email" | "google"
      drop_type: "article" | "video"
      subscription_tier: "free" | "premium" | "corporate" | "sponsor"
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
      app_role: ["user", "editor", "admin", "superadmin"],
      auth_provider: ["email", "google"],
      drop_type: ["article", "video"],
      subscription_tier: ["free", "premium", "corporate", "sponsor"],
    },
  },
} as const
