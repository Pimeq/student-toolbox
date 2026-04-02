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
		PostgrestVersion: "14.4"
	}
	graphql_public: {
		Tables: {
			[_ in never]: never
		}
		Views: {
			[_ in never]: never
		}
		Functions: {
			graphql: {
				Args: {
					extensions?: Json
					operationName?: string
					query?: string
					variables?: Json
				}
				Returns: Json
			}
		}
		Enums: {
			[_ in never]: never
		}
		CompositeTypes: {
			[_ in never]: never
		}
	}
	public: {
		Tables: {
			class_groups: {
				Row: {
					created_at: string
					faculty: number
					id: number
					name: string
				}
				Insert: {
					created_at?: string
					faculty: number
					id?: number
					name: string
				}
				Update: {
					created_at?: string
					faculty?: number
					id?: number
					name?: string
				}
				Relationships: []
			}
			classes: {
				Row: {
					course_id: string
					id: string
					semester: number | null
				}
				Insert: {
					course_id: string
					id: string
					semester?: number | null
				}
				Update: {
					course_id?: string
					id?: string
					semester?: number | null
				}
				Relationships: [
					{
						foreignKeyName: "classes_course_id_fkey"
						columns: ["course_id"]
						isOneToOne: false
						referencedRelation: "courses"
						referencedColumns: ["id"]
					},
					{
						foreignKeyName: "classes_id_fkey"
						columns: ["id"]
						isOneToOne: true
						referencedRelation: "groups"
						referencedColumns: ["id"]
					},
				]
			}
			courses: {
				Row: {
					faculty_id: string
					id: string
				}
				Insert: {
					faculty_id: string
					id: string
				}
				Update: {
					faculty_id?: string
					id?: string
				}
				Relationships: [
					{
						foreignKeyName: "courses_faculty_id_fkey"
						columns: ["faculty_id"]
						isOneToOne: false
						referencedRelation: "faculties"
						referencedColumns: ["id"]
					},
					{
						foreignKeyName: "courses_id_fkey"
						columns: ["id"]
						isOneToOne: true
						referencedRelation: "groups"
						referencedColumns: ["id"]
					},
				]
			}
			event_scopes: {
				Row: {
					class_group: number | null
					created_at: string
					department: number | null
					event_id: number
					faculty: number | null
					id: number
					university: number | null
				}
				Insert: {
					class_group?: number | null
					created_at?: string
					department?: number | null
					event_id: number
					faculty?: number | null
					id?: number
					university?: number | null
				}
				Update: {
					class_group?: number | null
					created_at?: string
					department?: number | null
					event_id?: number
					faculty?: number | null
					id?: number
					university?: number | null
				}
				Relationships: [
					{
						foreignKeyName: "event_scopes_class_group_fkey"
						columns: ["class_group"]
						isOneToOne: false
						referencedRelation: "class_groups"
						referencedColumns: ["id"]
					},
					{
						foreignKeyName: "event_scopes_event_id_fkey"
						columns: ["event_id"]
						isOneToOne: false
						referencedRelation: "events"
						referencedColumns: ["id"]
					},
				]
			}
			events: {
				Row: {
					created_at: string
					description: string | null
					ends_at: string | null
					id: number
					starts_at: string | null
					title: string
					updated_at: string
				}
				Insert: {
					created_at?: string
					description?: string | null
					ends_at?: string | null
					id?: number
					starts_at?: string | null
					title: string
					updated_at?: string
				}
				Update: {
					created_at?: string
					description?: string | null
					ends_at?: string | null
					id?: number
					starts_at?: string | null
					title?: string
					updated_at?: string
				}
				Relationships: []
			}
			faculties: {
				Row: {
					id: string
					university_id: string
				}
				Insert: {
					id: string
					university_id: string
				}
				Update: {
					id?: string
					university_id?: string
				}
				Relationships: [
					{
						foreignKeyName: "faculties_id_fkey"
						columns: ["id"]
						isOneToOne: true
						referencedRelation: "groups"
						referencedColumns: ["id"]
					},
					{
						foreignKeyName: "faculties_university_id_fkey"
						columns: ["university_id"]
						isOneToOne: false
						referencedRelation: "universities"
						referencedColumns: ["id"]
					},
				]
			}
			groups: {
				Row: {
					created_at: string
					id: string
					name: string
					type: Database["public"]["Enums"]["group_type"]
				}
				Insert: {
					created_at?: string
					id?: string
					name: string
					type: Database["public"]["Enums"]["group_type"]
				}
				Update: {
					created_at?: string
					id?: string
					name?: string
					type?: Database["public"]["Enums"]["group_type"]
				}
				Relationships: []
			}
			universities: {
				Row: {
					id: string
				}
				Insert: {
					id: string
				}
				Update: {
					id?: string
				}
				Relationships: [
					{
						foreignKeyName: "universities_id_fkey"
						columns: ["id"]
						isOneToOne: true
						referencedRelation: "groups"
						referencedColumns: ["id"]
					},
				]
			}
			user_memberships: {
				Row: {
					created_at: string
					group_id: string
					id: string
					role: Database["public"]["Enums"]["membership_role"]
					user_id: string
				}
				Insert: {
					created_at?: string
					group_id: string
					id?: string
					role?: Database["public"]["Enums"]["membership_role"]
					user_id: string
				}
				Update: {
					created_at?: string
					group_id?: string
					id?: string
					role?: Database["public"]["Enums"]["membership_role"]
					user_id?: string
				}
				Relationships: [
					{
						foreignKeyName: "user_memberships_group_id_fkey"
						columns: ["group_id"]
						isOneToOne: false
						referencedRelation: "groups"
						referencedColumns: ["id"]
					},
				]
			}
		}
		Views: {
			[_ in never]: never
		}
		Functions: {
			create_class: {
				Args: { p_course_id: string; p_name: string; p_semester: number }
				Returns: string
			}
			create_course: {
				Args: { p_faculty_id: string; p_name: string }
				Returns: string
			}
			create_faculty: {
				Args: { p_name: string; p_university_id: string }
				Returns: string
			}
			create_university: { Args: { p_name: string }; Returns: string }
			get_classes: {
				Args: { p_course_id: string }
				Returns: {
					id: string
					name: string
					semester: number
				}[]
			}
			get_courses: {
				Args: { p_faculty_id: string }
				Returns: {
					id: string
					name: string
				}[]
			}
			get_faculties: {
				Args: { p_university_id: string }
				Returns: {
					id: string
					name: string
				}[]
			}
			get_universities: {
				Args: never
				Returns: {
					id: string
					name: string
				}[]
			}
		}
		Enums: {
			group_type: "university" | "faculty" | "course" | "class"
			membership_role: "student" | "instructor" | "admin"
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
	TableName extends DefaultSchemaTableNameOrOptions extends (
		{
			schema: keyof DatabaseWithoutInternals
		}
	) ?
		keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
	:	never = never,
> =
	DefaultSchemaTableNameOrOptions extends (
		{
			schema: keyof DatabaseWithoutInternals
		}
	) ?
		(DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends (
			{
				Row: infer R
			}
		) ?
			R
		:	never
	: DefaultSchemaTableNameOrOptions extends (
		keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
	) ?
		(DefaultSchema["Tables"] &
			DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends (
			{
				Row: infer R
			}
		) ?
			R
		:	never
	:	never

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema["Tables"]
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends (
		{
			schema: keyof DatabaseWithoutInternals
		}
	) ?
		keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
	:	never = never,
> =
	DefaultSchemaTableNameOrOptions extends (
		{
			schema: keyof DatabaseWithoutInternals
		}
	) ?
		DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends (
			{
				Insert: infer I
			}
		) ?
			I
		:	never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ?
		DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends (
			{
				Insert: infer I
			}
		) ?
			I
		:	never
	:	never

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema["Tables"]
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends (
		{
			schema: keyof DatabaseWithoutInternals
		}
	) ?
		keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
	:	never = never,
> =
	DefaultSchemaTableNameOrOptions extends (
		{
			schema: keyof DatabaseWithoutInternals
		}
	) ?
		DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends (
			{
				Update: infer U
			}
		) ?
			U
		:	never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ?
		DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends (
			{
				Update: infer U
			}
		) ?
			U
		:	never
	:	never

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		| keyof DefaultSchema["Enums"]
		| { schema: keyof DatabaseWithoutInternals },
	EnumName extends DefaultSchemaEnumNameOrOptions extends (
		{
			schema: keyof DatabaseWithoutInternals
		}
	) ?
		keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
	:	never = never,
> =
	DefaultSchemaEnumNameOrOptions extends (
		{
			schema: keyof DatabaseWithoutInternals
		}
	) ?
		DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] ?
		DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
	:	never

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		| keyof DefaultSchema["CompositeTypes"]
		| { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends PublicCompositeTypeNameOrOptions extends (
		{
			schema: keyof DatabaseWithoutInternals
		}
	) ?
		keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
	:	never = never,
> =
	PublicCompositeTypeNameOrOptions extends (
		{
			schema: keyof DatabaseWithoutInternals
		}
	) ?
		DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends (
		keyof DefaultSchema["CompositeTypes"]
	) ?
		DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
	:	never

export const Constants = {
	graphql_public: {
		Enums: {},
	},
	public: {
		Enums: {
			group_type: ["university", "faculty", "course", "class"],
			membership_role: ["student", "instructor", "admin"],
		},
	},
} as const
