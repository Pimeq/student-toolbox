import { ref, computed } from 'vue'
import { useSupabaseClient } from '#imports'

export type QuizQuestion = {
    question: string
    answers: string[]
    correct: number
}

export function useQuizGeneration() {
    const supabase = useSupabaseClient()
    
    const quiz = ref<QuizQuestion[]>([])
    const userAnswers = ref<Record<number, number>>({})
    const isQuizSubmitted = ref(false)
    const quizLoading = ref(false)
    const errorMsg = ref<string | null>(null)

    const score = computed(() => {
        let correctCount = 0
        quiz.value.forEach((q, i) => {
            if (userAnswers.value[i] === q.correct) correctCount++
        })
        return correctCount
    })

    async function generateQuiz(text: any, questionCount: number, noteId: string, noteTitle: string) {
        const textToProcess = typeof text === 'string' ? text : JSON.stringify(text)

        if (!textToProcess || !textToProcess.trim()) {
            errorMsg.value = "Treść notatki jest pusta lub nieczytelna."
            return
        }

        quizLoading.value = true
        errorMsg.value = null
        quiz.value = []
        userAnswers.value = {}
        isQuizSubmitted.value = false

        try {
            const res = await $fetch<{ quiz: QuizQuestion[] }>("/api/generate-quiz", {
                method: "POST",
                body: { text: textToProcess, questionCount },
            })

            if (res && res.quiz && res.quiz.length > 0) {
                quiz.value = res.quiz
                await saveQuizToDatabase(res.quiz, noteId, noteTitle)
            } else {
                errorMsg.value = "Zbyt mało treści do wygenerowania quizu."
            }
        } catch (err: any) {
            errorMsg.value = err.data?.message || "Nie udało się wygenerować quizu."
        } finally {
            quizLoading.value = false
        }
    }

    async function saveQuizToDatabase(quizData: QuizQuestion[], noteId: string, noteTitle: string) {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const quizJson = JSON.stringify(quizData)
            const fileBlob = new Blob([quizJson], { type: 'application/json' })
            const storagePath = `quizzes/${user.id}/${Date.now()}.json`

            const { data: storageData, error: storageError } = await supabase.storage
                .from('files')
                .upload(storagePath, fileBlob, {
                    contentType: 'application/json',
                    cacheControl: '0'
                })

            if (storageError) {
                errorMsg.value = `Błąd Storage: ${storageError.message}`
                return
            }

            const objectId = (storageData as any)?.id

            if (!objectId) {
                errorMsg.value = "Nie udało się pobrać prawdziwego ID pliku ze Storage."
                return
            }

            const finalName = `${noteId}:::${storagePath}:::Quiz: ${noteTitle}`

            const { error: dbError } = await supabase.from('files').insert({
                object_id: objectId, 
                uploaded_by: user.id,
                name: finalName,
                size: fileBlob.size,
                mime_type: 'application/json',
                file_type: 'quiz'
            } as any)

            if (dbError) {
                console.error('Błąd zapisu metadanych:', dbError)
                errorMsg.value = `Błąd bazy danych: ${dbError.message}`
            }
        } catch (e: any) {
            errorMsg.value = `Błąd ogólny: ${e.message}`
        }
    }

    async function loadQuiz(savedQuiz: any) {
        quizLoading.value = true
        errorMsg.value = null
        try {
            const parts = savedQuiz.name.split(':::')
            const filePath = parts.length > 2 ? parts[1] : null

            if (!filePath) throw new Error("Brak przypisanej ścieżki w nazwie pliku.")

            const { data, error } = await supabase.storage.from('files').download(filePath)
            if (error) throw error

            const text = await data.text()
            quiz.value = JSON.parse(text)
            userAnswers.value = {}
            isQuizSubmitted.value = false
        } catch (err: any) {
            errorMsg.value = `Nie udało się pobrać quizu: ${err.message}`
        } finally {
            quizLoading.value = false
        }
    }

    return {
        quiz, userAnswers, isQuizSubmitted, quizLoading, errorMsg, score, generateQuiz, loadQuiz
    }
}