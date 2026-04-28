<script setup lang="ts">
import { useNotes } from '~/composables/useNotes'

definePageMeta({
    layout: 'dashboard'
})

const { notes, fetchNotes } = useNotes()

const { pending: loading, error } = await useAsyncData('quiz-notes-list', async () => {
    await fetchNotes()
    return notes.value
})
</script>

<template>
    <UDashboardPanel>
        <UDashboardNavbar title="Twoje Quizy" />

        <div class="flex-1 min-h-0 overflow-y-auto p-6 space-y-8">
            <header>
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Generator Quizów AI</h2>
                <p class="text-gray-500 mt-1">Wybierz jedną ze swoich notatek, aby sprawdzić swoją wiedzę lub
                    wygenerować nowy test.</p>
            </header>

            <div v-if="loading" class="flex flex-col items-center justify-center py-12 space-y-4">
                <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary" />
                <p class="text-gray-500">Pobieranie Twoich notatek...</p>
            </div>

            <UAlert v-else-if="error" color="error" variant="soft" icon="i-heroicons-exclamation-circle"
                title="Wystąpił problem" description="Nie udało się załadować notatek. Spróbuj odświeżyć stronę." />

            <div v-else-if="notes.length === 0"
                class="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
                <UIcon name="i-heroicons-document-minus" class="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 class="text-lg font-medium text-gray-900 dark:text-white">Brak notatek</h3>
                <p class="text-gray-500">Dodaj najpierw jakąś notatkę, aby móc wygenerować z niej quiz.</p>
                <UButton to="/dashboard/notes" color="primary" variant="ghost" class="mt-4">
                    Przejdź do notatek
                </UButton>
            </div>

            <div v-else class="grid grid-cols-1 gap-4">
                <div v-for="note in notes" :key="note.id"
                    class="group p-5 border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 hover:border-primary-500/50 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div class="flex items-center gap-4">
                        <div
                            class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 transition-colors">
                            <UIcon name="i-heroicons-document-text"
                                class="w-6 h-6 text-gray-400 group-hover:text-primary" />
                        </div>
                        <div>
                            <h3 class="font-bold text-lg text-gray-900 dark:text-white">{{ note.title || 'Bez tytułu' }}
                            </h3>
                            <p class="text-sm text-gray-500">Kliknij przycisk, aby zarządzać quizami dla tej treści.</p>
                        </div>
                    </div>

                    <UButton color="primary" variant="soft" :to="`/dashboard/quiz/${note.id}`"
                        icon="i-heroicons-sparkles" size="lg" class="w-full sm:w-auto">
                        Generuj / Rozwiąż Quiz
                    </UButton>
                </div>
            </div>
        </div>
    </UDashboardPanel>
</template>