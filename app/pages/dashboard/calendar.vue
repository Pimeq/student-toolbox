<script setup lang="ts">
	definePageMeta({
		layout: "dashboard",
	})
</script>

<template>
	<UDashboardPanel>
		<template #header>
			<UDashboardNavbar title="Dashboard">
				<template #leading>
					<UDashboardSidebarCollapse />
				</template>
			</UDashboardNavbar>

			<EventCalendar />
		</template>
	</UDashboardPanel>
</template>
