<script setup lang="ts">
	definePageMeta({
		layout: "dashboard",
	})
	const { t } = useI18n()
</script>

<template>
	<UDashboardPanel>
		<template #header>
			<UDashboardNavbar :title="t('nav.calendar')">
				<template #leading>
					<UDashboardSidebarCollapse />
				</template>
			</UDashboardNavbar>

			<EventCalendar />
		</template>
	</UDashboardPanel>
</template>
