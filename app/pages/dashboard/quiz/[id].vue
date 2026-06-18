<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNotes } from '~/composables/useNotes'
import { useQuizGeneration } from '~/composables/useQuizGeneration'
import { useSupabaseClient } from '#imports'

definePageMeta({
    layout: 'dashboard'
})

const { t, locale } = useI18n()
const intlLocale = computed(() => (locale.value === 'en' ? 'en-US' : 'pl-PL'))
const route = useRoute()
const router = useRouter()
const supabase = useSupabaseClient()
const { getNoteContent, fetchNotes, notes } = useNotes()

const noteId = route.params.id as string
const questionCount = ref<number>(5)

const currentNote = computed(() => notes.value.find(n => n.id === noteId))
const noteTitle = computed(() => currentNote.value?.title || t('quiz.unknownNote'))

const { 
    quiz, userAnswers, isQuizSubmitted, quizLoading, errorMsg, score, generateQuiz, loadQuiz 
} = useQuizGeneration()

const { data: fileText, pending: notePending, error: noteError } = await useAsyncData(
    `note-content-${noteId}`, 
    async () => {
        if (!noteId) throw new Error(t("quiz.errors.noteNotSelected"))
        let content = await getNoteContent(noteId)
        if (!content) {
            await fetchNotes()
            content = await getNoteContent(noteId)
        }
        if (!content) throw new Error(t("quiz.errors.loadContentFailed"))
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
        errorMsg.value = t("quiz.errors.loadContentNull")
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
                            {{ t('quiz.generatorTitle') }}
                        </h2>
                        <UButton color="neutral" variant="ghost" icon="i-heroicons-arrow-left"
                            @click="router.push('/dashboard/quiz')">{{ t('quiz.back') }}</UButton>
                    </div>
                </template>

                <div class="flex flex-col items-center justify-center my-10 space-y-6">
                    <div v-if="notePending || quizLoading" class="text-gray-500 flex items-center gap-2">
                        <UIcon name="i-heroicons-arrow-path" class="animate-spin w-5 h-5" />
                        {{ t('quiz.processing') }}
                    </div>
                    
                    <UAlert v-else-if="noteError" color="error" icon="i-heroicons-exclamation-triangle" :title="noteError.message" />

                    <template v-else-if="fileText">
                        <div class="text-center space-y-2">
                            <h3 class="text-xl font-medium">{{ t('quiz.generateNew') }}</h3>
                            <p class="text-gray-500 max-w-md mx-auto">{{ t('quiz.generateHint') }}</p>
                        </div>

                        <div class="flex flex-col sm:flex-row gap-4 items-center justify-center w-full max-w-sm mt-4">
                            <UFormField :label="t('quiz.questionCount')" class="w-full flex-1">
                                <UInput v-model="questionCount" type="number" min="1" max="20" icon="i-heroicons-list-bullet" />
                            </UFormField>

                            <UButton @click="handleGenerate" :loading="quizLoading" :disabled="!fileText" icon="i-heroicons-cpu-chip" size="lg" class="mt-6 w-full sm:w-auto">
                                {{ t('quiz.generate') }}
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
                        <h3 class="text-xl font-bold">{{ t('quiz.savedTitle') }}</h3>
                    </div>
                </template>

                <div v-if="quizzesLoading" class="p-4 text-center text-gray-500">
                    {{ t('quiz.loadingSaved') }}
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
                                <span class="text-xs text-gray-500">{{ new Date(saved.created_at).toLocaleDateString(intlLocale) }}</span>
                            </div>
                        </div>
                        <UButton color="primary" variant="subtle" icon="i-heroicons-play" @click="loadExistingQuiz(saved)">
                            {{ t('quiz.solve') }}
                        </UButton>
                    </div>
                </div>
            </UCard>

            <div v-if="quiz.length > 0" class="space-y-6">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <UIcon name="i-heroicons-academic-cap" class="w-8 h-8 text-primary" />
                        <h3 class="text-3xl font-bold">{{ t('quiz.yourQuiz') }}</h3>
                    </div>
                    <UButton color="neutral" variant="ghost" icon="i-heroicons-arrow-path" @click="quiz = []">{{ t('quiz.closeReturn') }}
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
                            {{ t('quiz.checkAnswers') }}
                        </UButton>
                        <p class="text-sm text-gray-500 mt-2">
                            {{ t('quiz.filledOut', { answered: Object.keys(userAnswers).length, total: quiz.length }) }}
                        </p>
                    </div>
                    <div v-else class="space-y-4">
                        <h4 class="text-2xl font-bold">{{ t('quiz.yourScore') }}</h4>
                        <div class="text-5xl font-black mb-2"
                            :class="score === quiz.length ? 'text-green-500' : (score > quiz.length / 2 ? 'text-primary' : 'text-red-500')">
                            {{ score }} / {{ quiz.length }}
                        </div>
                        <div class="flex items-center justify-center gap-4 mt-6">
                            <UButton color="neutral" variant="ghost" icon="i-heroicons-arrow-path"
                                @click="() => { isQuizSubmitted = false; userAnswers = {} }">
                                {{ t('quiz.tryAgain') }}
                            </UButton>
                            <UButton color="primary" variant="soft" icon="i-lucide-arrow-left"
                                @click="router.push('/dashboard/quiz')">
                                {{ t('quiz.backToList') }}
                            </UButton>
                        </div>
                    </div>
                </UCard>
            </div>
        </UContainer>
    </div>
</template>