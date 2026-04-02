<script setup lang="ts">
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

	defineExpose({
		handleToggle,
	})
</script>

<template>
	<UDashboardGroup>
		<UDashboardSidebar collapsible />
		<slot />
	</UDashboardGroup>
</template>
