<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotes } from '~/composables/useNotes'

definePageMeta({
	layout: "dashboard",
})

const router = useRouter()
const { notes, addNote: createNewNote, updateTitle: saveNewTitle, deleteNote: removeNote, fetchNotes, setNoteVisibility, duplicateNote, getUserGroups } = useNotes()

const isGroupModalOpen = ref(false)
const targetNoteId = ref<string | null>(null)
const userGroups = ref<any[]>([])
const selectedGroupId = ref<string>('')
const isFetchingGroups = ref(false)

const openGroupSelectModal = async (noteId: string) => {
	targetNoteId.value = noteId
	isGroupModalOpen.value = true
	isFetchingGroups.value = true
	try {
		const groups = await getUserGroups()
		userGroups.value = groups
		selectedGroupId.value = groups[0]?.id || ''
	} catch (error) {
		console.error("Błąd pobierania grup", error)
	} finally {
		isFetchingGroups.value = false
	}
}

const confirmGroupSelection = async () => {
	if (!targetNoteId.value || !selectedGroupId.value) return

	try {
		await setNoteVisibility(targetNoteId.value, 'shared', selectedGroupId.value)
		isGroupModalOpen.value = false
	} catch (error: any) {
		alert(error?.message || 'Nie udało się zmienić typu notatki.')
		console.error(error)
	}
}

onMounted(async () => {
	await fetchNotes()
})

const isEditingTitle = ref<string | null>(null)
const editingTitleValue = ref('')
const isSelectionMode = ref(false)
const selectedNoteIds = ref<string[]>([])
const isBulkDeleting = ref(false)

const openQuizForNote = (id: string) => {
	router.push(`/dashboard/quiz?noteId=${id}`)
}

const selectedCount = computed(() => selectedNoteIds.value.length)
const personalNotes = computed(() => notes.value.filter(note => note.visibility === 'personal'))
const sharedNotes = computed(() => notes.value.filter(note => note.visibility === 'shared'))
const noteSections = computed(() => [
	{ key: 'personal', label: 'Personal', tag: 'Ps', notes: personalNotes.value },
	{ key: 'shared', label: 'Shared', tag: 'Sh', notes: sharedNotes.value }
])

const startEditingTitle = (note: any) => {
	if (!note.is_owner) return
	if (isSelectionMode.value) return
	isEditingTitle.value = note.id
	editingTitleValue.value = note.title
}

const isNoteSelected = (id: string) => selectedNoteIds.value.includes(id)

const setNoteSelection = (id: string, selected: boolean) => {
	if (selected) {
		if (!selectedNoteIds.value.includes(id)) {
			selectedNoteIds.value = [...selectedNoteIds.value, id]
		}
		return
	}

	selectedNoteIds.value = selectedNoteIds.value.filter(noteId => noteId !== id)
}

const toggleNoteSelection = (id: string) => {
	setNoteSelection(id, !isNoteSelected(id))
}

const toggleSelectionMode = () => {
	isSelectionMode.value = !isSelectionMode.value
	if (!isSelectionMode.value) {
		selectedNoteIds.value = []
	}
}

const clearSelection = () => {
	selectedNoteIds.value = []
}

const saveTitle = async (note: any) => {
	if (editingTitleValue.value.trim() !== '') {
		try {
			await saveNewTitle(note.id, editingTitleValue.value)
		} catch (error: any) {
			alert("Nie udało się zapisać nazwy notatki.")
			console.error(error)
		}
	}
	isEditingTitle.value = null
}

const isCreating = ref(false)

const handleAddNote = async () => {
	try {
		isCreating.value = true
		await createNewNote()
	} catch (e: any) {
		alert("Błąd: " + (e.message || JSON.stringify(e)))
		console.error(e)
	} finally {
		isCreating.value = false
	}
}

const handleDeleteNote = async (id: string) => {
	if (confirm("Czy na pewno chcesz usunąć tę notatkę?")) {
		try {
			await removeNote(id)
			selectedNoteIds.value = selectedNoteIds.value.filter(noteId => noteId !== id)
		} catch (error) {
			alert("Wystąpił błąd przy usuwaniu notatki.")
		}
	}
}

