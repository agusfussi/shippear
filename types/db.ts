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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      comercios: {
        Row: {
          creado_por: string | null
          created_at: string
          direccion: string | null
          es_demo: boolean
          id: string
          lat: number | null
          lng: number | null
          nombre: string
          notas: string | null
          vendedor_asignado: string | null
        }
        Insert: {
          creado_por?: string | null
          created_at?: string
          direccion?: string | null
          es_demo?: boolean
          id?: string
          lat?: number | null
          lng?: number | null
          nombre: string
          notas?: string | null
          vendedor_asignado?: string | null
        }
        Update: {
          creado_por?: string | null
          created_at?: string
          direccion?: string | null
          es_demo?: boolean
          id?: string
          lat?: number | null
          lng?: number | null
          nombre?: string
          notas?: string | null
          vendedor_asignado?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comercios_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comercios_vendedor_asignado_fkey"
            columns: ["vendedor_asignado"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fichas: {
        Row: {
          categoria: string
          created_at: string
          data: Json
          formato: string
          id: string
          modelo: string
          nse: string
          prompt_version: string
          request_id: string
          visita_id: string
        }
        Insert: {
          categoria: string
          created_at?: string
          data: Json
          formato: string
          id?: string
          modelo: string
          nse: string
          prompt_version: string
          request_id: string
          visita_id: string
        }
        Update: {
          categoria?: string
          created_at?: string
          data?: Json
          formato?: string
          id?: string
          modelo?: string
          nse?: string
          prompt_version?: string
          request_id?: string
          visita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fichas_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: true
            referencedRelation: "v_comercios_ultima_ficha"
            referencedColumns: ["visita_id"]
          },
          {
            foreignKeyName: "fichas_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: true
            referencedRelation: "visitas"
            referencedColumns: ["id"]
          },
        ]
      }
      fotos: {
        Row: {
          byte_size: number
          created_at: string
          id: string
          mime_type: string
          storage_path: string
          tipo: string
          visita_id: string
        }
        Insert: {
          byte_size: number
          created_at?: string
          id?: string
          mime_type: string
          storage_path: string
          tipo: string
          visita_id: string
        }
        Update: {
          byte_size?: number
          created_at?: string
          id?: string
          mime_type?: string
          storage_path?: string
          tipo?: string
          visita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fotos_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "v_comercios_ultima_ficha"
            referencedColumns: ["visita_id"]
          },
          {
            foreignKeyName: "fotos_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visitas"
            referencedColumns: ["id"]
          },
        ]
      }
      mensajes: {
        Row: {
          contenido: string
          created_at: string
          id: string
          request_id: string
          rol: string
          visita_id: string
        }
        Insert: {
          contenido: string
          created_at?: string
          id?: string
          request_id?: string
          rol: string
          visita_id: string
        }
        Update: {
          contenido?: string
          created_at?: string
          id?: string
          request_id?: string
          rol?: string
          visita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensajes_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "v_comercios_ultima_ficha"
            referencedColumns: ["visita_id"]
          },
          {
            foreignKeyName: "mensajes_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visitas"
            referencedColumns: ["id"]
          },
        ]
      }
      productos_lv: {
        Row: {
          activo: boolean
          categoria: string
          es_demo: boolean
          formatos_objetivo: string[]
          gama: string
          id: string
          nombre: string
          nse_objetivo: string[]
          presentacion: string
          sku: string | null
        }
        Insert: {
          activo?: boolean
          categoria: string
          es_demo?: boolean
          formatos_objetivo?: string[]
          gama?: string
          id?: string
          nombre: string
          nse_objetivo?: string[]
          presentacion: string
          sku?: string | null
        }
        Update: {
          activo?: boolean
          categoria?: string
          es_demo?: boolean
          formatos_objetivo?: string[]
          gama?: string
          id?: string
          nombre?: string
          nse_objetivo?: string[]
          presentacion?: string
          sku?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          nombre: string
          rol: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id: string
          nombre?: string
          rol?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre?: string
          rol?: string
        }
        Relationships: []
      }
      visitas: {
        Row: {
          client_request_id: string
          comercio_id: string
          created_at: string
          fecha_visita: string
          id: string
          notas: string | null
          vendedor_id: string | null
        }
        Insert: {
          client_request_id?: string
          comercio_id: string
          created_at?: string
          fecha_visita?: string
          id?: string
          notas?: string | null
          vendedor_id?: string | null
        }
        Update: {
          client_request_id?: string
          comercio_id?: string
          created_at?: string
          fecha_visita?: string
          id?: string
          notas?: string | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visitas_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "v_comercios_ultima_ficha"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_comercios_ultima_ficha: {
        Row: {
          categoria: string | null
          creado_por: string | null
          created_at: string | null
          direccion: string | null
          es_demo: boolean | null
          fecha_visita: string | null
          ficha: Json | null
          formato: string | null
          id: string | null
          lat: number | null
          lng: number | null
          nombre: string | null
          notas: string | null
          nse: string | null
          vendedor_asignado: string | null
          visita_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comercios_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comercios_vendedor_asignado_fkey"
            columns: ["vendedor_asignado"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      guardar_ficha: {
        Args: {
          p_data: Json
          p_modelo: string
          p_prompt_version: string
          p_request_id: string
          p_visita_id: string
        }
        Returns: string
      }
      mapa_comercios: { Args: never; Returns: Json }
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
