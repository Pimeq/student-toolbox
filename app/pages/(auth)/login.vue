<script setup lang="ts">
	const { t } = useI18n()
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

			await router.push("/dashboard")
		} catch (err: any) {
			useToast().add({
				title: t("common.error"),
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
					<h1 class="text-3xl font-bold">{{ t('login.title') }}</h1>
					<p class="text-sm text-gray-500 mt-2">{{ t('login.subtitle') }}</p>
				</div>
			</template>

			<form
				@submit.prevent="handleLogin"
				class="space-y-2">
				<UFormField
					:label="t('login.email')"
					class="w-full">
					<UInput
						v-model="email"
						type="email"
						icon="i-heroicons-envelope"
						:placeholder="t('login.emailPlaceholder')"
						size="lg"
						class="w-full"
						required />
				</UFormField>

				<UFormField
					:label="t('login.password')"
					class="w-full">
					<UInput
						v-model="password"
						type="password"
						icon="i-heroicons-lock-closed"
						:placeholder="t('login.passwordPlaceholder')"
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
					{{ t('login.submit') }}
				</UButton>
			</form>

			<template #footer>
				<div
					class="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
					<div class="flex items-center gap-1">
						<span>{{ t('login.noAccount') }}</span>
						<UButton
							to="/register"
							variant="ghost"
							class="px-0">
							{{ t('login.signUp') }}
						</UButton>
					</div>
				</div>
			</template>
		</UCard>
	</div>
</template>
