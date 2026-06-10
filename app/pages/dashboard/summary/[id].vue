<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNotes } from '~/composables/useNotes'
import { useSummaryGeneration, type SummaryDetail } from '~/composables/useSummaryGeneration'
import { useSupabaseClient } from '#imports'

definePageMeta({
    layout: 'dashboard'
})

const route = useRoute()
const router = useRouter()
const supabase = useSupabaseClient()
const { getNoteContent, fetchNotes, notes } = useNotes()

const noteId = route.params.id as string

const detailLevel = ref<SummaryDetail>('medium')
const detailOptions = [
    { label: 'Zwięzłe', value: 'short' },
    { label: 'Standardowe', value: 'medium' },
    { label: 'Szczegółowe', value: 'detailed' }
]

const currentNote = computed(() => notes.value.find(n => n.id === noteId))
const noteTitle = computed(() => currentNote.value?.title || 'Nieznana notatka')

const {
    summary, summaryLoading, errorMsg, generateSummary, loadSummary
} = useSummaryGeneration()

const { data: fileText, pending: notePending, error: noteError } = await useAsyncData(
    `note-content-${noteId}`,
    async () => {
        if (!noteId) throw new Error("Nie wybrano notatki.")
        let content = await getNoteContent(noteId)
        if (!content) {
            await fetchNotes()
            content = await getNoteContent(noteId)
        }
        if (!content) throw new Error("Nie udało się załadować treści notatki.")
        return content
    }
)

const { data: savedSummaries, pending: summariesLoading, refresh: refreshSummaries } = await useAsyncData(
    `saved-summaries-${noteId}`,
    async () => {
        const { data, error } = await supabase
            .from('files')
            .select('*')
            .eq('file_type', 'summary')
            .ilike('name', `${noteId}:::%`)
            .order('created_at', { ascending: false })

        if (error) throw error
        return data || []
    }
)

const handleGenerate = async () => {
    if (fileText.value) {
        try {
            await generateSummary(fileText.value, detailLevel.value, noteId, noteTitle.value)
            await refreshSummaries()
        } catch (e) {
            console.error("Wystąpił błąd:", e)
        }
    } else {
        errorMsg.value = "Nie można załadować treści notatki."
    }
}

const loadExistingSummary = async (savedSummary: any) => {
    await loadSummary(savedSummary)
    window.scrollTo({ top: 0, behavior: 'smooth' })
}

const getDisplayName = (dbName: string) => {
    const parts = dbName.split(':::')
    return parts.length > 1 ? parts[parts.length - 1] : dbName
}
</script>

