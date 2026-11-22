
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
            "announcements": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"event_id": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string,"body": string,"created_at"?: string,"event_id": string,"id"?: string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"event_id"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcements_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "allow_plus_ones": boolean,"cancelled_at": string | null,"cover_url": string | null,"created_at": string,"description": string | null,"draft_id": string | null,"ends_at": string | null,"id": string,"location": string | null,"organizer_id": string,"show_counts": boolean,"show_guest_list": boolean,"slug": string,"starts_at": string,"theme": string,"title": string,"updated_at": string,"visibility": Database["public"]['Enums']["event_visibility"]
                  }
                  ComputedFields: never
                  Insert: {
                    "allow_plus_ones"?: boolean,"cancelled_at"?: string | null,"cover_url"?: string | null,"created_at"?: string,"description"?: string | null,"draft_id"?: string | null,"ends_at"?: string | null,"id"?: string,"location"?: string | null,"organizer_id"?: string,"show_counts"?: boolean,"show_guest_list"?: boolean,"slug"?: string,"starts_at": string,"theme"?: string,"title": string,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["event_visibility"]
                  }
                  Update: {
                    "allow_plus_ones"?: boolean,"cancelled_at"?: string | null,"cover_url"?: string | null,"created_at"?: string,"description"?: string | null,"draft_id"?: string | null,"ends_at"?: string | null,"id"?: string,"location"?: string | null,"organizer_id"?: string,"show_counts"?: boolean,"show_guest_list"?: boolean,"slug"?: string,"starts_at"?: string,"theme"?: string,"title"?: string,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["event_visibility"]
                  }
                  Relationships: [
                    
                  ]
                },"friendships": {
                  Row: {
                    "addressee_id": string,"created_at": string,"requester_id": string,"status": Database["public"]['Enums']["friendship_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "addressee_id": string,"created_at"?: string,"requester_id": string,"status"?: Database["public"]['Enums']["friendship_status"],"updated_at"?: string
                  }
                  Update: {
                    "addressee_id"?: string,"created_at"?: string,"requester_id"?: string,"status"?: Database["public"]['Enums']["friendship_status"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"invitees": {
                  Row: {
                    "created_at": string,"display_name": string,"event_id": string,"id": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"event_id": string,"id"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"event_id"?: string,"id"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitees_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"merge_tokens": {
                  Row: {
                    "anon_user_id": string,"expires_at": string,"token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anon_user_id": string,"expires_at"?: string,"token"?: string
                  }
                  Update: {
                    "anon_user_id"?: string,"expires_at"?: string,"token"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"friend_code": string,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"friend_code"?: string,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"friend_code"?: string,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"rsvps": {
                  Row: {
                    "created_at": string,"display_name": string,"event_id": string,"plus_ones": number,"status": Database["public"]['Enums']["rsvp_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"event_id": string,"plus_ones"?: number,"status": Database["public"]['Enums']["rsvp_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"event_id"?: string,"plus_ones"?: number,"status"?: Database["public"]['Enums']["rsvp_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rsvps_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_friend":
{ Args: { "p_user": string }; Returns: boolean
                           },
"add_friend_by_code":
{ Args: { "p_code": string }; Returns: string
                           },
"add_invitees":
{ Args: { "p_names": (string)[],"p_slug": string }; Returns: number
                           },
"are_friends":
{ Args: { "p_a": string,"p_b": string }; Returns: boolean
                           },
"create_merge_token":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"friend_state":
{ Args: { "p_other": string }; Returns: string
                           },
"friend_suggestions":
{ Args: Record<PropertyKey, never>; Returns: {
              "display_name": string,"shared_events": number,"user_id": string
            }[]
                           },
"generate_slug":
{ Args: { "len"?: number }; Returns: string
                           },
"get_event":
{ Args: { "p_slug": string }; Returns: Json
                           },
"get_event_announcements":
{ Args: { "p_slug": string }; Returns: {
              "body": string,"created_at": string,"id": string
            }[]
                           },
"get_event_guests":
{ Args: { "p_slug": string }; Returns: {
              "display_name": string,"is_friend": boolean,"is_me": boolean,"plus_ones": number,"status": Database["public"]['Enums']["rsvp_status"],"updated_at": string
            }[]
                           },
"get_event_invitees":
{ Args: { "p_slug": string }; Returns: {
              "display_name": string,"id": string,"is_me": boolean,"status": Database["public"]['Enums']["rsvp_status"]
            }[]
                           },
"get_friend_link":
{ Args: { "p_code": string }; Returns: Json
                           },
"get_invitable_friends":
{ Args: { "p_slug": string }; Returns: {
              "display_name": string,"user_id": string
            }[]
                           },
"invite_friends":
{ Args: { "p_slug": string,"p_user_ids": (string)[] }; Returns: number
                           },
"is_event_organizer":
{ Args: { "p_event_id": string }; Returns: boolean
                           },
"is_registered":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_registered_user":
{ Args: { "p_user": string }; Returns: boolean
                           },
"list_friends":
{ Args: Record<PropertyKey, never>; Returns: {
              "display_name": string,"state": string,"user_id": string
            }[]
                           },
"merge_anonymous_user":
{ Args: { "p_token": string }; Returns: number
                           },
"remove_friend":
{ Args: { "p_user": string }; Returns: boolean
                           },
"request_friend":
{ Args: { "p_user": string }; Returns: string
                           },
"rsvp":
{ Args: { "p_display_name": string,"p_invitee_id"?: string,"p_plus_ones"?: number,"p_slug": string,"p_status": Database["public"]['Enums']["rsvp_status"] }; Returns: undefined
                           }
          }
          Enums: {
            "event_visibility": "link"|"public","friendship_status": "pending"|"accepted","rsvp_status": "going"|"maybe"|"declined"
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
            "event_visibility": ["link", "public"],"friendship_status": ["pending", "accepted"],"rsvp_status": ["going", "maybe", "declined"]
          }
        }
} as const
