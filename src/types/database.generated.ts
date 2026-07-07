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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          changes: Json | null
          clinic_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          changes?: Json | null
          clinic_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          changes?: Json | null
          clinic_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_counters: {
        Row: {
          clinic_id: string
          next_patient_number: number
        }
        Insert: {
          clinic_id: string
          next_patient_number?: number
        }
        Update: {
          clinic_id?: string
          next_patient_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "clinic_counters_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          phone: string | null
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          phone?: string | null
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          phone?: string | null
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      patient_clinical_info: {
        Row: {
          allergies: string[]
          chief_complaint: string | null
          clinic_id: string
          current_medications: string[]
          dental_history: string | null
          has_bleeding_disorder: boolean
          has_diabetes: boolean
          has_heart_disease: boolean
          has_hypertension: boolean
          is_pregnant: boolean
          is_smoker: boolean
          medical_conditions: string[]
          notes: string | null
          patient_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allergies?: string[]
          chief_complaint?: string | null
          clinic_id: string
          current_medications?: string[]
          dental_history?: string | null
          has_bleeding_disorder?: boolean
          has_diabetes?: boolean
          has_heart_disease?: boolean
          has_hypertension?: boolean
          is_pregnant?: boolean
          is_smoker?: boolean
          medical_conditions?: string[]
          notes?: string | null
          patient_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allergies?: string[]
          chief_complaint?: string | null
          clinic_id?: string
          current_medications?: string[]
          dental_history?: string | null
          has_bleeding_disorder?: boolean
          has_diabetes?: boolean
          has_heart_disease?: boolean
          has_hypertension?: boolean
          is_pregnant?: boolean
          is_smoker?: boolean
          medical_conditions?: string[]
          notes?: string | null
          patient_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_clinical_info_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_clinical_info_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_clinical_info_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_files: {
        Row: {
          clinic_id: string
          description: string | null
          file_type: Database["public"]["Enums"]["patient_file_type"]
          id: string
          patient_id: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          clinic_id: string
          description?: string | null
          file_type: Database["public"]["Enums"]["patient_file_type"]
          id?: string
          patient_id: string
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          clinic_id?: string
          description?: string | null
          file_type?: Database["public"]["Enums"]["patient_file_type"]
          id?: string
          patient_id?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_files_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_files_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_medical_alerts: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          id: string
          label: string
          patient_id: string
          severity: Database["public"]["Enums"]["alert_severity"]
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          patient_id: string
          severity?: Database["public"]["Enums"]["alert_severity"]
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          patient_id?: string
          severity?: Database["public"]["Enums"]["alert_severity"]
        }
        Relationships: [
          {
            foreignKeyName: "patient_medical_alerts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_medical_alerts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_medical_alerts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          deleted_at: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string
          full_name: string | null
          gender: string | null
          id: string
          insurance_policy_number: string | null
          insurance_provider: string | null
          last_name: string
          last_visit_at: string | null
          national_id: string | null
          occupation: string | null
          patient_number: string
          phone: string | null
          photo_path: string | null
          preferred_dentist_id: string | null
          referral_source: string | null
          status: Database["public"]["Enums"]["patient_status"]
          tags: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string
          full_name?: string | null
          gender?: string | null
          id?: string
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          last_name?: string
          last_visit_at?: string | null
          national_id?: string | null
          occupation?: string | null
          patient_number?: string
          phone?: string | null
          photo_path?: string | null
          preferred_dentist_id?: string | null
          referral_source?: string | null
          status?: Database["public"]["Enums"]["patient_status"]
          tags?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string
          full_name?: string | null
          gender?: string | null
          id?: string
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          last_name?: string
          last_visit_at?: string | null
          national_id?: string | null
          occupation?: string | null
          patient_number?: string
          phone?: string | null
          photo_path?: string | null
          preferred_dentist_id?: string | null
          referral_source?: string | null
          status?: Database["public"]["Enums"]["patient_status"]
          tags?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_preferred_dentist_id_fkey"
            columns: ["preferred_dentist_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          label: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          label: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          label?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          key: string
          label: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key: string
          label: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key?: string
          label?: string
        }
        Relationships: []
      }
      staff_profiles: {
        Row: {
          avatar_url: string | null
          clinic_id: string | null
          created_at: string
          deleted_at: string | null
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          role: Database["public"]["Enums"]["staff_role"]
          role_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          clinic_id?: string | null
          created_at?: string
          deleted_at?: string | null
          full_name: string
          id: string
          is_active?: boolean
          phone?: string | null
          role: Database["public"]["Enums"]["staff_role"]
          role_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          clinic_id?: string | null
          created_at?: string
          deleted_at?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          role_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_permissions: { Args: never; Returns: string[] }
      search_patients: {
        Args: {
          p_doctor_id?: string
          p_gender?: string
          p_page?: number
          p_page_size?: number
          p_query?: string
          p_sort_by?: string
          p_sort_dir?: string
          p_status?: Database["public"]["Enums"]["patient_status"]
        }
        Returns: {
          clinic_id: string
          created_at: string
          date_of_birth: string
          email: string
          first_name: string
          full_name: string
          gender: string
          id: string
          last_name: string
          last_visit_at: string
          patient_number: string
          phone: string
          photo_path: string
          preferred_dentist_id: string
          status: Database["public"]["Enums"]["patient_status"]
          tags: string[]
          total_count: number
          updated_at: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      alert_severity: "info" | "warning" | "critical"
      patient_file_type:
        | "photo"
        | "radiograph"
        | "pdf"
        | "consent_form"
        | "other"
      patient_status: "active" | "inactive" | "archived"
      staff_role:
        | "super_admin"
        | "admin"
        | "doctor"
        | "assistant"
        | "reception"
        | "accounting"
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
      alert_severity: ["info", "warning", "critical"],
      patient_file_type: [
        "photo",
        "radiograph",
        "pdf",
        "consent_form",
        "other",
      ],
      patient_status: ["active", "inactive", "archived"],
      staff_role: [
        "super_admin",
        "admin",
        "doctor",
        "assistant",
        "reception",
        "accounting",
      ],
    },
  },
} as const
