<script setup lang="ts">
	const supabase = useSupabaseClient()
	const user = useSupabaseUser()
	
	// TODO: podpiąć kalendarz pod prawdziwe dane z Supabase
	//TODO:
	//fetch user groups, if not any -> show signup dialog
	//some side panel with notes events and whatnot

	definePageMeta({
		layout: "dashboard",
	})

	const { data: userGroups } = await useAsyncData(
		"userGroups",
		async () => {
			if (!user.value) return []

			const { data, error } = await supabase
				.from("user_memberships")
				.select("*")
				.eq("user_id", user.value.sub)
			if (error) throw error
			return data ?? []
		},
		{
			default: () => [],
		},
	)

	const { data: res } = await useAsyncData("bucket", async () => {
		const { data } = await supabase.storage.from("files").list("generic")
		return data
	})
</script>

<template>
	<NewUserModal :show="userGroups.length == 0" />
	<UDashboardPanel>
		<template #header>
			<UDashboardNavbar title="Dashboard">
				<template #leading>
					<UDashboardSidebarCollapse />
				</template>
			</UDashboardNavbar>
		</template>

		<div class="p-4">
			<UButton to="/calendar" color="primary" variant="solid">
				Otwórz kalendarz
			</UButton>
		</div>
	</UDashboardPanel>
</template>
