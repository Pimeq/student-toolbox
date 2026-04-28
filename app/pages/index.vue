<script setup lang="ts">
const user = useSupabaseUser()

if (user.value) {
	await navigateTo("/dashboard")
}
</script>

<template>
	<div>
		<UPageHero title="Student Toolbox"
			description="Aplikacja do notatek, plików, streszczeń, quizów i kalendarza w Twoich grupach. Zorganizuj swoje studia w jednym miejscu."
			:links="[{
				label: 'Zaloguj się',
				to: '/login',
				trailingIcon: 'i-lucide-arrow-right',
				size: 'xl'
			}, {
				label: 'Zarejestruj się',
				to: '/register',
				size: 'xl',
				color: 'neutral',
				variant: 'subtle'
			}]" />

		<UPageSection id="features" title="Wszystko czego potrzebujesz na studia"
			description="Rozpocznij naukę z solidnymi fundamentami. Aplikacja zawiera wszystkie niezbędne narzędzia do budowania bazy wiedzy ze swoją grupą."
			:features="[{
				icon: 'i-lucide-file-text',
				title: 'Notatki i Pliki',
				description: 'Współdziel notatki, prezentacje i materiały z zajęć z całą swoją grupą.'
			}, {
				icon: 'i-lucide-brain-circuit',
				title: 'Streszczenia i Quizy',
				description: 'Zarządzaj wiedzą poprzez automatyczne streszczenia i testuj się za pomocą interaktywnych quizów.'
			}, {
				icon: 'i-lucide-calendar',
				title: 'Kalendarz',
				description: 'Śledź ważne terminy, kolokwia, egzaminy i spotkania grupowe w zintegrowanym kalendarzu.'
			}, {
				icon: 'i-lucide-users',
				title: 'Grupy Studenckie',
				description: 'Organizuj się w grupy, wymieniaj materiałami i bądź na bieżąco z życiem Twojego kierunku.'
			}]" />

		<UPageSection>
			<UPageCTA title="Gotowy na lepsze oceny?"
				description="Dołącz do innych studentów i zorganizuj swoją naukę z nami. Rozpocznij darmowe korzystanie już dziś."
				variant="subtle" :links="[{
					label: 'Rozpocznij',
					to: '/register',
					trailingIcon: 'i-lucide-arrow-right',
					color: 'neutral'
				}, {
					label: 'Zaloguj się',
					to: '/login',
					color: 'neutral',
					variant: 'outline'
				}]" />
		</UPageSection>
	</div>
</template>
