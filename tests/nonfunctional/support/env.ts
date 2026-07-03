import { config as loadDotenv } from "dotenv"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../../app/types/database.types"

loadDotenv()

export const BUDGETS = {
	CRUD_LATENCY_MS: 300,
	AI_TTFT_MS: 15_000,
} as const

export const ENV = {
	supabaseUrl: process.env.SUPABASE_URL ?? "",
	supabaseAnonKey: process.env.SUPABASE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "",
	mistralApiKey: process.env.MISTRAL_API_KEY ?? "",
	baseUrl: process.env.TEST_BASE_URL ?? "http://localhost:3000",
	user: {
		email: process.env.TEST_USER_EMAIL ?? "",
		password: process.env.TEST_USER_PASSWORD ?? "",
	},
	user2: {
		email: process.env.TEST_USER2_EMAIL ?? "",
		password: process.env.TEST_USER2_PASSWORD ?? "",
	},
	writableGroupId: process.env.TEST_GROUP_ID ?? "",
}

export const hasSupabaseCreds = Boolean(ENV.supabaseUrl && ENV.supabaseAnonKey)
export const hasPrimaryUser = Boolean(ENV.user.email && ENV.user.password)
export const hasSecondUser = Boolean(ENV.user2.email && ENV.user2.password)

export function anonClient(): SupabaseClient<Database> {
	return createClient<Database>(ENV.supabaseUrl, ENV.supabaseAnonKey, {
		auth: { persistSession: false, autoRefreshToken: false },
	})
}

export interface SignedInClient {
	supabase: SupabaseClient<Database>
	userId: string
	accessToken: string
}

export async function signIn(email: string, password: string): Promise<SignedInClient> {
	const supabase = createClient<Database>(ENV.supabaseUrl, ENV.supabaseAnonKey, {
		auth: { persistSession: false, autoRefreshToken: false },
	})

	const { data, error } = await supabase.auth.signInWithPassword({ email, password })
	if (error || !data.user || !data.session) {
		throw new Error(`Logowanie konta testowego (${email}) nie powiodło się: ${error?.message ?? "brak sesji"}`)
	}

	return { supabase, userId: data.user.id, accessToken: data.session.access_token }
}

export async function resolveWritableGroupId(client: SignedInClient): Promise<string | null> {
	if (ENV.writableGroupId) return ENV.writableGroupId

	const { data, error } = await client.supabase
		.from("user_memberships")
		.select("group_id, group:groups(type)")
		.eq("user_id", client.userId)

	if (error || !data?.length) return null

	const personal = data.find((row) => (row.group as { type?: string } | null)?.type === "personal")
	return personal?.group_id ?? data[0]?.group_id ?? null
}

export async function serverReachable(): Promise<boolean> {
	try {
		const controller = new AbortController()
		const timer = setTimeout(() => controller.abort(), 2_000)
		await fetch(ENV.baseUrl, { signal: controller.signal })
		clearTimeout(timer)
		return true
	} catch {
		return false
	}
}
