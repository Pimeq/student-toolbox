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

	const links = [{
		label: 'Dashboard',
		icon: 'i-heroicons-home',
		to: '/dashboard'
	}, {
		label: 'Notatki (Tiles)',
		icon: 'i-heroicons-document-text',
		to: '/dashboard/notes'
	}]

	defineExpose({
		handleToggle,
	})
</script>

<template>
	<UDashboardGroup>
		<UDashboardSidebar :links="links" collapsible />
		<slot />
	</UDashboardGroup>
</template>
