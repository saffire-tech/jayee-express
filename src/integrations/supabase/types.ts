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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          is_active: boolean
          message: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          is_active?: boolean
          message: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          message?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      category_commissions: {
        Row: {
          category: string
          commission_pct: number
          created_at: string
          updated_at: string
        }
        Insert: {
          category: string
          commission_pct: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          category?: string
          commission_pct?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_locations: {
        Row: {
          contributed_by: string | null
          created_at: string
          id: string
          is_flagged: boolean
          latitude: number
          longitude: number
          name: string
          name_lower: string | null
          updated_at: string
          usage_count: number
        }
        Insert: {
          contributed_by?: string | null
          created_at?: string
          id?: string
          is_flagged?: boolean
          latitude: number
          longitude: number
          name: string
          name_lower?: string | null
          updated_at?: string
          usage_count?: number
        }
        Update: {
          contributed_by?: string | null
          created_at?: string
          id?: string
          is_flagged?: boolean
          latitude?: number
          longitude?: number
          name?: string
          name_lower?: string | null
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      delivery_locations: {
        Row: {
          id: string
          latitude: number
          longitude: number
          order_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          latitude: number
          longitude: number
          order_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          latitude?: number
          longitude?: number
          order_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_locations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_subscriptions: {
        Row: {
          amount_paid: number
          created_at: string
          expires_at: string
          id: string
          monthly_fee: number
          months: number
          payment_reference: string | null
          starts_at: string
          status: string
          user_id: string
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          expires_at: string
          id?: string
          monthly_fee: number
          months?: number
          payment_reference?: string | null
          starts_at?: string
          status?: string
          user_id: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          expires_at?: string
          id?: string
          monthly_fee?: number
          months?: number
          payment_reference?: string | null
          starts_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      delivery_zones: {
        Row: {
          created_at: string
          fee: number
          id: string
          is_active: boolean
          max_distance_km: number
          min_distance_km: number
          name: string
        }
        Insert: {
          created_at?: string
          fee: number
          id?: string
          is_active?: boolean
          max_distance_km: number
          min_distance_km?: number
          name: string
        }
        Update: {
          created_at?: string
          fee?: number
          id?: string
          is_active?: boolean
          max_distance_km?: number
          min_distance_km?: number
          name?: string
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string
          device_info: Json | null
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: Json | null
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: Json | null
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      help_problems: {
        Row: {
          created_at: string
          id: string
          sort_order: number
          steps_html: string
          title: string
          topic_id: string
          updated_at: string
          youtube_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          sort_order?: number
          steps_html?: string
          title: string
          topic_id: string
          updated_at?: string
          youtube_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          sort_order?: number
          steps_html?: string
          title?: string
          topic_id?: string
          updated_at?: string
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "help_problems_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "help_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      help_topics: {
        Row: {
          audience: Database["public"]["Enums"]["help_audience"]
          created_at: string
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          audience: Database["public"]["Enums"]["help_audience"]
          created_at?: string
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["help_audience"]
          created_at?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          city: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          updated_at: string
          zone: string
        }
        Insert: {
          city?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          updated_at?: string
          zone: string
        }
        Update: {
          city?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          updated_at?: string
          zone?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string | null
          created_at: string
          id: string
          is_read: boolean | null
          media_mime: string | null
          media_name: string | null
          media_size: number | null
          media_type: string | null
          media_url: string | null
          product_id: string | null
          receiver_id: string
          sender_id: string
          store_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          media_mime?: string | null
          media_name?: string | null
          media_size?: number | null
          media_type?: string | null
          media_url?: string | null
          product_id?: string | null
          receiver_id: string
          sender_id: string
          store_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          media_mime?: string | null
          media_name?: string | null
          media_size?: number | null
          media_type?: string | null
          media_url?: string | null
          product_id?: string | null
          receiver_id?: string
          sender_id?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          channel: string
          created_at: string
          data: Json | null
          id: string
          is_read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          price: number
          product_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          price: number
          product_id: string
          quantity?: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          price?: number
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer_id: string
          cancelled_at: string | null
          city: string
          created_at: string
          delivery_address: string | null
          delivery_fee: number
          delivery_landmark: string | null
          delivery_latitude: number | null
          delivery_longitude: number | null
          delivery_payout_status: string | null
          delivery_person_id: string | null
          delivery_status: string | null
          delivery_type: string
          id: string
          notes: string | null
          payment_reference: string | null
          payment_status: string
          status: string
          store_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          buyer_id: string
          cancelled_at?: string | null
          city: string
          created_at?: string
          delivery_address?: string | null
          delivery_fee?: number
          delivery_landmark?: string | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          delivery_payout_status?: string | null
          delivery_person_id?: string | null
          delivery_status?: string | null
          delivery_type?: string
          id?: string
          notes?: string | null
          payment_reference?: string | null
          payment_status?: string
          status?: string
          store_id: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          cancelled_at?: string | null
          city?: string
          created_at?: string
          delivery_address?: string | null
          delivery_fee?: number
          delivery_landmark?: string | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          delivery_payout_status?: string | null
          delivery_person_id?: string | null
          delivery_status?: string | null
          delivery_type?: string
          id?: string
          notes?: string | null
          payment_reference?: string | null
          payment_status?: string
          status?: string
          store_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_attempts: {
        Row: {
          amount: number
          buyer_id: string
          created_at: string
          currency: string
          id: string
          kind: string
          last_error: string | null
          orders_created_at: string | null
          payload: Json
          paystack_status: string | null
          reference: string
          status: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          amount: number
          buyer_id: string
          created_at?: string
          currency?: string
          id?: string
          kind?: string
          last_error?: string | null
          orders_created_at?: string | null
          payload?: Json
          paystack_status?: string | null
          reference: string
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          amount?: number
          buyer_id?: string
          created_at?: string
          currency?: string
          id?: string
          kind?: string
          last_error?: string | null
          orders_created_at?: string | null
          payload?: Json
          paystack_status?: string | null
          reference?: string
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      platform_commission_ledger: {
        Row: {
          category: string | null
          commission_amount: number
          commission_pct: number
          created_at: string
          gross_amount: number
          id: string
          order_id: string
          product_id: string | null
          reversal_reason: string | null
          reversed_at: string | null
        }
        Insert: {
          category?: string | null
          commission_amount: number
          commission_pct: number
          created_at?: string
          gross_amount: number
          id?: string
          order_id: string
          product_id?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
        }
        Update: {
          category?: string | null
          commission_amount?: number
          commission_pct?: number
          created_at?: string
          gross_amount?: number
          id?: string
          order_id?: string
          product_id?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_commission_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_commission_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_payout_accounts: {
        Row: {
          account_name: string
          account_number: string
          bank_code: string
          created_at: string
          created_by: string
          id: string
          is_default: boolean
          label: string
          paystack_recipient_code: string | null
          type: string
          updated_at: string
        }
        Insert: {
          account_name: string
          account_number: string
          bank_code: string
          created_at?: string
          created_by: string
          id?: string
          is_default?: boolean
          label: string
          paystack_recipient_code?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_code?: string
          created_at?: string
          created_by?: string
          id?: string
          is_default?: boolean
          label?: string
          paystack_recipient_code?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_payouts: {
        Row: {
          account_id: string | null
          admin_user_id: string
          amount: number
          created_at: string
          failure_reason: string | null
          id: string
          paystack_recipient_code: string | null
          paystack_transfer_code: string | null
          recipient_snapshot: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          admin_user_id: string
          amount: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          paystack_recipient_code?: string | null
          paystack_transfer_code?: string | null
          recipient_snapshot?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          admin_user_id?: string
          amount?: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          paystack_recipient_code?: string | null
          paystack_transfer_code?: string | null
          recipient_snapshot?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_payouts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "platform_payout_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          images: string[] | null
          is_active: boolean | null
          is_featured: boolean | null
          is_service: boolean | null
          name: string
          price: number
          stock: number | null
          store_id: string
          updated_at: string
          views: number | null
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean | null
          is_service?: boolean | null
          name: string
          price: number
          stock?: number | null
          store_id: string
          updated_at?: string
          views?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean | null
          is_service?: boolean | null
          name?: string
          price?: number
          stock?: number | null
          store_id?: string
          updated_at?: string
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          campus: string | null
          city: string | null
          created_at: string
          current_mode: Database["public"]["Enums"]["user_mode"] | null
          full_name: string | null
          id: string
          is_online: boolean
          is_suspended: boolean | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          campus?: string | null
          city?: string | null
          created_at?: string
          current_mode?: Database["public"]["Enums"]["user_mode"] | null
          full_name?: string | null
          id?: string
          is_online?: boolean
          is_suspended?: boolean | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          campus?: string | null
          city?: string | null
          created_at?: string
          current_mode?: Database["public"]["Enums"]["user_mode"] | null
          full_name?: string | null
          id?: string
          is_online?: boolean
          is_suspended?: boolean | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          is_online: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          is_online?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          is_online?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reconciliation_issues: {
        Row: {
          actual_amount: number | null
          created_at: string
          details: Json | null
          expected_amount: number | null
          id: string
          issue_type: string
          order_id: string | null
          payment_reference: string | null
          resolved: boolean
          resolved_at: string | null
          run_id: string
          severity: string
          transaction_id: string | null
          user_id: string | null
        }
        Insert: {
          actual_amount?: number | null
          created_at?: string
          details?: Json | null
          expected_amount?: number | null
          id?: string
          issue_type: string
          order_id?: string | null
          payment_reference?: string | null
          resolved?: boolean
          resolved_at?: string | null
          run_id: string
          severity?: string
          transaction_id?: string | null
          user_id?: string | null
        }
        Update: {
          actual_amount?: number | null
          created_at?: string
          details?: Json | null
          expected_amount?: number | null
          id?: string
          issue_type?: string
          order_id?: string | null
          payment_reference?: string | null
          resolved?: boolean
          resolved_at?: string | null
          run_id?: string
          severity?: string
          transaction_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_issues_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          mismatches_found: number
          notes: string | null
          paystack_calls: number
          started_at: string
          status: string
          transactions_checked: number
          window_end: string
          window_start: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          mismatches_found?: number
          notes?: string | null
          paystack_calls?: number
          started_at?: string
          status?: string
          transactions_checked?: number
          window_end: string
          window_start: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          mismatches_found?: number
          notes?: string | null
          paystack_calls?: number
          started_at?: string
          status?: string
          transactions_checked?: number
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          admin_notes: string | null
          category: string
          created_at: string
          description: string
          id: string
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          category?: string
          created_at?: string
          description: string
          id?: string
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          product_id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          product_id: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          product_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_applications: {
        Row: {
          city: string | null
          created_at: string
          full_name: string
          ghana_card_number: string
          ghana_card_url: string
          house_address: string
          id: string
          monthly_fee: number | null
          motor_registration: string
          phone: string
          photo_id_url: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          full_name: string
          ghana_card_number: string
          ghana_card_url: string
          house_address: string
          id?: string
          monthly_fee?: number | null
          motor_registration: string
          phone: string
          photo_id_url: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          created_at?: string
          full_name?: string
          ghana_card_number?: string
          ghana_card_url?: string
          house_address?: string
          id?: string
          monthly_fee?: number | null
          motor_registration?: string
          phone?: string
          photo_id_url?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      store_payout_details: {
        Row: {
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          created_at: string
          momo_number: string | null
          momo_provider: string | null
          payout_method: string | null
          paystack_subaccount_code: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          created_at?: string
          momo_number?: string | null
          momo_provider?: string | null
          payout_method?: string | null
          paystack_subaccount_code?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          created_at?: string
          momo_number?: string | null
          momo_provider?: string | null
          payout_method?: string | null
          paystack_subaccount_code?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_payout_details_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_subscriptions: {
        Row: {
          amount_paid: number
          created_at: string
          expires_at: string
          id: string
          monthly_fee: number | null
          months: number
          payment_reference: string | null
          plan_id: string | null
          starts_at: string
          status: string
          store_id: string
          user_id: string
        }
        Insert: {
          amount_paid: number
          created_at?: string
          expires_at: string
          id?: string
          monthly_fee?: number | null
          months: number
          payment_reference?: string | null
          plan_id?: string | null
          starts_at?: string
          status?: string
          store_id: string
          user_id: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          expires_at?: string
          id?: string
          monthly_fee?: number | null
          months?: number
          payment_reference?: string | null
          plan_id?: string | null
          starts_at?: string
          status?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      store_web_services: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          store_id: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          store_id: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          store_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_web_services_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          campus: string | null
          city: string
          cover_url: string | null
          created_at: string
          current_plan_id: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          is_suspended: boolean | null
          is_verified: boolean | null
          latitude: number | null
          location: string | null
          logo_url: string | null
          longitude: number | null
          monthly_fee: number | null
          name: string
          phone: string | null
          product_limit: number
          rejection_reason: string | null
          slug: string
          subscription_expires_at: string | null
          total_sales: number | null
          total_views: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          campus?: string | null
          city: string
          cover_url?: string | null
          created_at?: string
          current_plan_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          is_suspended?: boolean | null
          is_verified?: boolean | null
          latitude?: number | null
          location?: string | null
          logo_url?: string | null
          longitude?: number | null
          monthly_fee?: number | null
          name: string
          phone?: string | null
          product_limit?: number
          rejection_reason?: string | null
          slug: string
          subscription_expires_at?: string | null
          total_sales?: number | null
          total_views?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          campus?: string | null
          city?: string
          cover_url?: string | null
          created_at?: string
          current_plan_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          is_suspended?: boolean | null
          is_verified?: boolean | null
          latitude?: number | null
          location?: string | null
          logo_url?: string | null
          longitude?: number | null
          monthly_fee?: number | null
          name?: string
          phone?: string | null
          product_limit?: number
          rejection_reason?: string | null
          slug?: string
          subscription_expires_at?: string | null
          total_sales?: number | null
          total_views?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_current_plan_id_fkey"
            columns: ["current_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          max_products: number
          name: string
          price_per_month: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          max_products: number
          name: string
          price_per_month: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          max_products?: number
          name?: string
          price_per_month?: number
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_known_devices: {
        Row: {
          created_at: string
          device_hash: string
          id: string
          ip: string | null
          last_seen_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_hash: string
          id?: string
          ip?: string | null
          last_seen_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_hash?: string
          id?: string
          ip?: string | null
          last_seen_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_payout_details: {
        Row: {
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          created_at: string
          momo_number: string | null
          momo_provider: string | null
          payout_method: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          created_at?: string
          momo_number?: string | null
          momo_provider?: string | null
          payout_method?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          created_at?: string
          momo_number?: string | null
          momo_provider?: string | null
          payout_method?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_searches: {
        Row: {
          campus: string | null
          category: string | null
          created_at: string
          id: string
          search_query: string
          user_id: string
        }
        Insert: {
          campus?: string | null
          category?: string | null
          created_at?: string
          id?: string
          search_query: string
          user_id: string
        }
        Update: {
          campus?: string | null
          category?: string | null
          created_at?: string
          id?: string
          search_query?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string
          id: string
          reference_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          description: string
          id?: string
          reference_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string
          id?: string
          reference_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          admin_note: string | null
          admin_payment_reference: string | null
          amount: number
          created_at: string
          id: string
          momo_number: string
          momo_provider: string
          paid_at: string | null
          payment_method: string | null
          paystack_transfer_code: string | null
          processed_at: string | null
          rejection_reason: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          admin_payment_reference?: string | null
          amount: number
          created_at?: string
          id?: string
          momo_number: string
          momo_provider: string
          paid_at?: string | null
          payment_method?: string | null
          paystack_transfer_code?: string | null
          processed_at?: string | null
          rejection_reason?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          admin_payment_reference?: string | null
          amount?: number
          created_at?: string
          id?: string
          momo_number?: string
          momo_provider?: string
          paid_at?: string | null
          payment_method?: string | null
          paystack_transfer_code?: string | null
          processed_at?: string | null
          rejection_reason?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bump_location_usage: { Args: { _id: string }; Returns: undefined }
      compute_delivery_fee: {
        Args: {
          _delivery_type: string
          _dest_lat: number
          _dest_lng: number
          _store_ids: string[]
        }
        Returns: Json
      }
      current_user_city: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      finalize_order_payment: {
        Args: { _amount: number; _reference: string }
        Returns: Json
      }
      get_my_momo: {
        Args: never
        Returns: {
          bank_account_name: string
          bank_account_number: string
          bank_name: string
          momo_number: string
          momo_provider: string
          payout_method: string
        }[]
      }
      get_my_store_payout: {
        Args: { _store_id: string }
        Returns: {
          bank_account_name: string
          bank_account_number: string
          bank_name: string
          momo_number: string
          momo_provider: string
          payout_method: string
          paystack_subaccount_code: string
        }[]
      }
      get_order_contact: {
        Args: { _order_id: string }
        Returns: {
          buyer_name: string
          buyer_phone: string
          courier_name: string
          courier_phone: string
        }[]
      }
      has_active_rider_subscription: {
        Args: { _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_product_views: {
        Args: { product_id: string }
        Returns: undefined
      }
      increment_store_views: { Args: { store_id: string }; Returns: undefined }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      platform_revenue_summary: {
        Args: never
        Returns: {
          net_earned: number
          pending_withdrawals: number
          revenue_this_month: number
          rider_revenue: number
          store_revenue: number
          total_subscription_revenue: number
          total_withdrawn: number
        }[]
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      slugify: { Args: { _input: string }; Returns: string }
      update_wallet_balance: {
        Args: {
          _amount: number
          _description: string
          _reference_id?: string
          _type: string
          _user_id: string
        }
        Returns: number
      }
      wallet_cleared_balance: { Args: { _user_id: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "moderator" | "delivery"
      help_audience: "buyer" | "seller" | "delivery"
      user_mode: "buyer" | "seller"
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
      app_role: ["admin", "moderator", "delivery"],
      help_audience: ["buyer", "seller", "delivery"],
      user_mode: ["buyer", "seller"],
    },
  },
} as const
