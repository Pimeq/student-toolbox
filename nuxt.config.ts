// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: "2025-07-15",
	devtools: { enabled: true },

	css: ["~/assets/css/main.css"],

	modules: [
		"@nuxt/eslint",
		"@nuxt/image",
		"@nuxt/ui",
		"@nuxtjs/supabase",
		//"@nuxtjs/tailwindcss",
	],
	supabase: {
		url: process.env.SUPABASE_URL,
		key: process.env.SUPABASE_KEY ?? process.env.SUPABASE_ANON_KEY,
		redirectOptions: {
			login: "/login",
			exclude: ["/register", "/login", "/"],
			callback: "/confirm",
		},
	},
})
