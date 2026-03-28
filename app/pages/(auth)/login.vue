<script setup lang="ts">
	const supabase = useSupabaseClient()
	const router = useRouter()

	const email = ref("")
	const password = ref("")
	const loading = ref(false)

	const handleLogin = async () => {
		loading.value = true
		try {
			const { error } = await supabase.auth.signInWithPassword({
				email: email.value,
				password: password.value,
			})

			if (error) throw error

			await router.push("/")
		} catch (err: any) {
			useToast().add({
				title: "Error",
				description: err.message,
				color: "warning",
			})
		} finally {
			loading.value = false
		}
	}
</script>

<template>
	<div class="flex items-center justify-center min-h-screen">
		<UCard class="w-full max-w-md shadow-xl border-2 border-primary">
			<template #header>
				<div class="text-center">
					<h1 class="text-3xl font-bold">Welcome Back</h1>
					<p class="text-sm text-gray-500 mt-2">Sign in</p>
				</div>
			</template>

			<form
				@submit.prevent="handleLogin"
				class="space-y-2">
				<UFormField
					label="Email"
					class="w-full">
					<UInput
						v-model="email"
						type="email"
						icon="i-heroicons-envelope"
						placeholder="you@example.com"
						size="lg"
						class="w-full"
						required />
				</UFormField>

				<UFormField
					label="Password"
					class="w-full">
					<UInput
						v-model="password"
						type="password"
						icon="i-heroicons-lock-closed"
						placeholder="Enter your password"
						size="lg"
						class="w-full"
						required />
				</UFormField>

				<UButton
					type="submit"
					:loading="loading"
					color="primary"
					size="lg"
					class="w-full justify-center">
					<template #trailing>
						<UIcon name="i-heroicons-arrow-right-20-solid" />
					</template>
					Sign In
				</UButton>
			</form>

			<template #footer>
				<div
					class="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
					<div class="flex items-center gap-1">
						<span>Don't have an account?</span>
						<UButton
							to="/register"
							variant="ghost"
							class="px-0">
							Sign up
						</UButton>
					</div>
				</div>
			</template>
		</UCard>
	</div>
</template>
