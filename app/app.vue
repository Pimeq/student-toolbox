<script setup lang="ts">
const { locale } = useI18n()
useHead({
  htmlAttrs: {
    lang: locale
  }
})
	const color = useColorMode()
</script>

<template>
	<UApp>
		<NuxtLayout>
			<NuxtPage />
		</NuxtLayout>
	</UApp>
</template>
