<script setup lang="ts">
	const user = useSupabaseUser()

	if (user.value) {
		await navigateTo("/dashboard")
	}
</script>

<template>
	<div class="min-h-screen flex items-center justify-center px-4">
		<UCard class="w-full max-w-xl">
			<template #header>
				<div class="text-center space-y-2">
					<h1 class="text-3xl font-bold">Student Toolbox</h1>
					<p class="text-sm text-gray-500">
						Aplikacja do notatek, plików, streszczeń, quizów i kalendarza w Twoich grupach.
					</p>
				</div>
			</template>

			<div class="flex flex-col gap-3">
				<p class="text-sm text-gray-600">
					Zaloguj się, aby zobaczyć swoje grupy, wydarzenia i zasoby.
				</p>
				<div class="flex flex-col sm:flex-row gap-2">
					<UButton
						to="/login"
						color="primary"
						class="flex-1 justify-center">
						Zaloguj się
					</UButton>
					<UButton
						to="/register"
						variant="ghost"
						class="flex-1 justify-center">
						Zarejestruj się
					</UButton>
				</div>
			</div>
		</UCard>
	</div>
</template>
