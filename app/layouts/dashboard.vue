<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui"

const supabase = useSupabaseClient()
const router = useRouter()

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

const items: NavigationMenuItem[] = [
	{
		label: "Dashboard",
		icon: "i-lucide-house",
		to: "/dashboard",
	},
	{
		label: "Calendar",
		icon: "i-lucide-calendar",
		to: "/dashboard/calendar",
	},
	{
		label: "Notes",
		icon: "i-lucide-notebook",
		to: "/dashboard/notes",
	},
	{
		label: "Quizzes",
		icon: "i-lucide-lightbulb",
		to: "/dashboard/quiz",
	},
	{
		label: "Summaries",
		icon: "i-lucide-text",
		to: "/dashboard/summary",
	},
]

const footerItems: NavigationMenuItem[] = [
	{
		label: "Settings",
		icon: "i-lucide-settings",
		to: "/dashboard/settings",
	},
]

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
			label: "Admin",
			icon: "i-lucide-shield",
			to: "/dashboard/admin",
		},
	]
})

// Combine items with conditional admin section
const navItems = computed(() => [...items, ...adminItems.value])

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
				<UNavigationMenu :collapsed="collapsed" :items="footerItems" orientation="vertical">
				</UNavigationMenu>
			</template>
		</UDashboardSidebar>
		<slot />
	</UDashboardGroup>
</template>
