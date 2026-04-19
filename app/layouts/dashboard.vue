<script setup lang="ts">
	const route = useRoute()
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

	const releaseViewportLocks = () => {
		if (import.meta.server) return

		document.documentElement.classList.remove('overflow-hidden')
		document.body.classList.remove('overflow-hidden')
		document.documentElement.removeAttribute('data-scroll-locked')
		document.body.removeAttribute('data-scroll-locked')

		document.documentElement.style.overflow = ''
		document.body.style.overflow = ''
		document.body.style.position = ''
		document.body.style.width = ''
		document.body.style.paddingRight = ''
		document.body.style.top = ''
		document.body.style.left = ''
		document.body.style.right = ''
		document.body.style.touchAction = ''
		document.body.style.removeProperty('--scrollbar-width')
	}

	onMounted(() => {
		releaseViewportLocks()
	})

	watch(() => route.fullPath, () => {
		releaseViewportLocks()
	})
</script>

<template>
	<UDashboardGroup>
		<UDashboardSidebar :links="links" collapsible />
		<slot />
	</UDashboardGroup>
</template>
