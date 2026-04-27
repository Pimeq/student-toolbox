<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNotes } from '~/composables/useNotes'
import { useQuizGeneration } from '~/composables/useQuizGeneration'
import { useSupabaseClient } from '#imports'

definePageMeta({
    layout: 'dashboard'
})

const route = useRoute()
const router = useRouter()
const supabase = useSupabaseClient()
const { getNoteContent, fetchNotes, notes } = useNotes()

const noteId = route.params.id as string
const questionCount = ref<number>(5)

const currentNote = computed(() => notes.value.find(n => n.id === noteId))
const noteTitle = computed(() => currentNote.value?.title || 'Nieznana notatka')

const { 
    quiz, userAnswers, isQuizSubmitted, quizLoading, errorMsg, score, generateQuiz, loadQuiz 
} = useQuizGeneration()

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

const { data: savedQuizzes, pending: quizzesLoading, refresh: refreshQuizzes } = await useAsyncData(
    `saved-quizzes-${noteId}`,
    async () => {
        const { data, error } = await supabase
            .from('files')
            .select('*')
            .eq('file_type', 'quiz')
            .ilike('name', `${noteId}:::%`) 
            .order('created_at', { ascending: false })
            
        if (error) throw error
        return data || []
    }
)

const handleGenerate = async () => {
    if (fileText.value) {
        try {
            await generateQuiz(fileText.value, questionCount.value, noteId, noteTitle.value)
            await refreshQuizzes() 
        } catch (e) {
            console.error("Wystąpił błąd:", e)
        }
    } else {
        errorMsg.value = "Nie można załadować treści notatki."
    }
}

