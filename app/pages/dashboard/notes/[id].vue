<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useNotes } from '~/composables/useNotes'

definePageMeta({
    layout: "dashboard",
})

const route = useRoute()
const router = useRouter()
const { notes, getNote, getNoteContent, saveNote: saveNoteToStore, fetchNotes } = useNotes()

const noteId = ref(String(route.params.id))
const title = ref('Ładowanie...')
const content = ref<string | undefined>(undefined)
const isSaving = ref(false)
const isLoading = ref(true)
const hasUnsavedChanges = ref(false)
const lastSavedTitle = ref('')
const lastSavedContent = ref('')
const isSyncingTitleFromContent = ref(false)
const isSyncingContentFromTitle = ref(false)

const extractFirstH1 = (value: string) => {
    const match = value.match(/^#(?!#)\s+(.+)$/m)
    return match?.[1]?.trim() || null
}

const syncFirstH1WithTitle = (value: string, rawTitle: string) => {
    const safeTitle = rawTitle.trim() || 'Nowa Notatka'
    const normalized = value || ''

    if (!normalized.trim()) {
        return `# ${safeTitle}\n\n`
    }

    const lines = normalized.split(/\r?\n/)
    const firstH1Index = lines.findIndex(line => /^#(?!#)\s+/.test(line))

    if (firstH1Index >= 0) {
        lines[firstH1Index] = `# ${safeTitle}`
        return lines.join('\n')
    }

    return `# ${safeTitle}\n\n${normalized.replace(/^\s+/, '')}`
}

onMounted(async () => {
    // Jeśli lista w pamięci jest pusta (np. po refeshu) załaduj je z powrotem
    if (notes.value.length === 0) {
        await fetchNotes()
    }

    // Pierwsze wejście potrafi zderzyć się z opóźnionym stanem auth/listy.
    // Retry jednorazowy stabilizuje pobieranie notatki bez ręcznego odświeżania.
    let note = getNote(noteId.value)
    if (!note) {
        await fetchNotes()
        note = getNote(noteId.value)
    }

    if (note) {
        title.value = note.title

        // Zawsze bierz świeżą treść ze Storage, żeby UI nie trzymał starego cache.
        const remoteContent = await getNoteContent(noteId.value)
        const resolvedContent = remoteContent !== null ? remoteContent : (note.content || '')
        content.value = resolvedContent
        note.content = resolvedContent

        const h1Title = extractFirstH1(resolvedContent)
        if (h1Title) {
            title.value = h1Title
            note.title = h1Title
        } else {
            const normalizedContent = syncFirstH1WithTitle(resolvedContent, title.value)
            content.value = normalizedContent
            note.content = normalizedContent
        }

        lastSavedTitle.value = title.value
        lastSavedContent.value = content.value || ''
        hasUnsavedChanges.value = false
    } else {
        title.value = 'Nie znaleziono pliku'
        content.value = 'Notatka uległa zniszczeniu lub została usunięta.'
        lastSavedTitle.value = title.value
        lastSavedContent.value = content.value || ''
        hasUnsavedChanges.value = false
    }
    isLoading.value = false
})

watch(content, (newContent) => {
    if (isLoading.value || newContent === undefined) return

    if (isSyncingContentFromTitle.value) {
        isSyncingContentFromTitle.value = false
        return
    }

    const h1Title = extractFirstH1(newContent)
    if (h1Title && h1Title !== title.value) {
        isSyncingTitleFromContent.value = true
        title.value = h1Title
    }
})

watch(title, (newTitle) => {
    if (isLoading.value || content.value === undefined) return

    if (isSyncingTitleFromContent.value) {
        isSyncingTitleFromContent.value = false
        return
    }

    const syncedContent = syncFirstH1WithTitle(content.value, newTitle)
    if (syncedContent !== content.value) {
        isSyncingContentFromTitle.value = true
        content.value = syncedContent
    }
})

watch([content, title], () => {
    if (isLoading.value) return

    const safeTitle = title.value.trim() || 'Nowa Notatka'
    const safeContent = content.value || ''
    hasUnsavedChanges.value = safeTitle !== lastSavedTitle.value || safeContent !== lastSavedContent.value
})

const goBack = async () => {
    await saveNote(true)
}

const saveNote = async (exitAfterSave = false) => {
    try {
        if (isSaving.value) return
        isSaving.value = true

        const safeTitle = title.value.trim() || 'Nowa Notatka'
        title.value = safeTitle

        const currentNote = getNote(noteId.value)
        if (currentNote) {
            currentNote.title = safeTitle
        }

        const currentContent = content.value || ''
        const savedNoteId = await saveNoteToStore(noteId.value, currentContent, safeTitle)

        if (savedNoteId && savedNoteId !== noteId.value) {
            noteId.value = savedNoteId
            await router.replace(`/dashboard/notes/${savedNoteId}`)
        }

        lastSavedTitle.value = safeTitle
        lastSavedContent.value = currentContent
        hasUnsavedChanges.value = false
        
        if (exitAfterSave) {
            router.push('/dashboard/notes')
        } else {
            console.log('Zapisano notatke pomyślnie')
        }
    } catch (e) {
        console.error('Wystąpił błąd podcas zapisywania:', e)
        alert('Nie udało się zapisać notatki do Supabase.')
    } finally {
        isSaving.value = false
    }
}
</script>

<template>
	<UDashboardPanel>
		<template #header>
			<UDashboardNavbar>
                <template #leading>
                    <UButton icon="i-lucide-arrow-left" color="gray" variant="ghost" @click="goBack" />
                    <span class="text-gray-300 dark:text-gray-700 mx-2">/</span>
                    <UInput 
                        v-model="title" 
                        size="xl" 
                        variant="none" 
                        class="font-bold text-2xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors rounded-md w-full min-w-0 max-w-xl focus:ring-1 focus:ring-primary-500" 
                        autofocus
                        @keydown.enter="$event.target.blur()"
                    />
                </template>
                <template #right>
                    <div class="hidden md:flex gap-2 items-center">
                        <span v-if="hasUnsavedChanges" class="text-xs text-amber-600 dark:text-amber-400 font-medium">Niezapisane zmiany</span>
                        <UButton :loading="isSaving" color="gray" variant="solid" icon="i-lucide-save" @click="saveNote(false)">Zapisz notatkę</UButton>
                        <UButton :loading="isSaving" color="black" variant="solid" icon="i-lucide-check" @click="saveNote(true)">Zapisz i Wyjdź</UButton>
                    </div>
                </template>
            </UDashboardNavbar>
		</template>

		<UDashboardPanelContent class="p-0 overflow-y-auto relative h-full bg-white dark:bg-gray-900 flex flex-col">
            <ClientOnly fallback-tag="div" fallback="Ładowanie edytora...">
                <NotesEditor v-if="content !== undefined" v-model="content" />
            </ClientOnly>

            <div class="fixed bottom-4 right-4 z-[60]">
                <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur p-2 shadow-lg">
                    <div class="flex items-center gap-2">
                        <span v-if="hasUnsavedChanges" class="hidden sm:inline text-xs text-amber-600 dark:text-amber-400 font-medium px-1">Niezapisane zmiany</span>
                        <UButton :loading="isSaving" color="gray" variant="solid" icon="i-lucide-save" @click="saveNote(false)">Zapisz</UButton>
                        <UButton :loading="isSaving" color="black" variant="solid" icon="i-lucide-check" @click="saveNote(true)">Zapisz i wyjdź</UButton>
                    </div>
                </div>
            </div>
		</UDashboardPanelContent>
	</UDashboardPanel>
</template>