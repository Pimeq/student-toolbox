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
    layout: 'dashboard',
})

const route = useRoute()
const router = useRouter()
const { getNote, saveNote: saveNoteToStore, fetchNotes, fetchNoteById } = useNotes()

const noteId = ref(String(route.params.id))
const title = ref('Ladowanie...')
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
const showFloatingActions = computed(() => canEdit.value && !isLoading.value && !isFetchPending.value && !accessMessage.value)

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
        if (message.includes('Nie masz dostepu') || message.includes('Brak autoryzacji')) {
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

const exitNote = () => {
    router.push('/dashboard/notes')
}

const saveNote = async () => {
    try {
        if (!canEdit.value || isSaving.value) return

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

        console.log('Zapisano notatke pomyslnie')
    } catch (error) {
        console.error('Wystapil blad podczas zapisywania:', error)
        alert('Nie udalo sie zapisac notatki do Supabase.')
    } finally {
        isSaving.value = false
    }
}
</script>

<template>
    <UDashboardPanel>
        <UDashboardNavbar>
            <template #leading>
                <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" @click="exitNote" />
                <span class="mx-2 text-gray-300 dark:text-gray-700">/</span>
                <UInput
                    v-model="title"
                    size="xl"
                    variant="none"
                    class="w-full min-w-0 max-w-xl rounded-md text-2xl font-bold transition-colors hover:bg-gray-100 focus:ring-1 focus:ring-primary-500 dark:hover:bg-gray-800"
                    autofocus
                    :disabled="!canEdit"
                    @keydown.enter="$event.target.blur()"
                />
            </template>
            <template #right>
                <div class="flex items-center gap-2">
                    <span class="hidden text-xs font-medium text-gray-500 dark:text-gray-400 lg:inline">{{ noteGroupLabel }}</span>
                    <span class="hidden text-xs font-medium text-gray-500 dark:text-gray-400 lg:inline">Udostepnil: {{ sharedByLabel }}</span>
                    <span v-if="!canEdit" class="hidden text-xs font-medium text-blue-600 dark:text-blue-400 sm:inline">Tryb tylko do odczytu</span>
                    <span v-if="canEdit && hasUnsavedChanges" class="hidden text-xs font-medium text-amber-600 dark:text-amber-400 sm:inline">Niezapisane zmiany</span>
                </div>
            </template>
        </UDashboardNavbar>

        <UDashboardPanelContent class="relative flex h-full flex-col overflow-y-auto bg-white p-0 pb-24 dark:bg-gray-900">
            <div v-if="isLoading || isFetchPending" class="flex flex-1 items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
                <UIcon name="i-lucide-loader-2" class="h-5 w-5 animate-spin" />
                <span>Ladowanie notatki...</span>
            </div>

            <div v-else-if="accessMessage" class="flex flex-1 items-center justify-center p-6">
                <UAlert
                    color="warning"
                    variant="soft"
                    icon="i-lucide-shield-alert"
                    :title="accessMessage"
                    description="Mozesz wrocic do listy notatek i wybrac inna pozycje."
                />
            </div>

            <ClientOnly v-else fallback-tag="div" fallback="Ladowanie edytora...">
                <NotesEditor v-if="content !== undefined" v-model="content" :readonly="!canEdit" />
            </ClientOnly>

            <div v-if="showFloatingActions" class="fixed bottom-6 right-6 z-30 flex items-center gap-3">
                <UButton
                    color="neutral"
                    variant="soft"
                    size="lg"
                    icon="i-lucide-x"
                    @click="exitNote"
                >
                    Wyjdz
                </UButton>
                <UButton
                    color="primary"
                    size="lg"
                    icon="i-lucide-save"
                    :loading="isSaving"
                    :disabled="isSaving || !hasUnsavedChanges"
                    @click="saveNote"
                >
                    Zapisz
                </UButton>
            </div>
        </UDashboardPanelContent>
    </UDashboardPanel>
</template>
