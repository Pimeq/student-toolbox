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

			const { count, error } = await supabase
				.from("GroupMembers")
				.select("*", { count: "exact", head: true })
				.eq("user_id", user.value.sub)

			if (error) throw error
			return count ?? 0
		},
	)
</script>

<template>
	<NewUserModal :show="newUserGroupCount == 0" />
</template>
