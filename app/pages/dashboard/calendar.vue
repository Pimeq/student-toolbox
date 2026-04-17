<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
})
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Kalendarz">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <div class="p-4">
      <h2 class="text-lg font-semibold mb-4">Kalendarz zajęć i wydarzeń</h2>
      <EventCalendar />
    </div>
  </UDashboardPanel>
</template>