const handleDeleteSelectedNotes = async () => {
	if (selectedNoteIds.value.length === 0) return

	const count = selectedNoteIds.value.length
	if (!confirm(`Czy na pewno chcesz usunąć ${count} notatek?`)) return

	isBulkDeleting.value = true
	let failed = 0

	const idsToDelete = [...selectedNoteIds.value]
	for (const id of idsToDelete) {
		try {
			await removeNote(id)
		} catch (error) {
			failed += 1
		}
	}

	isBulkDeleting.value = false
	selectedNoteIds.value = []
	isSelectionMode.value = false

	if (failed > 0) {
		alert(`Nie udało się usunąć ${failed} notatek.`)
	}
}

const handleCardClick = (id: string) => {
	if (isSelectionMode.value) {
		toggleNoteSelection(id)
		return
	}

	router.push(`/dashboard/notes/${id}`)
}

const handleToggleVisibility = async (note: any) => {
	try {
		const nextVisibility = note.visibility === 'shared' ? 'personal' : 'shared'

		if (nextVisibility === 'shared') {
			await openGroupSelectModal(note.id)
		} else {
			await setNoteVisibility(note.id, nextVisibility)
		}
	} catch (error: any) {
		alert(error?.message || 'Nie udało się zmienić typu notatki.')
		console.error(error)
	}
}

const formatDate = (dateString: string) => {
	const date = new Date(dateString)
	const now = new Date()
	const diff = now.getTime() - date.getTime()

	// Dziś
	if (diff < 86400000 && date.getDate() === now.getDate()) {
		return `Dzisiaj o ${date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`
	}

	// Wczoraj
	if (diff < 172800000) {
		return `Wczoraj o ${date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`
	}

	return date.toLocaleDateString('pl-PL', {
		day: 'numeric', month: 'short', year: 'numeric'
	})
}

// Mapowanie klas gradientów (Nuxt UI 3 color mapping helpers)
const colorMap: Record<string, string> = {
	blue: 'bg-blue-500/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400 border-blue-200 dark:border-blue-900',
	emerald: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900',
	purple: 'bg-purple-500/10 text-purple-600 dark:bg-purple-400/10 dark:text-purple-400 border-purple-200 dark:border-purple-900',
	amber: 'bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400 border-amber-200 dark:border-amber-900',
	rose: 'bg-rose-500/10 text-rose-600 dark:bg-rose-400/10 dark:text-rose-400 border-rose-200 dark:border-rose-900',
	orange: 'bg-orange-500/10 text-orange-600 dark:bg-orange-400/10 dark:text-orange-400 border-orange-200 dark:border-orange-900'
}
</script>