const loadExistingQuiz = async (savedQuiz: any) => {
    await loadQuiz(savedQuiz)
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
            
            <UCard v-if="quiz.length === 0">
                <template #header>
                    <div class="flex items-center justify-between">
                        <h2 class="text-2xl font-bold flex items-center gap-2">
                            <UIcon name="i-heroicons-sparkles" class="text-primary" />
                            AI Quiz Generator
                        </h2>
                        <UButton color="neutral" variant="ghost" icon="i-heroicons-arrow-left"
                            @click="router.push('/dashboard/quiz')">Wróć</UButton>
                    </div>
                </template>

                <div class="flex flex-col items-center justify-center my-10 space-y-6">
                    <div v-if="notePending || quizLoading" class="text-gray-500 flex items-center gap-2">
                        <UIcon name="i-heroicons-arrow-path" class="animate-spin w-5 h-5" />
                        Przetwarzanie...
                    </div>
                    
                    <UAlert v-else-if="noteError" color="error" icon="i-heroicons-exclamation-triangle" :title="noteError.message" />

                    <template v-else-if="fileText">
                        <div class="text-center space-y-2">
                            <h3 class="text-xl font-medium">Wygeneruj nowy quiz</h3>
                            <p class="text-gray-500 max-w-md mx-auto">Sztuczna inteligencja przeanalizuje Twoją notatkę i przygotuje zestaw pytań.</p>
                        </div>

                        <div class="flex flex-col sm:flex-row gap-4 items-center justify-center w-full max-w-sm mt-4">
                            <UFormField label="Liczba pytań" class="w-full flex-1">
                                <UInput v-model="questionCount" type="number" min="1" max="20" icon="i-heroicons-list-bullet" />
                            </UFormField>

                            <UButton @click="handleGenerate" :loading="quizLoading" :disabled="!fileText" icon="i-heroicons-cpu-chip" size="lg" class="mt-6 w-full sm:w-auto">
                                Generuj
                            </UButton>
                        </div>
                    </template>

                    <UAlert v-if="errorMsg" color="error" icon="i-heroicons-exclamation-triangle" :title="errorMsg" class="w-full max-w-md mt-4" />
                </div>
            </UCard>

            <UCard v-if="quiz.length === 0 && savedQuizzes && savedQuizzes.length > 0" class="border-t-4 border-primary-500">
                <template #header>
                    <div class="flex items-center gap-2">
                        <UIcon name="i-heroicons-clock" class="text-primary w-6 h-6" />
                        <h3 class="text-xl font-bold">Zapisane quizy dla tej notatki</h3>
                    </div>
                </template>

                <div v-if="quizzesLoading" class="p-4 text-center text-gray-500">
                    Ładowanie listy quizów...
                </div>

                <div v-else class="grid gap-3">
                    <div v-for="saved in savedQuizzes" :key="saved.id" 
                        class="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl hover:border-primary-500 transition-colors group">
                        <div class="flex items-center gap-3">
                            <div class="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
                                <UIcon name="i-heroicons-document-text" class="text-primary w-5 h-5" />
                            </div>
                            <div class="flex flex-col">
                                <span class="font-semibold">{{ getDisplayName(saved.name) }}</span>
                                <span class="text-xs text-gray-500">{{ new Date(saved.created_at).toLocaleDateString() }}</span>
                            </div>
                        </div>
                        <UButton color="primary" variant="subtle" icon="i-heroicons-play" @click="loadExistingQuiz(saved)">
                            Rozwiąż
                        </UButton>
                    </div>
                </div>
            </UCard>

            <div v-if="quiz.length > 0" class="space-y-6">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <UIcon name="i-heroicons-academic-cap" class="w-8 h-8 text-primary" />
                        <h3 class="text-3xl font-bold">Twój Quiz</h3>
                    </div>
                    <UButton color="neutral" variant="ghost" icon="i-heroicons-arrow-path" @click="quiz = []">Zamknij i wróć
                    </UButton>
                </div>

                <UCard v-for="(q, index) in quiz" :key="index"
                    class="relative shadow-sm hover:shadow transition-shadow">
                    <div class="font-semibold text-xl mb-6 flex items-start gap-3">
                        <UBadge size="lg" color="primary" variant="subtle" class="shrink-0 mt-0.5">{{ index + 1 }}
                        </UBadge>
                        <span>{{ q.question }}</span>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div v-for="(answer, aIndex) in q.answers" :key="aIndex"
                            @click="!isQuizSubmitted && (userAnswers[index] = aIndex)" :class="[
                                'p-4 rounded-lg border text-base flex items-start gap-3 transition-all',
                                !isQuizSubmitted ? (
                                    userAnswers[index] === aIndex
                                        ? 'bg-primary-50 border-primary-300 text-primary-900 dark:bg-primary-900/30 dark:border-primary-800 dark:text-primary-300 ring-2 ring-primary-500 cursor-pointer'
                                        : 'bg-white border-gray-200 text-gray-700 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer'
                                ) : (
                                    aIndex === q.correct
                                        ? 'bg-green-50 border-green-300 text-green-900 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300 ring-2 ring-green-500 opacity-100'
                                        : userAnswers[index] === aIndex
                                            ? 'bg-red-50 border-red-300 text-red-900 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300 ring-2 ring-red-500 opacity-100'
                                            : 'bg-gray-50 border-gray-200 text-gray-500 dark:bg-gray-800/30 dark:border-gray-700 dark:text-gray-500 opacity-50 cursor-not-allowed'
                                )
                            ]">
                            <UIcon v-if="!isQuizSubmitted && userAnswers[index] === aIndex"
                                name="i-heroicons-check-circle-solid"
                                class="w-6 h-6 text-primary-500 shrink-0 mt-0.5" />
                            <div v-else-if="!isQuizSubmitted"
                                class="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600 shrink-0 mt-0.5">
                            </div>

                            <UIcon v-if="isQuizSubmitted && aIndex === q.correct" name="i-heroicons-check-circle-solid"
                                class="w-6 h-6 text-green-500 shrink-0 mt-0.5" />
                            <UIcon v-else-if="isQuizSubmitted && userAnswers[index] === aIndex && aIndex !== q.correct"
                                name="i-heroicons-x-circle-solid" class="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                            <div v-else-if="isQuizSubmitted" class="w-6 h-6 shrink-0 mt-0.5"></div>

                            <span class="leading-relaxed">{{ answer }}</span>
                        </div>
                    </div>
                </UCard>

                <UCard class="text-center p-4">
                    <div v-if="!isQuizSubmitted">
                        <UButton color="primary" size="xl" icon="i-heroicons-paper-airplane"
                            @click="isQuizSubmitted = true">
                            Sprawdź odpowiedzi
                        </UButton>
                        <p class="text-sm text-gray-500 mt-2">
                            Wypełniono {{ Object.keys(userAnswers).length }} z {{ quiz.length }} pytań
                        </p>
                    </div>
                    <div v-else class="space-y-4">
                        <h4 class="text-2xl font-bold">Twój wynik</h4>
                        <div class="text-5xl font-black mb-2"
                            :class="score === quiz.length ? 'text-green-500' : (score > quiz.length / 2 ? 'text-primary' : 'text-red-500')">
                            {{ score }} / {{ quiz.length }}
                        </div>
                        <div class="flex items-center justify-center gap-4 mt-6">
                            <UButton color="neutral" variant="ghost" icon="i-heroicons-arrow-path"
                                @click="() => { isQuizSubmitted = false; userAnswers = {} }">
                                Spróbuj ponownie
                            </UButton>
                            <UButton color="primary" variant="soft" icon="i-lucide-arrow-left"
                                @click="router.push('/dashboard/quiz')">
                                Wróć do listy quizów
                            </UButton>
                        </div>
                    </div>
                </UCard>
            </div>
        </UContainer>
    </div>
</template>