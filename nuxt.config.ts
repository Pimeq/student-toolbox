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
		"@nuxtjs/i18n",
		//"@nuxtjs/tailwindcss",
	],

	i18n: {
		strategy: "no_prefix",
		defaultLocale: "pl",
		locales: [
			{ code: "pl", name: "Polski", language: "pl-PL", file: "pl.json" },
			{ code: "en", name: "English", language: "en-US", file: "en.json" },
		],
		detectBrowserLanguage: {
			useCookie: true,
			cookieKey: "i18n_redirected",
			redirectOn: "root",
		},
	},

	supabase: {
		url: process.env.SUPABASE_URL,
		key: process.env.SUPABASE_KEY ?? process.env.SUPABASE_ANON_KEY,
		redirectOptions: {
			login: "/login",
			exclude: ["/register", "/login", "/"],
			callback: "/confirm",
		},
	},

	runtimeConfig: {
		mistralApiKey: process.env.MISTRAL_API_KEY,
	},
	
	vite: {
		optimizeDeps: {
			include: [
				'@nuxt/ui > prosemirror-state',
				'@nuxt/ui > prosemirror-transform',
				'@nuxt/ui > prosemirror-model',
				'@nuxt/ui > prosemirror-view',
				'@nuxt/ui > prosemirror-gapcursor'
			]
		}
	}
})
