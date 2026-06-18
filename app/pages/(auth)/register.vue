<script setup lang="ts">
	import { AuthError } from "@supabase/supabase-js"

	const { t } = useI18n()
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
				throw new AuthError(t("register.passwordsMismatch"))
			}

			const { data, error } = await supabase.auth.signUp({
				email: email.value,
				password: password.value,
			})

			if (error) throw error

			useToast().add({
				title: t("common.success"),
				description: t("register.accountCreated"),
				color: "success",
			})

			if (data.session) {
				await router.push("/dashboard")
				return
			}

			await router.push("/confirm")
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
					<h1 class="text-3xl font-bold">{{ t('register.title') }}</h1>
					<p class="text-sm text-gray-500 mt-2">{{ t('register.subtitle') }}</p>
				</div>
			</template>

			<form
				@submit.prevent="handleRegister"
				class="space-y-2">
				<UFormField
					:label="t('register.email')"
					class="w-full">
					<UInput
						v-model="email"
						type="email"
						icon="i-heroicons-envelope"
						:placeholder="t('register.emailPlaceholder')"
						size="lg"
						class="w-full"
						required />
				</UFormField>

				<UFormField
					:label="t('register.password')"
					class="w-full">
					<UInput
						v-model="password"
						type="password"
						icon="i-heroicons-lock-closed"
						:placeholder="t('register.passwordPlaceholder')"
						size="lg"
						class="w-full"
						required />
				</UFormField>

				<UFormField
					:label="t('register.confirmPassword')"
					class="w-full">
					<UInput
						v-model="confirmPassword"
						type="password"
						icon="i-heroicons-lock-closed"
						:placeholder="t('register.confirmPasswordPlaceholder')"
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
					{{ t('register.submit') }}
				</UButton>
			</form>

			<template #footer>
				<div
					class="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
					<div class="flex items-center gap-1">
						<span>{{ t('register.haveAccount') }}</span>
						<UButton
							to="/login"
							variant="link"
							color="secondary"
							class="px-0">
							{{ t('register.signIn') }}
						</UButton>
					</div>
				</div>
			</template>
		</UCard>
	</div>
</template>