<template>
	<div class="flex-1 flex flex-col min-w-0 overflow-hidden">
		<!-- Na sztywno dodany header bez UDashboardPanel/Navbar -->
		<header
			class="h-16 shrink-0 border-b border-gray-200 dark:border-gray-800 px-4 flex items-center gap-4 bg-white dark:bg-gray-900">
			<!-- Poniższy element zakłada że używasz zewnętrznych layoutów. Jeśli chcesz ikonę "burgera", oto darmowa alternatywa -->
			<UButton color="gray" variant="ghost" icon="i-heroicons-bars-3" class="lg:hidden" />
			<h1 class="text-xl font-bold font-sans">Notatki</h1>
		</header>

		<div class="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900/20 p-8 pt-6">
			<div
				class="mb-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur p-3">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div class="flex items-center gap-2">
						<UButton icon="i-lucide-list-checks" size="xs" color="gray" variant="soft"
							@click="toggleSelectionMode">
							{{ isSelectionMode ? 'Zakończ zaznaczanie' : 'Zaznacz notatki' }}
						</UButton>
						<span v-if="isSelectionMode" class="text-xs text-gray-500 dark:text-gray-400">
							Zaznaczone: {{ selectedCount }}
						</span>
						<UButton v-if="isSelectionMode && selectedCount > 0" icon="i-lucide-x" size="xs" color="gray"
							variant="ghost" @click="clearSelection">
							Wyczyść
						</UButton>
					</div>

					<div class="flex items-center gap-2">
						<UButton :loading="isBulkDeleting" :disabled="!isSelectionMode || selectedCount === 0"
							icon="i-lucide-trash-2" size="sm" color="red" variant="soft"
							@click="handleDeleteSelectedNotes">
							Usuń zaznaczone
						</UButton>
						<UButton :loading="isCreating" icon="i-lucide-plus" size="sm" color="black" variant="solid"
							@click="handleAddNote">Nowa Notatka</UButton>
					</div>
				</div>
			</div>

			<!-- Pusty stan (Gdy nie ma notatek) -->
			<div v-if="notes.length === 0"
				class="flex flex-col items-center justify-center h-full text-center space-y-4">
				<UIcon name="i-lucide-file-x" class="w-16 h-16 text-gray-400" />
				<div>
					<h3 class="text-lg font-medium text-gray-900 dark:text-white">Brak notatek</h3>
					<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Zacznij pisać swoją pierwszą notatkę.</p>
				</div>
				<UButton :loading="isCreating" icon="i-lucide-plus" color="black" variant="solid"
					@click="handleAddNote">Dodaj Notatkę</UButton>
			</div>

			<div v-else class="space-y-8">
				<section v-for="section in noteSections" :key="section.key" class="space-y-3">
					<div class="flex items-center justify-between">
						<h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{
							section.label }}</h2>
						<span
							class="text-xs px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
							{{ section.notes.length }}
						</span>
					</div>

					<div v-if="section.notes.length === 0"
						class="text-sm text-gray-500 dark:text-gray-400 bg-white/70 dark:bg-gray-900/30 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-4">
						Brak notatek w sekcji {{ section.label }}.
					</div>

					<div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
						<div v-for="note in section.notes" :key="note.id" class="group relative h-[250px]">
							<UCard :class="[
								'absolute inset-0 grid [grid-template-rows:auto_1fr_auto] cursor-pointer bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-gray-800 shadow-sm hover:shadow-md hover:ring-primary-500/50 transition-all duration-200 overflow-hidden rounded-xl',
								isSelectionMode && isNoteSelected(note.id) ? 'ring-2 ring-primary-500' : ''
							]" :ui="{ header: { padding: 'p-4 pb-3' }, body: { padding: 'px-4 py-0', base: 'min-h-0 overflow-hidden' }, footer: { padding: 'px-4 py-2.5', base: 'border-t border-gray-100 dark:border-gray-800' } }"
								@click="handleCardClick(note.id)">
								<template #header>
									<div class="flex items-start justify-between gap-3">
										<div v-if="isSelectionMode" class="pt-1" @click.stop>
											<UCheckbox :model-value="isNoteSelected(note.id)"
												@update:model-value="setNoteSelection(note.id, !!$event)" />
										</div>
										<div class="flex items-center justify-center p-2 rounded-lg border"
											:class="colorMap[note.color || 'blue']">
											<UIcon name="i-lucide-file-text" class="w-5 h-5" />
										</div>
										<div class="flex-1 min-w-0">
											<div class="flex items-center justify-between gap-2 mb-1" @click.stop>
												<UButton size="xs" color="gray" variant="outline" :class="[
													'shrink-0 font-semibold transition-all duration-150 hover:shadow-sm',
													note.visibility === 'shared'
														? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60'
														: 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:text-sky-800 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-900/60'
												]" :disabled="isSelectionMode || !note.is_owner" @click.stop="handleToggleVisibility(note)"
													title="Zmień typ notatki Personal/Shared">
													{{ note.visibility === 'shared' ? 'Sh' : 'Ps' }}
												</UButton>
											</div>
											<div v-if="isEditingTitle === note.id"
												class="w-full flex gap-1 -mt-1 -ml-1">
												<UInput v-model="editingTitleValue" class="flex-1" size="xs"
													color="primary" autofocus @click.stop
													@keydown.enter="saveTitle(note)"
													@keydown.esc.stop="isEditingTitle = null" />
												<UButton icon="i-lucide-check" color="green" size="xs" variant="ghost"
													@click.stop="saveTitle(note)" />
											</div>
											<div v-else class="flex items-center justify-between w-full group/title">
												<h3 class="font-semibold text-gray-900 dark:text-white truncate"
													@click.stop="startEditingTitle(note)">{{ note.title }}</h3>
												<UButton v-if="!isSelectionMode && note.is_owner"
													icon="i-lucide-pen-line" color="gray" variant="ghost" size="2xs"
													class="opacity-0 group-hover/title:opacity-100 transition-opacity ml-1 shrink-0"
													@click.stop="startEditingTitle(note)"
													title="Edytuj przypiętą nazwę" />
											</div>
										</div>
									</div>
								</template>

								<div class="h-full w-full overflow-hidden">
									<p
										class="text-gray-500 dark:text-gray-400 text-sm leading-relaxed whitespace-normal break-words font-sans overflow-hidden [display:-webkit-box] [-webkit-line-clamp:4] [-webkit-box-orient:vertical]">
										{{ note.preview }}
									</p>
								</div>

								<template #footer>
									<div
										class="relative z-10 flex items-center justify-between w-full text-xs font-medium text-gray-400">
										<div
											class="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
											<UIcon name="i-lucide-clock" class="w-3.5 h-3.5" />
											{{ formatDate(note.updated_at) }}
										</div>
										<div class="flex items-center gap-0.5">
											<UButton v-if="!isSelectionMode" icon="i-heroicons-sparkles" color="primary"
												variant="ghost" size="2xs"
												class="opacity-70 group-hover:opacity-100 transition-opacity z-10 shrink-0"
												@click.stop="openQuizForNote(note.id)"
												title="Wygeneruj quiz z tej notatki" />
											<UButton v-if="!isSelectionMode && note.is_owner" icon="i-lucide-trash"
												color="red" variant="ghost" size="2xs"
												class="opacity-70 group-hover:opacity-100 transition-opacity cursor-pointer z-10 shrink-0"
												@click.stop="handleDeleteNote(note.id)" title="Usuń notatkę" />
										</div>
									</div>
								</template>
							</UCard>
						</div>
					</div>
				</section>
			</div>
		</div>
		<UModal v-model:open="isGroupModalOpen"><template #content>
				<UCard>
					<template #header>
						<div class="flex items-center justify-between">
							<h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
								Udostepnij notatke
							</h3>
						</div>
					</template>

					<div class="p-4 space-y-4">
						<p class="text-sm text-gray-500 dark:text-gray-400">Zaznacz grupe z ponizszej listy:</p>

						<div v-if="isFetchingGroups" class="flex justify-center py-4">
							<UIcon name="i-lucide-loader-2" class="w-6 h-6 animate-spin text-gray-500" />
						</div>
						<div v-else-if="userGroups.length === 0" class="text-sm text-red-500 py-2">
							Nie masz dodanych zadnych grup uczelnianych!
						</div>
						<div v-else class="space-y-3 pl-1">
							<URadioGroup v-model="selectedGroupId" name="note-group-selection"
								:items="userGroups.map(g => ({ value: g.id, label: g.name + ' (' + g.type + ' - Rola: ' + g.role + ')' }))" />
						</div>
					</div>

					<template #footer>
						<div class="flex justify-end gap-2">
							<UButton color="gray" variant="ghost" @click="isGroupModalOpen = false">Anuluj</UButton>
							<UButton color="black" @click="confirmGroupSelection"
								:disabled="!selectedGroupId || isFetchingGroups">Zatwierdz</UButton>
						</div>
					</template>
				</UCard>
			</template>
		</UModal>



	</div>
</template>
