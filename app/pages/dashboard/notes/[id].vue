<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, onDeactivated, watch } from 'vue'
import { useRouter, useRoute, onBeforeRouteLeave } from 'vue-router'
import { useNotes } from '~/composables/useNotes'

interface LoadedNotePayload {
    id: string
    title: string
    content: string
    visibility: 'personal' | 'shared'
    group: { id: string; name: string; type: string } | null
    isOwner: boolean
    canEdit: boolean
    sharedByLabel: string
    uploadedBy: string
    userRole: 'student' | 'instructor' | 'admin' | null
    updatedAt: string
}

definePageMeta({
    layout: "dashboard",
})

const route = useRoute()
const router = useRouter()
const { notes, getNote, saveNote: saveNoteToStore, fetchNotes, fetchNoteById } = useNotes()

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
const canEdit = ref(false)
const accessMessage = ref('')
const noteGroupLabel = ref('')
const sharedByLabel = ref('')
const isFetchPending = ref(false)
const showFloatingActions = computed(() => canEdit.value)

const releaseViewportLocks = () => {
    if (import.meta.server) return

    document.documentElement.classList.remove('overflow-hidden')
    document.body.classList.remove('overflow-hidden')
    document.documentElement.removeAttribute('data-scroll-locked')
    document.body.removeAttribute('data-scroll-locked')

    document.documentElement.style.overflow = ''
    document.body.style.overflow = ''
    document.body.style.position = ''
    document.body.style.width = ''
    document.body.style.paddingRight = ''
    document.body.style.top = ''
    document.body.style.left = ''
    document.body.style.right = ''
    document.body.style.touchAction = ''
    document.body.style.removeProperty('--scrollbar-width')
}

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

const applyLoadedNote = (payload: LoadedNotePayload) => {
    title.value = payload.title || 'Nowa Notatka'
    content.value = payload.content || ''
    canEdit.value = payload.canEdit
    sharedByLabel.value = payload.sharedByLabel
    noteGroupLabel.value = payload.group ? `${payload.group.name} (${payload.group.type})` : 'Prywatna'

    const h1Title = extractFirstH1(content.value)
    if (h1Title) {
        title.value = h1Title
    } else if (canEdit.value && content.value !== undefined) {
        content.value = syncFirstH1WithTitle(content.value, title.value)
    }

    const localNote = getNote(payload.id)
    if (localNote) {
        localNote.title = title.value
        localNote.content = content.value || ''
        localNote.visibility = payload.visibility
        localNote.group_name = payload.group?.name || null
        localNote.group_type = payload.group?.type as typeof localNote.group_type
        localNote.can_edit = payload.canEdit
        localNote.shared_by_label = payload.sharedByLabel
        localNote.user_role = payload.userRole
        localNote.is_owner = payload.isOwner
    }

    lastSavedTitle.value = title.value
    lastSavedContent.value = content.value || ''
    hasUnsavedChanges.value = false
    accessMessage.value = ''
}

const setErrorState = (message: string) => {
    title.value = 'Brak dostepu do notatki'
    content.value = 'Ta notatka nie jest dostepna dla Twojego konta.'
    canEdit.value = false
    accessMessage.value = message
    noteGroupLabel.value = ''
    sharedByLabel.value = ''
    lastSavedTitle.value = title.value
    lastSavedContent.value = content.value || ''
    hasUnsavedChanges.value = false
}

const loadNote = async () => {
    isLoading.value = true
    noteId.value = String(route.params.id)
    isFetchPending.value = true

    try {
        await fetchNotes()
        const payload = await fetchNoteById(noteId.value)

        if (!payload) {
            setErrorState('Nie udalo sie zaladowac danych notatki.')
            return
        }

        applyLoadedNote(payload)
    } catch (error: any) {
        console.error('Blad ladowania notatki:', error)
        
        const message = error.message || ''
        if (message.includes('Nie masz dostępu') || message.includes('Brak autoryzacji')) {
            setErrorState('Nie nalezysz do grupy tej notatki lub nie masz do niej dostepu.')
        } else if (message.includes('nie istnieje') || message.includes('Nie znaleziono')) {
            setErrorState('Notatka nie istnieje albo zostala usunieta.')
        } else {
            setErrorState(`Wystapil blad podczas ladowania notatki: ${message}`)
        }
    } finally {
        isLoading.value = false
        isFetchPending.value = false
    }
}

onMounted(async () => {
    releaseViewportLocks()
    await loadNote()
})

