
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "body_weights": {
                  Row: {
                    "measured_on": string,"updated_at": string,"user_id": string,"weight_kg": number
                  }
                  ComputedFields: never
                  Insert: {
                    "measured_on": string,"updated_at"?: string,"user_id"?: string,"weight_kg": number
                  }
                  Update: {
                    "measured_on"?: string,"updated_at"?: string,"user_id"?: string,"weight_kg"?: number
                  }
                  Relationships: [
                    
                  ]
                },"exercise_notes": {
                  Row: {
                    "exercise_id": string,"note": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "exercise_id": string,"note": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "exercise_id"?: string,"note"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercise_notes_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    }
                  ]
                },"exercises": {
                  Row: {
                    "added_in_app": boolean,"created_at": string,"equipment": string,"hidden": boolean,"id": string,"image_path": string | null,"image_path_end": string | null,"instructions": (string)[] | null,"kind": Database["public"]['Enums']["exercise_kind"],"muscle_group": string,"name": string,"secondary_muscles": (string)[],"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "added_in_app"?: boolean,"created_at"?: string,"equipment": string,"hidden"?: boolean,"id"?: string,"image_path"?: string | null,"image_path_end"?: string | null,"instructions"?: (string)[] | null,"kind"?: Database["public"]['Enums']["exercise_kind"],"muscle_group": string,"name": string,"secondary_muscles"?: (string)[],"user_id"?: string | null
                  }
                  Update: {
                    "added_in_app"?: boolean,"created_at"?: string,"equipment"?: string,"hidden"?: boolean,"id"?: string,"image_path"?: string | null,"image_path_end"?: string | null,"instructions"?: (string)[] | null,"kind"?: Database["public"]['Enums']["exercise_kind"],"muscle_group"?: string,"name"?: string,"secondary_muscles"?: (string)[],"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "unit": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "unit"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "unit"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"p256dh": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"p256dh": string,"user_id"?: string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"p256dh"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"rest_alerts": {
                  Row: {
                    "fire_at": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "fire_at": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "fire_at"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"routine_exercises": {
                  Row: {
                    "exercise_id": string,"id": string,"position": number,"rest_seconds": number,"routine_id": string,"target_sets": number
                  }
                  ComputedFields: never
                  Insert: {
                    "exercise_id": string,"id"?: string,"position": number,"rest_seconds"?: number,"routine_id": string,"target_sets"?: number
                  }
                  Update: {
                    "exercise_id"?: string,"id"?: string,"position"?: number,"rest_seconds"?: number,"routine_id"?: string,"target_sets"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "routine_exercises_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "routine_exercises_routine_id_fkey"
      columns: ["routine_id"]
isOneToOne: false
      referencedRelation: "routines"
      referencedColumns: ["id"]
    }
                  ]
                },"routine_folders": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"routines": {
                  Row: {
                    "created_at": string,"folder_id": string | null,"id": string,"name": string,"notes": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"folder_id"?: string | null,"id"?: string,"name": string,"notes"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"folder_id"?: string | null,"id"?: string,"name"?: string,"notes"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "routines_folder_id_fkey"
      columns: ["folder_id"]
isOneToOne: false
      referencedRelation: "routine_folders"
      referencedColumns: ["id"]
    }
                  ]
                },"sets": {
                  Row: {
                    "duration_s": number | null,"id": string,"position": number,"reps": number | null,"rpe": number | null,"set_type": Database["public"]['Enums']["set_type"],"weight_kg": number | null,"workout_exercise_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "duration_s"?: number | null,"id"?: string,"position": number,"reps"?: number | null,"rpe"?: number | null,"set_type"?: Database["public"]['Enums']["set_type"],"weight_kg"?: number | null,"workout_exercise_id": string
                  }
                  Update: {
                    "duration_s"?: number | null,"id"?: string,"position"?: number,"reps"?: number | null,"rpe"?: number | null,"set_type"?: Database["public"]['Enums']["set_type"],"weight_kg"?: number | null,"workout_exercise_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sets_workout_exercise_id_fkey"
      columns: ["workout_exercise_id"]
isOneToOne: false
      referencedRelation: "workout_exercises"
      referencedColumns: ["id"]
    }
                  ]
                },"workout_exercises": {
                  Row: {
                    "exercise_id": string,"id": string,"notes": string | null,"position": number,"workout_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "exercise_id": string,"id"?: string,"notes"?: string | null,"position": number,"workout_id": string
                  }
                  Update: {
                    "exercise_id"?: string,"id"?: string,"notes"?: string | null,"position"?: number,"workout_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_exercises_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workout_exercises_workout_id_fkey"
      columns: ["workout_id"]
isOneToOne: false
      referencedRelation: "workouts"
      referencedColumns: ["id"]
    }
                  ]
                },"workouts": {
                  Row: {
                    "ended_at": string,"id": string,"name": string,"notes": string | null,"routine_id": string | null,"started_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ended_at": string,"id": string,"name": string,"notes"?: string | null,"routine_id"?: string | null,"started_at": string,"user_id"?: string
                  }
                  Update: {
                    "ended_at"?: string,"id"?: string,"name"?: string,"notes"?: string | null,"routine_id"?: string | null,"started_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workouts_routine_id_fkey"
      columns: ["routine_id"]
isOneToOne: false
      referencedRelation: "routines"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "can_use_exercise":
{ Args: { "p_exercise_id": string }; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"previous_sets":
{ Args: { "p_exclude_workout"?: string,"p_exercise_ids": (string)[] }; Returns: {
              "duration_s": number,"exercise_id": string,"position": number,"reps": number,"rpe": number,"set_type": Database["public"]['Enums']["set_type"],"weight_kg": number
            }[]
                           },
"save_routine":
{ Args: { "p": Json }; Returns: string
                           },
"save_workout":
{ Args: { "p": Json }; Returns: string
                           },
"workout_prs":
{ Args: { "p_workout_ids": (string)[] }; Returns: {
              "e1rm_pr": boolean,"set_id": string,"weight_pr": boolean,"workout_id": string
            }[]
                           }
          }
          Enums: {
            "exercise_kind": "weight_reps"|"bodyweight_reps"|"duration","set_type": "warmup"|"normal"|"drop"|"failure"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "exercise_kind": ["weight_reps", "bodyweight_reps", "duration"],"set_type": ["warmup", "normal", "drop", "failure"]
          }
        }
} as const
