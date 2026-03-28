<script setup lang="ts">
	const supabase = useSupabaseClient()
	const router = useRouter()

	const loading = ref(false)
	const logOut = async () => {
		loading.value = true
		await supabase.auth.signOut()
		await router.push("/")
	}

	
</script>

<template>
	<u-main>
		<u-header>
			<template #title>Sudent Toolbox</template>

			<template #toggle>
				<u-button
					@click="logOut"
					color="error"
					:disabled="loading"
					:loading="loading"
					>Log Out</u-button
				>
			</template>
		</u-header>
		<slot />
	</u-main>
</template>
