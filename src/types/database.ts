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
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
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
          created_at?: string
          updated_at?: string
        }
        Relationships: []
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
          estimated_cost: string | null
          actual_cost: string | null
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
          estimated_cost?: number | string | null
          actual_cost?: number | string | null
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
          estimated_cost?: number | string | null
          actual_cost?: number | string | null
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
          created_at?: string
          updated_at?: string
        }
        Relationships: []
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
