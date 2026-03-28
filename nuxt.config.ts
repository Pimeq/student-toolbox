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
		redirectOptions: {
			login: "/login",
			exclude: ["/register", "/login", "/"],
			callback: "/confirm",
		},
	},
})
