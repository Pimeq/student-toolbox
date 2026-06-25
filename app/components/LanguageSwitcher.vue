<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui"

const { locale, locales, setLocale, t } = useI18n()

const items = computed<DropdownMenuItem[]>(() =>
	locales.value.map((l) => ({
		label: l.name ?? l.code,
		icon: locale.value === l.code ? "i-lucide-check" : undefined,
		onSelect: () => setLocale(l.code),
	})),
)

const currentName = computed(
	() => locales.value.find((l) => l.code === locale.value)?.name ?? locale.value,
)
</script>

<template>
	<UDropdownMenu :items="items">
		<UButton
			color="neutral"
			variant="ghost"
			icon="i-lucide-languages"
			:label="currentName"
			:aria-label="t('common.language')"
		/>
	</UDropdownMenu>
</template>
