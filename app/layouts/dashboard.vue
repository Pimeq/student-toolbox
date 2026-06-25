<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui"

const supabase = useSupabaseClient()
const router = useRouter()
const { t } = useI18n()

const loading = ref(false)
const logOut = async () => {
	loading.value = true
	await supabase.auth.signOut()
	await router.push("/")
}
const collapsed = ref(false)

const handleToggle = () => {
	collapsed.value = !collapsed.value
}

const items = computed<NavigationMenuItem[]>(() => [
	{
		label: t("nav.dashboard"),
		icon: "i-lucide-house",
		to: "/dashboard",
	},
	{
		label: t("nav.calendar"),
		icon: "i-lucide-calendar",
		to: "/dashboard/calendar",
	},
	{
		label: t("nav.files"),
		icon: "i-lucide-folder",
		to: "/dashboard/files",
	},
	{
		label: t("nav.notes"),
		icon: "i-lucide-notebook",
		to: "/dashboard/notes",
	},
	{
		label: t("nav.quizzes"),
		icon: "i-lucide-lightbulb",
		to: "/dashboard/quiz",
	},
	{
		label: t("nav.summaries"),
		icon: "i-lucide-text",
		to: "/dashboard/summary",
	},
])

const footerItems = computed<NavigationMenuItem[]>(() => [
	{
		label: t("nav.settings"),
		icon: "i-lucide-settings",
		to: "/dashboard/settings",
	},
])

const { isAdmin, fetchUserRoles, userRoles } = useUserRole()

// Fetch admin status on mount
onMounted(() => {
	fetchUserRoles()
})

// Compute admin navigation items based on user role
const adminItems = computed<NavigationMenuItem[]>(() => {
	const anyAdmin = Object.values(userRoles.value).includes('admin')
	if (!anyAdmin) return []
	return [
		{
			label: t("nav.admin"),
			icon: "i-lucide-shield",
			to: "/dashboard/admin",
		},
	]
})

// Combine items with conditional admin section
const navItems = computed(() => [...items.value, ...adminItems.value])

defineExpose({
	handleToggle,
})

// const releaseViewportLocks = () => {
// 	if (import.meta.server) return

// 	document.documentElement.classList.remove('overflow-hidden')
// 	document.body.classList.remove('overflow-hidden')
// 	document.documentElement.removeAttribute('data-scroll-locked')
// 	document.body.removeAttribute('data-scroll-locked')

// 	document.documentElement.style.overflow = ''
// 	document.body.style.overflow = ''
// 	document.body.style.position = ''
// 	document.body.style.width = ''
// 	document.body.style.paddingRight = ''
// 	document.body.style.top = ''
// 	document.body.style.left = ''
// 	document.body.style.right = ''
// 	document.body.style.touchAction = ''
// 	document.body.style.removeProperty('--scrollbar-width')
// }

// onMounted(() => {
// 	releaseViewportLocks()
// })

// watch(() => router.currentRoute.value, () => {
// 	releaseViewportLocks()
// })
</script>

<template>
	<NuxtLoadingIndicator />
	<UDashboardGroup>
		<UDashboardSidebar collapsible>
			<template #default="{ collapsed }">
				<UNavigationMenu :collapsed="collapsed" :items="navItems" orientation="vertical" />
			</template>

			<template #footer="{ collapsed }">
				<div class="flex flex-col gap-1">
					<UNavigationMenu :collapsed="collapsed" :items="footerItems" orientation="vertical" />
					<LanguageSwitcher v-if="!collapsed" />
				</div>
			</template>
		</UDashboardSidebar>
		<slot />
	</UDashboardGroup>
</template>
