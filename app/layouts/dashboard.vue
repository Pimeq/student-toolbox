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
	]

	const footerItems: NavigationMenuItem[] = [
		{
			label: "Settings",
			icon: "i-lucide-settings",
		},
	]

	defineExpose({
		handleToggle,
	})
</script>

<template>
	<NuxtLoadingIndicator />
	<UDashboardGroup>
		<UDashboardSidebar collapsible>
			<template #default="{ collapsed }">
				<UNavigationMenu
					:collapsed="collapsed"
					:items="items"
					orientation="vertical" />
			</template>

			<template #footer="{ collapsed }">
				<UNavigationMenu
					:collapsed="collapsed"
					:items="footerItems"
					orientation="vertical">
				</UNavigationMenu>
			</template>
		</UDashboardSidebar>
		<slot />
	</UDashboardGroup>
</template>
