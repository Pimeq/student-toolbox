<script setup lang="ts">
const { t } = useI18n()
const user = useSupabaseUser()

if (user.value) {
	await navigateTo("/dashboard")
}
</script>

<template>
	<div>
		<UPageHero :title="t('brand')"
			:description="t('landing.heroDescription')"
			:links="[{
				label: t('landing.loginCta'),
				to: '/login',
				trailingIcon: 'i-lucide-arrow-right',
				size: 'xl'
			}, {
				label: t('landing.registerCta'),
				to: '/register',
				size: 'xl',
				color: 'neutral',
				variant: 'subtle'
			}]" />

		<UPageSection id="features" :title="t('landing.featuresTitle')"
			:description="t('landing.featuresDescription')"
			:features="[{
				icon: 'i-lucide-file-text',
				title: t('landing.feature1Title'),
				description: t('landing.feature1Description')
			}, {
				icon: 'i-lucide-brain-circuit',
				title: t('landing.feature2Title'),
				description: t('landing.feature2Description')
			}, {
				icon: 'i-lucide-calendar',
				title: t('landing.feature3Title'),
				description: t('landing.feature3Description')
			}, {
				icon: 'i-lucide-users',
				title: t('landing.feature4Title'),
				description: t('landing.feature4Description')
			}]" />

		<UPageSection>
			<UPageCTA :title="t('landing.ctaTitle')"
				:description="t('landing.ctaDescription')"
				variant="subtle" :links="[{
					label: t('landing.ctaStart'),
					to: '/register',
					trailingIcon: 'i-lucide-arrow-right',
					color: 'neutral'
				}, {
					label: t('landing.ctaLogin'),
					to: '/login',
					color: 'neutral',
					variant: 'outline'
				}]" />
		</UPageSection>
	</div>
</template>
