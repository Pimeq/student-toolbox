import { ref } from 'vue'
import { useSupabaseClient } from '#imports'

export type SummarySection = {
    heading: string
    content: string
}

export type SummaryData = {
    overview: string
    keyPoints: string[]
    sections: SummarySection[]
}

export type SummaryDetail = 'short' | 'medium' | 'detailed'

export function useSummaryGeneration() {
    const supabase = useSupabaseClient()

    const summary = ref<SummaryData | null>(null)
    const summaryLoading = ref(false)
    const errorMsg = ref<string | null>(null)

    async function generateSummary(text: any, detail: SummaryDetail, noteId: string, noteTitle: string) {
        const textToProcess = typeof text === 'string' ? text : JSON.stringify(text)

        if (!textToProcess || !textToProcess.trim()) {
            errorMsg.value = "Treść notatki jest pusta lub nieczytelna."
            return
        }

        summaryLoading.value = true
        errorMsg.value = null
        summary.value = null

        try {
            const res = await $fetch<{ summary: SummaryData }>("/api/generate-summary", {
                method: "POST",
                body: { text: textToProcess, detail },
            })

            if (res && res.summary && res.summary.overview) {
                summary.value = res.summary
                await saveSummaryToDatabase(res.summary, noteId, noteTitle)
            } else {
                errorMsg.value = "Zbyt mało treści do wygenerowania streszczenia."
            }
        } catch (err: any) {
            errorMsg.value = err.data?.message || "Nie udało się wygenerować streszczenia."
        } finally {
            summaryLoading.value = false
        }
    }

    async function saveSummaryToDatabase(summaryData: SummaryData, noteId: string, noteTitle: string) {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const summaryJson = JSON.stringify(summaryData)
            const fileBlob = new Blob([summaryJson], { type: 'application/json' })
            const storagePath = `summaries/${user.id}/${Date.now()}.json`

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

            const finalName = `${noteId}:::${storagePath}:::Streszczenie: ${noteTitle}`

            const { error: dbError } = await supabase.from('files').insert({
                object_id: objectId,
                uploaded_by: user.id,
                name: finalName,
                size: fileBlob.size,
                mime_type: 'application/json',
                file_type: 'summary'
            } as any)

            if (dbError) {
                console.error('Błąd zapisu metadanych:', dbError)
                errorMsg.value = `Błąd bazy danych: ${dbError.message}`
            }
        } catch (e: any) {
            errorMsg.value = `Błąd ogólny: ${e.message}`
        }
    }

    async function loadSummary(savedSummary: any) {
        summaryLoading.value = true
        errorMsg.value = null
        try {
            const parts = savedSummary.name.split(':::')
            const filePath = parts.length > 2 ? parts[1] : null

            if (!filePath) throw new Error("Brak przypisanej ścieżki w nazwie pliku.")

            const { data, error } = await supabase.storage.from('files').download(filePath)
            if (error) throw error

            const text = await data.text()
            summary.value = JSON.parse(text)
        } catch (err: any) {
            errorMsg.value = `Nie udało się pobrać streszczenia: ${err.message}`
        } finally {
            summaryLoading.value = false
        }
    }

    return {
        summary, summaryLoading, errorMsg, generateSummary, loadSummary
    }
}
