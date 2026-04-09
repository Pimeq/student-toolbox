<template>
	<div class="w-full min-h-screen flex flex-col">
		<UHeader>
			<template #left>
				<NuxtLink to="/" class="font-bold text-xl flex items-center gap-2">
					<UIcon name="i-lucide-graduation-cap" class="w-6 h-6 text-primary" />
					Student Toolbox
				</NuxtLink>
			</template>

			<template #right>
				<UColorModeButton />
				<UButton
					to="/login"
					color="primary"
					variant="ghost">
					Zaloguj
				</UButton>
				<UButton
					to="/register"
					color="primary">
					Dołącz
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
					© {{ new Date().getFullYear() }} Student Toolbox
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
