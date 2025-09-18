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
      admin_audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: number
          resource_id: string | null
          resource_type: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: number
          resource_id?: string | null
          resource_type: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: number
          resource_id?: string | null
          resource_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_newsletter_targets"
            referencedColumns: ["user_id"]
          },
        ]
      }
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
          {
            foreignKeyName: "bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_newsletter_targets"
            referencedColumns: ["user_id"]
          },
        ]
      }
      content_topics: {
        Row: {
          content_id: number
          created_at: string | null
          id: number
          topic_id: number
        }
        Insert: {
          content_id: number
          created_at?: string | null
          id?: number
          topic_id: number
        }
        Update: {
          content_id?: number
          created_at?: string | null
          id?: number
          topic_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_topics_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "drops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
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
          {
            foreignKeyName: "corporate_sources_corp_user_id_fkey"
            columns: ["corp_user_id"]
            isOneToOne: false
            referencedRelation: "v_newsletter_targets"
            referencedColumns: ["user_id"]
          },
        ]
      }
      cron_execution_log: {
        Row: {
          error_message: string | null
          executed_at: string
          id: number
          job_name: string
          response_body: string | null
          response_status: number | null
          success: boolean | null
        }
        Insert: {
          error_message?: string | null
          executed_at?: string
          id?: number
          job_name: string
          response_body?: string | null
          response_status?: number | null
          success?: boolean | null
        }
        Update: {
          error_message?: string | null
          executed_at?: string
          id?: number
          job_name?: string
          response_body?: string | null
          response_status?: number | null
          success?: boolean | null
        }
        Relationships: []
      }
      cron_jobs: {
        Row: {
          created_at: string
          enabled: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "daily_batches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_newsletter_targets"
            referencedColumns: ["user_id"]
          },
        ]
      }
      delivery_log: {
        Row: {
          channel: string
          dedup_key: string | null
          id: number
          meta: Json | null
          provider_message_id: string | null
          sent_at: string
          status: string
          user_id: string
        }
        Insert: {
          channel?: string
          dedup_key?: string | null
          id?: number
          meta?: Json | null
          provider_message_id?: string | null
          sent_at?: string
          status: string
          user_id: string
        }
        Update: {
          channel?: string
          dedup_key?: string | null
          id?: number
          meta?: Json | null
          provider_message_id?: string | null
          sent_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      drops: {
        Row: {
          authority_score: number | null
          created_at: string
          embedding: string | null
          embeddings: string | null
          id: number
          image_url: string | null
          l1_topic_id: number | null
          l2_topic_id: number | null
          lang_code: string | null
          lang_id: number | null
          language: string | null
          og_scraped: boolean
          popularity_score: number | null
          published_at: string | null
          quality_score: number | null
          score: number | null
          source_id: number | null
          summary: string | null
          tag_done: boolean
          tags: string[]
          title: string
          type: Database["public"]["Enums"]["drop_type"]
          url: string
          url_hash: string | null
          youtube_category: string | null
          youtube_channel_id: string | null
          youtube_duration_seconds: number | null
          youtube_published_at: string | null
          youtube_thumbnail_url: string | null
          youtube_video_id: string | null
          youtube_view_count: number | null
        }
        Insert: {
          authority_score?: number | null
          created_at?: string
          embedding?: string | null
          embeddings?: string | null
          id?: number
          image_url?: string | null
          l1_topic_id?: number | null
          l2_topic_id?: number | null
          lang_code?: string | null
          lang_id?: number | null
          language?: string | null
          og_scraped?: boolean
          popularity_score?: number | null
          published_at?: string | null
          quality_score?: number | null
          score?: number | null
          source_id?: number | null
          summary?: string | null
          tag_done?: boolean
          tags?: string[]
          title: string
          type: Database["public"]["Enums"]["drop_type"]
          url: string
          url_hash?: string | null
          youtube_category?: string | null
          youtube_channel_id?: string | null
          youtube_duration_seconds?: number | null
          youtube_published_at?: string | null
          youtube_thumbnail_url?: string | null
          youtube_video_id?: string | null
          youtube_view_count?: number | null
        }
        Update: {
          authority_score?: number | null
          created_at?: string
          embedding?: string | null
          embeddings?: string | null
          id?: number
          image_url?: string | null
          l1_topic_id?: number | null
          l2_topic_id?: number | null
          lang_code?: string | null
          lang_id?: number | null
          language?: string | null
          og_scraped?: boolean
          popularity_score?: number | null
          published_at?: string | null
          quality_score?: number | null
          score?: number | null
          source_id?: number | null
          summary?: string | null
          tag_done?: boolean
          tags?: string[]
          title?: string
          type?: Database["public"]["Enums"]["drop_type"]
          url?: string
          url_hash?: string | null
          youtube_category?: string | null
          youtube_channel_id?: string | null
          youtube_duration_seconds?: number | null
          youtube_published_at?: string | null
          youtube_thumbnail_url?: string | null
          youtube_video_id?: string | null
          youtube_view_count?: number | null
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
          {
            foreignKeyName: "fk_drops_l1_topic"
            columns: ["l1_topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_drops_l2_topic"
            columns: ["l2_topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      email_jobs: {
        Row: {
          created_at: string
          id: number
          last_error: string | null
          scheduled_for: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          last_error?: string | null
          scheduled_for: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          last_error?: string | null
          scheduled_for?: string
          status?: string
          user_id?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "engagement_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_newsletter_targets"
            referencedColumns: ["user_id"]
          },
        ]
      }
      ingestion_logs: {
        Row: {
          articles_tagged: number
          created_at: string
          cycle_timestamp: string
          errors: string[]
          feeds_processed: number
          id: number
          ingestion_processed: number
          new_articles: number
          success: boolean
        }
        Insert: {
          articles_tagged?: number
          created_at?: string
          cycle_timestamp: string
          errors?: string[]
          feeds_processed?: number
          id?: number
          ingestion_processed?: number
          new_articles?: number
          success?: boolean
        }
        Update: {
          articles_tagged?: number
          created_at?: string
          cycle_timestamp?: string
          errors?: string[]
          feeds_processed?: number
          id?: number
          ingestion_processed?: number
          new_articles?: number
          success?: boolean
        }
        Relationships: []
      }
      ingestion_queue: {
        Row: {
          created_at: string
          error: string | null
          id: number
          lang: string | null
          notes: string | null
          source_id: number | null
          source_label: string | null
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
          notes?: string | null
          source_id?: number | null
          source_label?: string | null
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
          notes?: string | null
          source_id?: number | null
          source_label?: string | null
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
          cadence: string
          confirmed: boolean
          slot: string
          user_id: string
        }
        Insert: {
          active?: boolean
          cadence: string
          confirmed?: boolean
          slot?: string
          user_id: string
        }
        Update: {
          active?: boolean
          cadence?: string
          confirmed?: boolean
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
          {
            foreignKeyName: "newsletter_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_newsletter_targets"
            referencedColumns: ["user_id"]
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
          {
            foreignKeyName: "preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_newsletter_targets"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_provider: Database["public"]["Enums"]["auth_provider"]
          company_role: string | null
          created_at: string
          display_name: string | null
          email: string
          first_name: string | null
          id: string
          is_active: boolean
          language_prefs: string[]
          last_name: string | null
          onboarding_completed: boolean
          preference_embeddings: string | null
          role: Database["public"]["Enums"]["app_role"]
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          username: string | null
          youtube_embed_pref: boolean
        }
        Insert: {
          auth_provider?: Database["public"]["Enums"]["auth_provider"]
          company_role?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          first_name?: string | null
          id: string
          is_active?: boolean
          language_prefs?: string[]
          last_name?: string | null
          onboarding_completed?: boolean
          preference_embeddings?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          username?: string | null
          youtube_embed_pref?: boolean
        }
        Update: {
          auth_provider?: Database["public"]["Enums"]["auth_provider"]
          company_role?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          first_name?: string | null
          id?: string
          is_active?: boolean
          language_prefs?: string[]
          last_name?: string | null
          onboarding_completed?: boolean
          preference_embeddings?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          username?: string | null
          youtube_embed_pref?: boolean
        }
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      sitemap_runs: {
        Row: {
          archive_urls_count: number | null
          bing_ping_success: boolean | null
          completed_at: string | null
          error_message: string | null
          google_ping_success: boolean | null
          id: number
          started_at: string
          success: boolean | null
          topics_count: number | null
          total_urls: number | null
        }
        Insert: {
          archive_urls_count?: number | null
          bing_ping_success?: boolean | null
          completed_at?: string | null
          error_message?: string | null
          google_ping_success?: boolean | null
          id?: number
          started_at?: string
          success?: boolean | null
          topics_count?: number | null
          total_urls?: number | null
        }
        Update: {
          archive_urls_count?: number | null
          bing_ping_success?: boolean | null
          completed_at?: string | null
          error_message?: string | null
          google_ping_success?: boolean | null
          id?: number
          started_at?: string
          success?: boolean | null
          topics_count?: number | null
          total_urls?: number | null
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
          type: string
        }
        Insert: {
          created_at?: string
          feed_url?: string | null
          homepage_url?: string | null
          id?: number
          name: string
          official?: boolean
          status?: string
          type?: string
        }
        Update: {
          created_at?: string
          feed_url?: string | null
          homepage_url?: string | null
          id?: number
          name?: string
          official?: boolean
          status?: string
          type?: string
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
          {
            foreignKeyName: "sponsor_contents_sponsor_user_id_fkey"
            columns: ["sponsor_user_id"]
            isOneToOne: false
            referencedRelation: "v_newsletter_targets"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tagging_params: {
        Row: {
          description: string | null
          id: number
          param_name: string
          param_value: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          id?: number
          param_name: string
          param_value: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          id?: number
          param_name?: string
          param_value?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tagging_params_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tagging_params_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "v_newsletter_targets"
            referencedColumns: ["user_id"]
          },
        ]
      }
      topic_keywords: {
        Row: {
          created_at: string | null
          id: number
          keywords: string[]
          topic_id: number
        }
        Insert: {
          created_at?: string | null
          id?: number
          keywords?: string[]
          topic_id: number
        }
        Update: {
          created_at?: string | null
          id?: number
          keywords?: string[]
          topic_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "topic_keywords_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: true
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          id: number
          intro: string | null
          is_active: boolean
          label: string
          level: number
          parent_id: number | null
          slug: string
        }
        Insert: {
          id?: number
          intro?: string | null
          is_active?: boolean
          label: string
          level: number
          parent_id?: number | null
          slug: string
        }
        Update: {
          id?: number
          intro?: string | null
          is_active?: boolean
          label?: string
          level?: number
          parent_id?: number | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topics_backup: {
        Row: {
          id: number | null
          is_active: boolean | null
          label: string | null
          level: number | null
          parent_id: number | null
          slug: string | null
        }
        Insert: {
          id?: number | null
          is_active?: boolean | null
          label?: string | null
          level?: number | null
          parent_id?: number | null
          slug?: string | null
        }
        Update: {
          id?: number | null
          is_active?: boolean | null
          label?: string | null
          level?: number | null
          parent_id?: number | null
          slug?: string | null
        }
        Relationships: []
      }
      user_feed_cache: {
        Row: {
          created_at: string
          drop_id: number
          expires_at: string
          final_score: number
          position: number
          reason_for_ranking: string
          user_id: string
        }
        Insert: {
          created_at?: string
          drop_id: number
          expires_at?: string
          final_score: number
          position: number
          reason_for_ranking: string
          user_id: string
        }
        Update: {
          created_at?: string
          drop_id?: number
          expires_at?: string
          final_score?: number
          position?: number
          reason_for_ranking?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profile_vectors: {
        Row: {
          profile_vec: string
          updated_at: string
          user_id: string
        }
        Insert: {
          profile_vec: string
          updated_at?: string
          user_id: string
        }
        Update: {
          profile_vec?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_topic_preferences: {
        Row: {
          created_at: string | null
          level: number
          priority: number | null
          topic_id: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          level: number
          priority?: number | null
          topic_id: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          level?: number
          priority?: number | null
          topic_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_topic_preferences_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "whatsapp_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_newsletter_targets"
            referencedColumns: ["user_id"]
          },
        ]
      }
      youtube_cache: {
        Row: {
          created_at: string
          expires_at: string
          fetched_at: string
          id: number
          payload: Json
          video_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          fetched_at?: string
          id?: never
          payload: Json
          video_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          fetched_at?: string
          id?: never
          payload?: Json
          video_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_newsletter_targets: {
        Row: {
          cadence: string | null
          confirmed: boolean | null
          email: string | null
          subscription_tier:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_soft_delete_drop: {
        Args: { _drop_id: number }
        Returns: undefined
      }
      admin_update_drop_tags: {
        Args: { _drop_id: number; _topic_ids: number[] }
        Returns: undefined
      }
      apply_topics_from_tags: {
        Args: { p_drop_id: number }
        Returns: undefined
      }
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      bookmark_upsert: {
        Args: { _drop_id: number }
        Returns: undefined
      }
      calculate_popularity_score: {
        Args: { raw_popularity: number }
        Returns: number
      }
      calculate_recency_score: {
        Args: { published_date: string }
        Returns: number
      }
      ensure_profile: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_candidate_drops: {
        Args: { limit_n?: number }
        Returns: {
          authority_score: number | null
          created_at: string
          embedding: string | null
          embeddings: string | null
          id: number
          image_url: string | null
          l1_topic_id: number | null
          l2_topic_id: number | null
          lang_code: string | null
          lang_id: number | null
          language: string | null
          og_scraped: boolean
          popularity_score: number | null
          published_at: string | null
          quality_score: number | null
          score: number | null
          source_id: number | null
          summary: string | null
          tag_done: boolean
          tags: string[]
          title: string
          type: Database["public"]["Enums"]["drop_type"]
          url: string
          url_hash: string | null
          youtube_category: string | null
          youtube_channel_id: string | null
          youtube_duration_seconds: number | null
          youtube_published_at: string | null
          youtube_thumbnail_url: string | null
          youtube_video_id: string | null
          youtube_view_count: number | null
        }[]
      }
      get_current_user_profile: {
        Args: Record<PropertyKey, never>
        Returns: {
          auth_provider: Database["public"]["Enums"]["auth_provider"]
          company_role: string | null
          created_at: string
          display_name: string | null
          email: string
          first_name: string | null
          id: string
          is_active: boolean
          language_prefs: string[]
          last_name: string | null
          onboarding_completed: boolean
          preference_embeddings: string | null
          role: Database["public"]["Enums"]["app_role"]
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          username: string | null
          youtube_embed_pref: boolean
        }
      }
      get_ingestion_health: {
        Args: Record<PropertyKey, never>
        Returns: {
          is_healthy: boolean
          last_successful_run: string
          minutes_since_last_run: number
          queue_size: number
          untagged_articles: number
        }[]
      }
      get_public_profile_by_username: {
        Args: { _username: string }
        Returns: {
          created_at: string
          display_name: string
          id: string
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          username: string
        }[]
      }
      get_ranked_drops: {
        Args: { limit_n?: number }
        Returns: {
          final_score: number
          id: number
          image_url: string
          published_at: string
          reason_for_ranking: string
          source_id: number
          summary: string
          tags: string[]
          title: string
          type: Database["public"]["Enums"]["drop_type"]
          url: string
        }[]
      }
      get_user_feedback_score: {
        Args: {
          _drop_id: number
          _source_id: number
          _tags: string[]
          _user_id: string
        }
        Returns: number
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      is_admin_user: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: unknown
      }
      log_admin_action: {
        Args: {
          _action: string
          _details?: Json
          _resource_id?: string
          _resource_type: string
        }
        Returns: undefined
      }
      public_profile_feed: {
        Args: { _username: string }
        Returns: {
          drop_id: number
          image_url: string
          saved_at: string
          source_name: string
          title: string
          url: string
        }[]
      }
      record_engagement: {
        Args: { _action: string; _channel?: string; _drop_id: number }
        Returns: undefined
      }
      set_article_topics: {
        Args:
          | { _content_id: number; _topic_ids: number[] }
          | { p_id: number; p_tags: string[] }
        Returns: undefined
      }
      set_drop_tags: {
        Args: { p_id: number; p_tag_done?: boolean; p_tags: string[] }
        Returns: undefined
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      topic_descendants: {
        Args: { root: number }
        Returns: {
          id: number
        }[]
      }
      trigger_background_ranking: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      update_user_profile: {
        Args: { _display_name?: string; _username?: string }
        Returns: {
          auth_provider: Database["public"]["Enums"]["auth_provider"]
          company_role: string | null
          created_at: string
          display_name: string | null
          email: string
          first_name: string | null
          id: string
          is_active: boolean
          language_prefs: string[]
          last_name: string | null
          onboarding_completed: boolean
          preference_embeddings: string | null
          role: Database["public"]["Enums"]["app_role"]
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          username: string | null
          youtube_embed_pref: boolean
        }
      }
      upsert_preferences: {
        Args: { _langs: number[]; _topics: number[] }
        Returns: undefined
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
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
