<script setup lang="ts">
	const supabase = useSupabaseClient()
	const router = useRouter()

	const loading = ref(false)
	const logOut = async () => {
		await supabase.auth.signOut()
		await router.push("/")
	}
</script>

<template>
	<div class="w-full h-full">
		<div class="h-10 w-full bg-accented flex justify-end">
			<UButton
				:loading="loading"
				:disabled="loading"
				@click="logOut"
				color="error"
				class="m-1 cursor-pointer">
				Log Out
			</UButton>
		</div>
		<slot />
	</div>
</template>
