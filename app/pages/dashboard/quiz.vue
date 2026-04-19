<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNotes } from '~/composables/useNotes'

definePageMeta({
    layout: 'dashboard'
})

const route = useRoute()
const router = useRouter()
const { getNoteContent, fetchNotes } = useNotes()

const noteId = route.query.noteId as string | undefined
const fileText = ref<string | null>(null)
const questionCount = ref<number>(5)
const loading = ref(false)
const errorMsg = ref<string | null>(null)

type QuizQuestion = {
    question: string
    answers: string[]
    correct: number
}
const quiz = ref<QuizQuestion[]>([])
const userAnswers = ref<Record<number, number>>({})
const isQuizSubmitted = ref(false)

const score = computed(() => {
    let correctCount = 0
    quiz.value.forEach((q, i) => {
        if (userAnswers.value[i] === q.correct) correctCount++
    })
    return correctCount
})

onMounted(async () => {
    // Load the note based on the query parameter
    if (!noteId) {
        errorMsg.value = "Nie wybrano notatki. Wróć do widoku notatek, aby wygenerować quiz."
        return
    }

    try {
        loading.value = true
        let content = await getNoteContent(noteId)
        // If content isn't locally cached, trigger a fetch.
        if (!content) {
            await fetchNotes()
            content = await getNoteContent(noteId)
        }

        if (content) {
            fileText.value = content
        } else {
            errorMsg.value = "Nie udało się załadować treści notatki."
        }
    } catch (err) {
        console.error(err)
        errorMsg.value = "Wystąpił błąd podczas ładowania notatki."
    } finally {
        loading.value = false
    }
})

async function generateQuiz() {
    if (!fileText.value || !fileText.value.trim()) {
        errorMsg.value = "Treść notatki jest pusta."
        return
    }

    loading.value = true
    errorMsg.value = null
    quiz.value = []
    userAnswers.value = {}
    isQuizSubmitted.value = false

    try {
        const res = await $fetch<{ quiz: QuizQuestion[] }>("/api/generate-quiz", {
            method: "POST",
            body: {
                text: fileText.value,
                questionCount: questionCount.value,
            },
        })

        if (res && res.quiz && res.quiz.length > 0) {
            quiz.value = res.quiz
        } else {
            errorMsg.value = "Zbyt mało treści do wygenerowania quizu."
        }
    } catch (err: any) {
        errorMsg.value = err.data?.message || "Nie udało się wygenerować quizu."
    } finally {
        loading.value = false
    }
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
                            @click="router.push('/dashboard/notes')">Wróć do notatek</UButton>
                    </div>
                </template>

                <div class="flex flex-col items-center justify-center my-10 space-y-6">
                    <!-- If file loaded successfully, show the generator, otherwise show error -->
                    <template v-if="!errorMsg || fileText">
                        <div class="text-center space-y-2">
                            <h3 class="text-xl font-medium">Wygeneruj quiz z zaznaczonej notatki</h3>
                            <p class="text-gray-500 max-w-md mx-auto">Sztuczna inteligencja przeanalizuje treść Twojej
                                notatki i zapyta Cię o najważniejsze zagadnienia.</p>
                        </div>

                        <div class="flex flex-col sm:flex-row gap-4 items-center justify-center w-full max-w-sm mt-4">
                            <UFormField label="Liczba pytań" class="w-full flex-1">
                                <UInput v-model="questionCount" type="number" min="1" max="20"
                                    icon="i-heroicons-list-bullet" />
                            </UFormField>

                            <UButton @click="generateQuiz" :loading="loading" :disabled="!fileText"
                                icon="i-heroicons-cpu-chip" size="lg" class="mt-6 w-full sm:w-auto">
                                {{ loading ? 'Generowanie...' : 'Generuj' }}
                            </UButton>
                        </div>
                    </template>

                    <UAlert v-if="errorMsg" color="error" icon="i-heroicons-exclamation-triangle" :title="errorMsg"
                        class="w-full max-w-md mt-4" />
                </div>
            </UCard>

            <!-- Quiz Interface after generation -->
            <div v-if="quiz.length > 0" class="space-y-6">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <UIcon name="i-heroicons-academic-cap" class="w-8 h-8 text-primary" />
                        <h3 class="text-3xl font-bold">Twój Quiz</h3>
                    </div>
                    <UButton color="neutral" variant="ghost" icon="i-heroicons-arrow-path" @click="quiz = []">Nowy Quiz
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
                        <UProgress :value="score" :max="quiz.length" color="primary" class="max-w-md mx-auto my-4" />
                        <div class="flex items-center justify-center gap-4 mt-6">
                            <UButton color="neutral" variant="ghost" icon="i-heroicons-arrow-path"
                                @click="() => { isQuizSubmitted = false; userAnswers = {} }">
                                Spróbuj ponownie
                            </UButton>
                            <UButton color="primary" variant="soft" icon="i-lucide-arrow-left"
                                @click="router.push('/dashboard/notes')">
                                Wróć do notatek
                            </UButton>
                        </div>
                    </div>
                </UCard>
            </div>
        </UContainer>
    </div>
</template>