onBeforeRouteLeave(() => {
    releaseViewportLocks()
})

onBeforeUnmount(() => {
    releaseViewportLocks()
})

onDeactivated(() => {
    releaseViewportLocks()
})

watch(() => route.params.id, async (newId, oldId) => {
    if (String(newId) === String(oldId)) return
    await loadNote()
})

watch(content, (newContent) => {
    if (isLoading.value || !canEdit.value || newContent === undefined) return

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
    if (isLoading.value || !canEdit.value || content.value === undefined) return

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
    if (isLoading.value || !canEdit.value) return

    const safeTitle = title.value.trim() || 'Nowa Notatka'
    const safeContent = content.value || ''
    hasUnsavedChanges.value = safeTitle !== lastSavedTitle.value || safeContent !== lastSavedContent.value
})

const goBack = async () => {
    if (canEdit.value && hasUnsavedChanges.value) {
        await saveNote(true)
        return
    }

    router.push('/dashboard/notes')
}

const saveNote = async (exitAfterSave = false) => {
    try {
        if (!canEdit.value) {
            if (exitAfterSave) {
                router.push('/dashboard/notes')
            }
            return
        }

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
                    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" @click="goBack" />
                    <span class="text-gray-300 dark:text-gray-700 mx-2">/</span>
                    <UInput v-model="title" size="xl" variant="none"
                        class="font-bold text-2xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors rounded-md w-full min-w-0 max-w-xl focus:ring-1 focus:ring-primary-500"
                        autofocus :disabled="!canEdit" @keydown.enter="$event.target.blur()" />
                </template>
                <template #right>
                    <div class="hidden md:flex gap-2 items-center">
                        <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">{{ noteGroupLabel }}</span>
                        <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">Udostepnil: {{ sharedByLabel }}</span>
                        <span v-if="!canEdit" class="text-xs text-blue-600 dark:text-blue-400 font-medium">Tryb tylko do odczytu</span>
                        <span v-if="canEdit && hasUnsavedChanges"
                            class="text-xs text-amber-600 dark:text-amber-400 font-medium">Niezapisane zmiany</span>
                        <UButton v-if="canEdit" :loading="isSaving" color="neutral" variant="solid" icon="i-lucide-save"
                            @click="saveNote(false)">Zapisz notatkę</UButton>
                        <UButton v-if="canEdit" :loading="isSaving" color="neutral" variant="solid" icon="i-lucide-check"
                            @click="saveNote(true)">Zapisz i Wyjdź</UButton>
                    </div>
                </template>
            </UDashboardNavbar>
        </template>

        <UDashboardPanelContent class="p-0 overflow-y-auto relative h-full bg-white dark:bg-gray-900 flex flex-col pb-24 md:pb-0">
            <div v-if="isLoading || isFetchPending" class="flex-1 flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
                <UIcon name="i-lucide-loader-2" class="w-5 h-5 animate-spin" />
                <span>Ladowanie notatki...</span>
            </div>

            <div v-else-if="accessMessage" class="flex-1 flex items-center justify-center p-6">
                <UAlert color="warning" variant="soft" icon="i-lucide-shield-alert" :title="accessMessage"
                    description="Mozesz wrocic do listy notatek i wybrac inna pozycje." />
            </div>

            <ClientOnly v-else fallback-tag="div" fallback="Ladowanie edytora...">
                <NotesEditor v-if="content !== undefined" v-model="content" :readonly="!canEdit" />
            </ClientOnly>

            <div v-if="showFloatingActions" data-note-mobile-actions
                class="md:hidden sticky bottom-0 z-20 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-white via-white/95 to-transparent dark:from-gray-900 dark:via-gray-900/95 dark:to-transparent">
                <div
                    class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur p-2 shadow-lg">
                    <div class="flex items-center gap-2">
                        <span v-if="hasUnsavedChanges"
                            class="hidden sm:inline text-xs text-amber-600 dark:text-amber-400 font-medium px-1">Niezapisane
                            zmiany</span>
                        <UButton :loading="isSaving" color="neutral" variant="solid" icon="i-lucide-save"
                            @click="saveNote(false)">
                            Zapisz</UButton>
                        <UButton :loading="isSaving" color="neutral" variant="solid" icon="i-lucide-check"
                            @click="saveNote(true)">Zapisz i wyjdź</UButton>
                    </div>
                </div>
            </div>
        </UDashboardPanelContent>
    </UDashboardPanel>
</template>