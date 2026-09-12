/**
 * Supabase generated-style types. After applying migrations, regenerate with:
 *
 *   npx supabase gen types typescript --project-id <project-id> > src/types/database.ts
 *
 * Domain types in `domain.ts` stay the source of truth for the UI; mappers
 * convert numeric strings from Postgres into numbers.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          currency_code: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          currency_code?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          currency_code?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          budget: string | null
          icon: string | null
          label_preset: string
          status_options: Json
          priority_options: Json
          savings_mode: string
          savings_goal_enabled: boolean
          savings_initial_balance: string | null
          savings_target_amount: string | null
          savings_minimum_reserve: string | null
          savings_goal_monthly_amount: string | null
          savings_goal_start_date: string | null
          savings_amount: string | null
          savings_accrues_interest: boolean
          savings_interest_rate_annual: string | null
          savings_start_date: string | null
          savings_end_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          budget?: number | string | null
          icon?: string | null
          label_preset?: string
          status_options?: Json
          priority_options?: Json
          savings_mode?: string
          savings_goal_enabled?: boolean
          savings_initial_balance?: number | string | null
          savings_target_amount?: number | string | null
          savings_minimum_reserve?: number | string | null
          savings_goal_monthly_amount?: number | string | null
          savings_goal_start_date?: string | null
          savings_amount?: number | string | null
          savings_accrues_interest?: boolean
          savings_interest_rate_annual?: number | string | null
          savings_start_date?: string | null
          savings_end_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          budget?: number | string | null
          icon?: string | null
          label_preset?: string
          status_options?: Json
          priority_options?: Json
          savings_mode?: string
          savings_goal_enabled?: boolean
          savings_initial_balance?: number | string | null
          savings_target_amount?: number | string | null
          savings_minimum_reserve?: number | string | null
          savings_goal_monthly_amount?: number | string | null
          savings_goal_start_date?: string | null
          savings_amount?: number | string | null
          savings_accrues_interest?: boolean
          savings_interest_rate_annual?: number | string | null
          savings_start_date?: string | null
          savings_end_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_savings_movements: {
        Row: {
          id: string
          project_id: string
          name: string
          movement_date: string
          amount: string
          movement_type: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          movement_date: string
          amount: number | string
          movement_type: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          movement_date?: string
          amount?: number | string
          movement_type?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'project_savings_movements_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
      categories: {
        Row: {
          id: string
          project_id: string
          name: string
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      items: {
        Row: {
          id: string
          project_id: string
          category_id: string | null
          name: string
          description: string | null
          status: string
          priority: string
          quantity: string
          estimated_cost: string | null
          actual_cost: string | null
          purchase_url: string | null
          notes: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          category_id?: string | null
          name: string
          description?: string | null
          status?: string
          priority?: string
          quantity?: number | string
          estimated_cost?: number | string | null
          actual_cost?: number | string | null
          purchase_url?: string | null
          notes?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          category_id?: string | null
          name?: string
          description?: string | null
          status?: string
          priority?: string
          quantity?: number | string
          estimated_cost?: number | string | null
          actual_cost?: number | string | null
          purchase_url?: string | null
          notes?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      item_options: {
        Row: {
          id: string
          item_id: string
          name: string
          brand: string | null
          model: string | null
          price: string | null
          store: string | null
          product_url: string | null
          image_url: string | null
          description: string | null
          specifications: string | null
          notes: string | null
          selected: boolean
          tracking_enabled: boolean
          tracked_price_type: string
          target_price: string | null
          alert_on_drop: boolean
          alert_on_increase: boolean
          alert_drop_percentage: string | null
          last_checked_at: string | null
          tracking_status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          item_id: string
          name: string
          brand?: string | null
          model?: string | null
          price?: number | string | null
          store?: string | null
          product_url?: string | null
          image_url?: string | null
          description?: string | null
          specifications?: string | null
          notes?: string | null
          selected?: boolean
          tracking_enabled?: boolean
          tracked_price_type?: string
          target_price?: number | string | null
          alert_on_drop?: boolean
          alert_on_increase?: boolean
          alert_drop_percentage?: number | string | null
          last_checked_at?: string | null
          tracking_status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          item_id?: string
          name?: string
          brand?: string | null
          model?: string | null
          price?: number | string | null
          store?: string | null
          product_url?: string | null
          image_url?: string | null
          description?: string | null
          specifications?: string | null
          notes?: string | null
          selected?: boolean
          tracking_enabled?: boolean
          tracked_price_type?: string
          target_price?: number | string | null
          alert_on_drop?: boolean
          alert_on_increase?: boolean
          alert_drop_percentage?: number | string | null
          last_checked_at?: string | null
          tracking_status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      item_option_price_observations: {
        Row: {
          id: string
          option_id: string
          price: string | null
          checked_at: string
          status: string
          availability: string
          source: string
          price_type: string | null
          origin: string
          currency: string | null
          detected_prices: Json
          message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          option_id: string
          price?: number | string | null
          checked_at?: string
          status: string
          availability?: string
          source: string
          price_type?: string | null
          origin?: string
          currency?: string | null
          detected_prices?: Json
          message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          option_id?: string
          price?: number | string | null
          checked_at?: string
          status?: string
          availability?: string
          source?: string
          price_type?: string | null
          origin?: string
          currency?: string | null
          detected_prices?: Json
          message?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'item_option_price_observations_option_id_fkey'
            columns: ['option_id']
            isOneToOne: false
            referencedRelation: 'item_options'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      select_item_option: {
        Args: { p_option_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
