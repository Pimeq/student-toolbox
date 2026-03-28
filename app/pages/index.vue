<script setup lang="ts">
	const supabase = useSupabaseClient()

	const user = await supabase.auth.getUser()
</script>

<template>
	{{ user }}
</template>
