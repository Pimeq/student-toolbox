<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
	<div class="w-full min-h-screen flex flex-col">
		<UHeader>
			<template #left>
				<NuxtLink to="/" class="font-bold text-xl flex items-center gap-2">
					<UIcon name="i-lucide-graduation-cap" class="w-6 h-6 text-primary" />
					{{ t('brand') }}
				</NuxtLink>
			</template>

			<template #right>
				<LanguageSwitcher />
				<UColorModeButton />
				<UButton
					to="/login"
					color="primary"
					variant="ghost">
					{{ t('layout.login') }}
				</UButton>
				<UButton
					to="/register"
					color="primary">
					{{ t('layout.join') }}
				</UButton>
			</template>
		</UHeader>

		<UMain class="flex-1">
			<slot />
		</UMain>

		<USeparator />

		<UFooter>
			<template #left>
				<p class="text-sm text-gray-500">
					© {{ new Date().getFullYear() }} {{ t('brand') }}
				</p>
			</template>

			<template #right>
				<UButton
					to="https://github.com"
					target="_blank"
					icon="i-simple-icons-github"
					aria-label="GitHub"
					color="neutral"
					variant="ghost"
				/>
			</template>
		</UFooter>
	</div>
</template>
