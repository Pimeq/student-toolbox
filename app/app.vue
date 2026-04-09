<script setup lang="ts">
useHead({
  htmlAttrs: {
    lang: 'pl'
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
