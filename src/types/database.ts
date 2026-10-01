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
      budget_template_allocations: {
        Row: {
          amount: number
          budget_template_id: string
          created_at: string
          financial_category_id: string
          id: string
          updated_at: string
        }
        Insert: {
          amount: number
          budget_template_id: string
          created_at?: string
          financial_category_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          budget_template_id?: string
          created_at?: string
          financial_category_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_template_allocations_budget_template_id_fkey"
            columns: ["budget_template_id"]
            isOneToOne: false
            referencedRelation: "budget_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_template_allocations_financial_category_id_fkey"
            columns: ["financial_category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          suggested_available_amount: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          suggested_available_amount?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          suggested_available_amount?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          display_order: number
          id: string
          name: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          name: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduled_payment_occurrences: {
        Row: {
          created_at: string
          due_date: string
          expected_amount: number | null
          id: string
          scheduled_payment_id: string
          status: string
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_date: string
          expected_amount?: number | null
          id?: string
          scheduled_payment_id: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          due_date?: string
          expected_amount?: number | null
          id?: string
          scheduled_payment_id?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_payment_occurrences_scheduled_payment_id_fkey"
            columns: ["scheduled_payment_id"]
            isOneToOne: false
            referencedRelation: "scheduled_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_payment_occurrences_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_payments: {
        Row: {
          active: boolean
          amount_type: string
          created_at: string
          end_date: string | null
          expected_amount: number | null
          financial_category_id: string
          frequency: string
          id: string
          name: string
          reminder_days_before: number
          reminder_enabled: boolean
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          amount_type: string
          created_at?: string
          end_date?: string | null
          expected_amount?: number | null
          financial_category_id: string
          frequency: string
          id?: string
          name: string
          reminder_days_before?: number
          reminder_enabled?: boolean
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          amount_type?: string
          created_at?: string
          end_date?: string | null
          expected_amount?: number | null
          financial_category_id?: string
          frequency?: string
          id?: string
          name?: string
          reminder_days_before?: number
          reminder_enabled?: boolean
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_payments_financial_category_id_fkey"
            columns: ["financial_category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_payment_reminder_deliveries: {
        Row: {
          attempt_count: number
          created_at: string
          days_before_due: number
          id: string
          last_error: string | null
          occurrence_id: string
          reminder_date: string
          scheduled_payment_id: string
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          days_before_due: number
          id?: string
          last_error?: string | null
          occurrence_id: string
          reminder_date: string
          scheduled_payment_id: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          days_before_due?: number
          id?: string
          last_error?: string | null
          occurrence_id?: string
          reminder_date?: string
          scheduled_payment_id?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_payment_reminder_deliveries_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: true
            referencedRelation: "scheduled_payment_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_payment_reminder_deliveries_scheduled_payment_id_fkey"
            columns: ["scheduled_payment_id"]
            isOneToOne: false
            referencedRelation: "scheduled_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      item_option_price_observations: {
        Row: {
          availability: string
          checked_at: string
          created_at: string
          currency: string | null
          detected_prices: Json
          id: string
          message: string | null
          option_id: string
          origin: string
          price: number | null
          price_type: string | null
          source: string
          status: string
        }
        Insert: {
          availability?: string
          checked_at?: string
          created_at?: string
          currency?: string | null
          detected_prices?: Json
          id?: string
          message?: string | null
          option_id: string
          origin?: string
          price?: number | null
          price_type?: string | null
          source: string
          status: string
        }
        Update: {
          availability?: string
          checked_at?: string
          created_at?: string
          currency?: string | null
          detected_prices?: Json
          id?: string
          message?: string | null
          option_id?: string
          origin?: string
          price?: number | null
          price_type?: string | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_option_price_observations_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "item_options"
            referencedColumns: ["id"]
          },
        ]
      }
      item_options: {
        Row: {
          alert_drop_percentage: number | null
          alert_on_drop: boolean
          alert_on_increase: boolean
          brand: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          item_id: string
          last_checked_at: string | null
          model: string | null
          name: string
          notes: string | null
          price: number | null
          product_url: string | null
          selected: boolean
          specifications: string | null
          store: string | null
          target_price: number | null
          tracked_price_type: string
          tracking_enabled: boolean
          tracking_status: string
          updated_at: string
        }
        Insert: {
          alert_drop_percentage?: number | null
          alert_on_drop?: boolean
          alert_on_increase?: boolean
          brand?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          item_id: string
          last_checked_at?: string | null
          model?: string | null
          name: string
          notes?: string | null
          price?: number | null
          product_url?: string | null
          selected?: boolean
          specifications?: string | null
          store?: string | null
          target_price?: number | null
          tracked_price_type?: string
          tracking_enabled?: boolean
          tracking_status?: string
          updated_at?: string
        }
        Update: {
          alert_drop_percentage?: number | null
          alert_on_drop?: boolean
          alert_on_increase?: boolean
          brand?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          item_id?: string
          last_checked_at?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          price?: number | null
          product_url?: string | null
          selected?: boolean
          specifications?: string | null
          store?: string | null
          target_price?: number | null
          tracked_price_type?: string
          tracking_enabled?: boolean
          tracking_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_options_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          actual_cost: number | null
          category_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          estimated_cost: number | null
          id: string
          name: string
          notes: string | null
          priority: string
          project_id: string
          purchase_url: string | null
          quantity: number
          status: string
          updated_at: string
        }
        Insert: {
          actual_cost?: number | null
          category_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          estimated_cost?: number | null
          id?: string
          name: string
          notes?: string | null
          priority?: string
          project_id: string
          purchase_url?: string | null
          quantity?: number
          status?: string
          updated_at?: string
        }
        Update: {
          actual_cost?: number | null
          category_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          estimated_cost?: number | null
          id?: string
          name?: string
          notes?: string | null
          priority?: string
          project_id?: string
          purchase_url?: string | null
          quantity?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_budget_allocations: {
        Row: {
          amount: number
          created_at: string
          financial_category_id: string
          id: string
          monthly_budget_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          financial_category_id: string
          id?: string
          monthly_budget_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          financial_category_id?: string
          id?: string
          monthly_budget_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_budget_allocations_financial_category_id_fkey"
            columns: ["financial_category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_budget_allocations_monthly_budget_id_fkey"
            columns: ["monthly_budget_id"]
            isOneToOne: false
            referencedRelation: "monthly_budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_budgets: {
        Row: {
          available_amount: number
          created_at: string
          id: string
          period: string
          updated_at: string
          user_id: string
        }
        Insert: {
          available_amount: number
          created_at?: string
          id?: string
          period: string
          updated_at?: string
          user_id: string
        }
        Update: {
          available_amount?: number
          created_at?: string
          id?: string
          period?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          currency_code: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency_code?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency_code?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_savings_movements: {
        Row: {
          amount: number
          created_at: string
          id: string
          movement_date: string
          movement_type: string
          name: string
          project_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          movement_date: string
          movement_type: string
          name: string
          project_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          movement_date?: string
          movement_type?: string
          name?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_savings_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget: number | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          label_preset: string
          name: string
          priority_options: Json
          savings_accrues_interest: boolean
          savings_amount: number | null
          savings_end_date: string | null
          savings_goal_enabled: boolean
          savings_goal_monthly_amount: number | null
          savings_goal_start_date: string | null
          savings_initial_balance: number | null
          savings_interest_rate_annual: number | null
          savings_minimum_reserve: number | null
          savings_mode: string
          savings_start_date: string | null
          savings_target_amount: number | null
          status_options: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          budget?: number | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          label_preset?: string
          name: string
          priority_options?: Json
          savings_accrues_interest?: boolean
          savings_amount?: number | null
          savings_end_date?: string | null
          savings_goal_enabled?: boolean
          savings_goal_monthly_amount?: number | null
          savings_goal_start_date?: string | null
          savings_initial_balance?: number | null
          savings_interest_rate_annual?: number | null
          savings_minimum_reserve?: number | null
          savings_mode?: string
          savings_start_date?: string | null
          savings_target_amount?: number | null
          status_options?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          budget?: number | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          label_preset?: string
          name?: string
          priority_options?: Json
          savings_accrues_interest?: boolean
          savings_amount?: number | null
          savings_end_date?: string | null
          savings_goal_enabled?: boolean
          savings_goal_monthly_amount?: number | null
          savings_goal_start_date?: string | null
          savings_initial_balance?: number | null
          savings_interest_rate_annual?: number | null
          savings_minimum_reserve?: number | null
          savings_mode?: string
          savings_start_date?: string | null
          savings_target_amount?: number | null
          status_options?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          financial_category_id: string | null
          id: string
          name: string
          notes: string | null
          occurred_on: string
          transaction_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          financial_category_id?: string | null
          id?: string
          name: string
          notes?: string | null
          occurred_on: string
          transaction_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          financial_category_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          occurred_on?: string
          transaction_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_financial_category_id_fkey"
            columns: ["financial_category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_budget_template_from_monthly_budget: {
        Args: { p_name: string; p_source_budget_id: string }
        Returns: string
      }
      create_monthly_budget_snapshot: {
        Args: {
          p_available_amount: number
          p_period: string
          p_source_budget_id?: string
          p_source_template_id?: string
        }
        Returns: string
      }
      delete_transaction_consistently: {
        Args: { p_transaction_id: string }
        Returns: undefined
      }
      delete_scheduled_payment: {
        Args: { p_scheduled_payment_id: string }
        Returns: undefined
      }
      materialize_scheduled_payment_occurrence: {
        Args: { p_period: string; p_scheduled_payment_id: string }
        Returns: Database['public']['Tables']['scheduled_payment_occurrences']['Row'] | null
      }
      mark_scheduled_payment_occurrence_paid: {
        Args: { p_amount: number; p_notes?: string | null; p_occurrence_id: string; p_occurred_on: string }
        Returns: Database['public']['Tables']['transactions']['Row']
      }
      claim_scheduled_payment_reminder: {
        Args: {
          p_days_before_due: number
          p_occurrence_id: string
          p_reminder_date: string
        }
        Returns: Database['public']['Tables']['scheduled_payment_reminder_deliveries']['Row'] | null
      }
      complete_scheduled_payment_reminder: {
        Args: { p_delivery_id: string; p_error?: string | null; p_status: string }
        Returns: Database['public']['Tables']['scheduled_payment_reminder_deliveries']['Row']
      }
      select_item_option: { Args: { p_option_id: string }; Returns: undefined }
      skip_scheduled_payment_occurrence: { Args: { p_occurrence_id: string }; Returns: undefined }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
