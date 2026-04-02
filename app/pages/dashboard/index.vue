<script setup lang="ts">
	const supabase = useSupabaseClient()
	const user = useSupabaseUser()
	//TODO:
	//fetch user groups, if not any -> show signup dialog
	//some side panel with notes events and whatnot

	definePageMeta({
		layout: "dashboard",
	})

	const { data: newUserGroupCount } = await useAsyncData(
		"newUser",
		async () => {
			if (!user.value) return 0

			const { data, error } = await supabase
				.from("user_memberships")
				.select("*")
				.eq("user_id", user.value?.sub)
			if (error) throw error

			return data.length ?? 0
		},
	)
</script>

<template>
	<NewUserModal :show="newUserGroupCount == 0" />
	<UDashboardPanel>
		<template #header>
			<UDashboardNavbar title="Dashboard">
				<template #leading>
					<UDashboardSidebarCollapse />
				</template>
			</UDashboardNavbar>
		</template>
	</UDashboardPanel>
</template>