<template>
    <div class="flex-1 w-full h-full overflow-y-auto bg-gray-50/50 dark:bg-gray-900/20">
        <UContainer class="py-8 space-y-8 max-w-4xl">

            <UCard v-if="!summary">
                <template #header>
                    <div class="flex items-center justify-between">
                        <h2 class="text-2xl font-bold flex items-center gap-2">
                            <UIcon name="i-heroicons-sparkles" class="text-primary" />
                            AI Generator Streszczeń
                        </h2>
                        <UButton color="neutral" variant="ghost" icon="i-heroicons-arrow-left"
                            @click="router.push('/dashboard/summary')">Wróć</UButton>
                    </div>
                </template>

                <div class="flex flex-col items-center justify-center my-10 space-y-6">
                    <div v-if="notePending || summaryLoading" class="text-gray-500 flex items-center gap-2">
                        <UIcon name="i-heroicons-arrow-path" class="animate-spin w-5 h-5" />
                        Przetwarzanie...
                    </div>

                    <UAlert v-else-if="noteError" color="error" icon="i-heroicons-exclamation-triangle"
                        :title="noteError.message" />

                    <template v-else-if="fileText">
                        <div class="text-center space-y-2">
                            <h3 class="text-xl font-medium">Wygeneruj nowe streszczenie</h3>
                            <p class="text-gray-500 max-w-md mx-auto">Sztuczna inteligencja przeanalizuje Twoją notatkę
                                i przygotuje jej zwięzłe podsumowanie.</p>
                        </div>

                        <div class="flex flex-col sm:flex-row gap-4 items-center justify-center w-full max-w-sm mt-4">
                            <UFormField label="Poziom szczegółowości" class="w-full flex-1">
                                <USelect v-model="detailLevel" :items="detailOptions" value-key="value"
                                    icon="i-heroicons-adjustments-horizontal" />
                            </UFormField>

                            <UButton @click="handleGenerate" :loading="summaryLoading" :disabled="!fileText"
                                icon="i-heroicons-cpu-chip" size="lg" class="mt-6 w-full sm:w-auto">
                                Generuj
                            </UButton>
                        </div>
                    </template>

                    <UAlert v-if="errorMsg" color="error" icon="i-heroicons-exclamation-triangle" :title="errorMsg"
                        class="w-full max-w-md mt-4" />
                </div>
            </UCard>

            <UCard v-if="!summary && savedSummaries && savedSummaries.length > 0"
                class="border-t-4 border-primary-500">
                <template #header>
                    <div class="flex items-center gap-2">
                        <UIcon name="i-heroicons-clock" class="text-primary w-6 h-6" />
                        <h3 class="text-xl font-bold">Zapisane streszczenia dla tej notatki</h3>
                    </div>
                </template>

                <div v-if="summariesLoading" class="p-4 text-center text-gray-500">
                    Ładowanie listy streszczeń...
                </div>

                <div v-else class="grid gap-3">
                    <div v-for="saved in savedSummaries" :key="saved.id"
                        class="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl hover:border-primary-500 transition-colors group">
                        <div class="flex items-center gap-3">
                            <div class="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
                                <UIcon name="i-heroicons-document-text" class="text-primary w-5 h-5" />
                            </div>
                            <div class="flex flex-col">
                                <span class="font-semibold">{{ getDisplayName(saved.name) }}</span>
                                <span class="text-xs text-gray-500">{{ new Date(saved.created_at).toLocaleDateString()
                                    }}</span>
                            </div>
                        </div>
                        <UButton color="primary" variant="subtle" icon="i-heroicons-eye"
                            @click="loadExistingSummary(saved)">
                            Otwórz
                        </UButton>
                    </div>
                </div>
            </UCard>

            <div v-if="summary" class="space-y-6">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <UIcon name="i-heroicons-document-text" class="w-8 h-8 text-primary" />
                        <h3 class="text-3xl font-bold">Streszczenie</h3>
                    </div>
                    <UButton color="neutral" variant="ghost" icon="i-heroicons-arrow-path" @click="summary = null">
                        Zamknij i wróć
                    </UButton>
                </div>

                <UCard>
                    <template #header>
                        <div class="flex items-center gap-2">
                            <UIcon name="i-heroicons-bookmark" class="text-primary w-5 h-5" />
                            <h4 class="text-lg font-bold">Przegląd</h4>
                        </div>
                    </template>
                    <p class="text-base leading-relaxed text-gray-700 dark:text-gray-300">{{ summary.overview }}</p>
                </UCard>

                <UCard v-if="summary.keyPoints && summary.keyPoints.length > 0">
                    <template #header>
                        <div class="flex items-center gap-2">
                            <UIcon name="i-heroicons-list-bullet" class="text-primary w-5 h-5" />
                            <h4 class="text-lg font-bold">Najważniejsze punkty</h4>
                        </div>
                    </template>
                    <ul class="space-y-3">
                        <li v-for="(point, index) in summary.keyPoints" :key="index" class="flex items-start gap-3">
                            <UIcon name="i-heroicons-check-circle-solid"
                                class="w-5 h-5 text-primary-500 shrink-0 mt-0.5" />
                            <span class="leading-relaxed text-gray-700 dark:text-gray-300">{{ point }}</span>
                        </li>
                    </ul>
                </UCard>

                <UCard v-for="(section, index) in summary.sections" :key="index"
                    class="shadow-sm hover:shadow transition-shadow">
                    <div class="font-semibold text-xl mb-3 flex items-start gap-3">
                        <UBadge size="lg" color="primary" variant="subtle" class="shrink-0 mt-0.5">{{ index + 1 }}
                        </UBadge>
                        <span>{{ section.heading }}</span>
                    </div>
                    <p class="leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-line">{{ section.content
                        }}</p>
                </UCard>

                <UCard class="text-center p-4">
                    <div class="flex items-center justify-center gap-4">
                        <UButton color="neutral" variant="ghost" icon="i-heroicons-sparkles"
                            @click="summary = null">
                            Wygeneruj inne
                        </UButton>
                        <UButton color="primary" variant="soft" icon="i-lucide-arrow-left"
                            @click="router.push('/dashboard/summary')">
                            Wróć do listy streszczeń
                        </UButton>
                    </div>
                </UCard>
            </div>
        </UContainer>
    </div>
</template>
