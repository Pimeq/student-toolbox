<script setup lang="ts">
	const props = defineProps<{
		show: boolean
	}>()

	const open = ref(props.show)
	console.log(open.value)
</script>

<template>
	<UModal v-model:open="open">
		<template #content> Hello world! </template>
	</UModal>
</template>
