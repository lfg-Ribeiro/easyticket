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
      event_organizers: {
        Row: {
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_organizers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          category: string
          cover_image_url: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          event_date: string
          event_end_time: string | null
          event_time: string
          fee_absorbed: boolean
          id: string
          location: string
          organizer_id: string
          published: boolean
          show_remaining_tickets: boolean
          title: string
          updated_at: string
          venue: string
        }
        Insert: {
          category?: string
          cover_image_url?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          event_date: string
          event_end_time?: string | null
          event_time: string
          fee_absorbed?: boolean
          id?: string
          location: string
          organizer_id: string
          published?: boolean
          show_remaining_tickets?: boolean
          title: string
          updated_at?: string
          venue: string
        }
        Update: {
          category?: string
          cover_image_url?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          event_date?: string
          event_end_time?: string | null
          event_time?: string
          fee_absorbed?: boolean
          id?: string
          location?: string
          organizer_id?: string
          published?: boolean
          show_remaining_tickets?: boolean
          title?: string
          updated_at?: string
          venue?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          buyer_cpf: string | null
          buyer_email: string
          buyer_name: string
          created_at: string
          event_id: string
          id: string
          payment_method: string
          payment_status: string
          platform_fee: number
          quantity: number
          service_fee: number
          subtotal: number
          total_amount: number
          transaction_id: string | null
        }
        Insert: {
          buyer_cpf?: string | null
          buyer_email: string
          buyer_name: string
          created_at?: string
          event_id: string
          id?: string
          payment_method?: string
          payment_status?: string
          platform_fee?: number
          quantity?: number
          service_fee?: number
          subtotal?: number
          total_amount?: number
          transaction_id?: string | null
        }
        Update: {
          buyer_cpf?: string | null
          buyer_email?: string
          buyer_name?: string
          created_at?: string
          event_id?: string
          id?: string
          payment_method?: string
          payment_status?: string
          platform_fee?: number
          quantity?: number
          service_fee?: number
          subtotal?: number
          total_amount?: number
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_id: string
          cpf: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          auth_id: string
          cpf?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          auth_id?: string
          cpf?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ticket_batches: {
        Row: {
          available_quantity: number
          created_at: string
          event_id: string
          id: string
          is_active: boolean
          name: string
          price: number
          sort_order: number
          status: string
          total_quantity: number
        }
        Insert: {
          available_quantity?: number
          created_at?: string
          event_id: string
          id?: string
          is_active?: boolean
          name: string
          price?: number
          sort_order?: number
          status?: string
          total_quantity?: number
        }
        Update: {
          available_quantity?: number
          created_at?: string
          event_id?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          status?: string
          total_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "ticket_batches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          batch_id: string | null
          check_in_status: string
          checked_in_at: string | null
          created_at: string
          event_id: string
          holder_cpf: string | null
          holder_email: string
          holder_name: string
          id: string
          order_id: string
          qr_code: string
          user_id: string | null
        }
        Insert: {
          batch_id?: string | null
          check_in_status?: string
          checked_in_at?: string | null
          created_at?: string
          event_id: string
          holder_cpf?: string | null
          holder_email: string
          holder_name: string
          id?: string
          order_id: string
          qr_code: string
          user_id?: string | null
        }
        Update: {
          batch_id?: string | null
          check_in_status?: string
          checked_in_at?: string | null
          created_at?: string
          event_id?: string
          holder_cpf?: string | null
          holder_email?: string
          holder_name?: string
          id?: string
          order_id?: string
          qr_code?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "ticket_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_batch: { Args: { p_batch_id: string }; Returns: Json }
      cleanup_expired_orders: { Args: never; Returns: Json }
      consume_batch_tickets: {
        Args: { p_batch_id: string; p_quantity: number }
        Returns: Json
      }
      get_sales_by_day: {
        Args: { end_date: string; start_date: string }
        Returns: {
          revenue: number
          sale_date: string
          tickets_sold: number
        }[]
      }
      get_sales_by_hour: {
        Args: { end_date: string; start_date: string }
        Returns: {
          revenue: number
          sale_hour: number
          tickets_sold: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_event_organizer: { Args: { _event_id: string }; Returns: boolean }
      transfer_ticket: {
        Args: { p_new_cpf: string; p_ticket_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "organizer" | "user" | "admin" | "validator"
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
    Enums: {
      app_role: ["organizer", "user", "admin", "validator"],
    },
  },
} as const
