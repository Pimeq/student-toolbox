<script setup lang="ts">
	import { AuthError } from "@supabase/supabase-js"

	const supabase = useSupabaseClient()
	const router = useRouter()

	const email = ref("")
	const password = ref("")
	const confirmPassword = ref("")
	const loading = ref(false)

	const handleRegister = async () => {
		loading.value = true

		try {
			if (password.value != confirmPassword.value) {
				throw new AuthError("Passwords do not match")
			}

			const { data, error } = await supabase.auth.signUp({
				email: email.value,
				password: password.value,
			})

			if (error) throw error

			useToast().add({
				title: "Success",
				description: "Account created. Please check your email to confirm.",
				color: "success",
			})

			if (data.session) {
				await router.push("/dashboard")
				return
			}

			await router.push("/confirm")
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
					<h1 class="text-3xl font-bold">Create Account</h1>
					<p class="text-sm text-gray-500 mt-2">Sign up</p>
				</div>
			</template>

			<form
				@submit.prevent="handleRegister"
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
						placeholder="Create a password"
						size="lg"
						class="w-full"
						required />
				</UFormField>

				<UFormField
					label="Confirm password"
					class="w-full">
					<UInput
						v-model="confirmPassword"
						type="password"
						icon="i-heroicons-lock-closed"
						placeholder="Confirm password"
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
					Sign Up
				</UButton>
			</form>

			<template #footer>
				<div
					class="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
					<div class="flex items-center gap-1">
						<span>Already have an account?</span>
						<UButton
							to="/login"
							variant="link"
							color="secondary"
							class="px-0">
							Sign in
						</UButton>
					</div>
				</div>
			</template>
		</UCard>
	</div>
</template>
