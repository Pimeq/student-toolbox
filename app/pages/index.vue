<script setup lang="ts">
	const supabase = useSupabaseClient()

	const user = useSupabaseUser()
</script>

<template>
	{{ user }}
</template>
