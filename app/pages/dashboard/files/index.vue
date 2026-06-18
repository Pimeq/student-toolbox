<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useFiles } from '~/composables/useFiles'
import type { StoredFile } from '~/composables/useFiles'

definePageMeta({
	layout: 'dashboard',
})

const { files, fetchFiles, uploadFile, deleteFile, downloadFile, setFileVisibility, getUserGroups } = useFiles()

const isLoading = ref(true)
const isUploading = ref(false)
const isDragging = ref(false)
const uploadError = ref<string | null>(null)

const isGroupModalOpen = ref(false)
const targetFileId = ref<string | null>(null)
const userGroups = ref<any[]>([])
const selectedGroupId = ref<string>('')
const isFetchingGroups = ref(false)
const isDownloading = ref<string | null>(null)

onMounted(async () => {
	try {
		isLoading.value = true
		await fetchFiles()
	} finally {
		isLoading.value = false
	}
})

const personalFiles = computed(() => files.value.filter(f => f.visibility === 'personal'))
const sharedFiles = computed(() => files.value.filter(f => f.visibility === 'shared'))
const sections = computed(() => [
	{ key: 'personal', label: 'Personal', files: personalFiles.value },
	{ key: 'shared', label: 'Shared', files: sharedFiles.value },
])

const fileInputRef = ref<HTMLInputElement | null>(null)

const triggerUpload = () => fileInputRef.value?.click()

const handleFileInput = async (event: Event) => {
	const input = event.target as HTMLInputElement
	if (!input.files?.length) return
	await uploadFiles(Array.from(input.files))
	input.value = ''
}

const uploadFiles = async (fileList: File[]) => {
	isUploading.value = true
	uploadError.value = null
	let failed = 0

	for (const file of fileList) {
		try {
			await uploadFile(file)
		} catch (err: any) {
			console.error('Błąd uploadu:', err)
			failed++
		}
	}

	isUploading.value = false
	if (failed > 0) {
		uploadError.value = `Nie udało się przesłać ${failed} pliku/plików.`
	}
}

const onDragOver = (e: DragEvent) => {
	e.preventDefault()
	isDragging.value = true
}
const onDragLeave = () => { isDragging.value = false }
const onDrop = async (e: DragEvent) => {
	e.preventDefault()
	isDragging.value = false
	const dropped = Array.from(e.dataTransfer?.files || [])
	if (dropped.length) await uploadFiles(dropped)
}

const handleDownload = async (file: StoredFile) => {
	try {
		isDownloading.value = file.id
		await downloadFile(file.id)
	} catch (err: any) {
		alert(err?.message || 'Nie udało się pobrać pliku.')
	} finally {
		isDownloading.value = null
	}
}

const handleDelete = async (file: StoredFile) => {
	if (!confirm(`Czy na pewno chcesz usunąć "${file.name}"?`)) return
	try {
		await deleteFile(file.id)
	} catch (err: any) {
		alert(err?.message || 'Nie udało się usunąć pliku.')
	}
}

const openGroupModal = async (fileId: string) => {
	targetFileId.value = fileId
	isGroupModalOpen.value = true
	isFetchingGroups.value = true
	try {
		const groups = await getUserGroups()
		userGroups.value = groups
		selectedGroupId.value = groups[0]?.id || ''
	} catch (err) {
		console.error('Błąd pobierania grup', err)
	} finally {
		isFetchingGroups.value = false
	}
}

const confirmGroupSelection = async () => {
	if (!targetFileId.value || !selectedGroupId.value) return
	try {
		await setFileVisibility(targetFileId.value, 'shared', selectedGroupId.value)
		isGroupModalOpen.value = false
	} catch (err: any) {
		alert(err?.message || 'Nie udało się udostępnić pliku.')
	}
}

const handleToggleVisibility = async (file: StoredFile) => {
	if (!file.is_owner) return
	try {
		if (file.visibility === 'personal') {
			await openGroupModal(file.id)
		} else {
			await setFileVisibility(file.id, 'personal')
		}
	} catch (err: any) {
		alert(err?.message || 'Nie udało się zmienić widoczności.')
	}
}

const formatSize = (bytes: number | null) => {
	if (!bytes) return '—'
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

const formatDate = (dateString: string) => {
	const date = new Date(dateString)
	const now = new Date()
	const diff = now.getTime() - date.getTime()
	if (diff < 86400000 && date.getDate() === now.getDate()) {
		return `Dzisiaj o ${date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`
	}
	if (diff < 172800000) {
		return `Wczoraj o ${date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`
	}
	return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
}

const getFileIcon = (mimeType: string | null) => {
	if (!mimeType) return 'i-lucide-file'
	if (mimeType.startsWith('image/')) return 'i-lucide-image'
	if (mimeType.startsWith('video/')) return 'i-lucide-file-video'
	if (mimeType.startsWith('audio/')) return 'i-lucide-file-audio'
	if (mimeType === 'application/pdf') return 'i-lucide-file-text'
	if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z') || mimeType.includes('tar')) return 'i-lucide-file-archive'
	if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('xml')) return 'i-lucide-file-code'
	if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return 'i-lucide-file-spreadsheet'
	if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'i-lucide-presentation'
	if (mimeType.includes('word') || mimeType.includes('document')) return 'i-lucide-file-text'
	return 'i-lucide-file'
}

const getFileIconColor = (mimeType: string | null) => {
	if (!mimeType) return 'text-gray-400'
	if (mimeType.startsWith('image/')) return 'text-purple-500'
	if (mimeType.startsWith('video/')) return 'text-pink-500'
	if (mimeType.startsWith('audio/')) return 'text-yellow-500'
	if (mimeType === 'application/pdf') return 'text-red-500'
	if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z') || mimeType.includes('tar')) return 'text-amber-500'
	if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('xml')) return 'text-blue-500'
	if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return 'text-emerald-500'
	if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'text-orange-500'
	if (mimeType.includes('word') || mimeType.includes('document')) return 'text-sky-500'
	return 'text-gray-400'
}
</script>

<template>
	<div class="flex-1 min-h-0 flex flex-col min-w-0">
		<header
			class="h-16 shrink-0 border-b border-gray-200 dark:border-gray-800 px-4 flex items-center gap-4 bg-white dark:bg-gray-900">
			<UButton color="neutral" variant="ghost" icon="i-heroicons-bars-3" class="lg:hidden" />
			<h1 class="text-xl font-bold font-sans">Pliki</h1>
		</header>

		<div
			class="flex-1 min-h-0 overflow-y-auto bg-gray-50/50 dark:bg-gray-900/20 p-8 pt-6 pb-24 md:pb-8"
			@dragover="onDragOver"
			@dragleave="onDragLeave"
			@drop="onDrop"
		>
			<!-- Toolbar -->
			<div
				class="mb-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur p-3">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<p class="text-sm text-gray-500 dark:text-gray-400">
						{{ files.length }} {{ files.length === 1 ? 'plik' : 'pliki/plików' }}
					</p>
					<div class="flex items-center gap-2">
						<input
							ref="fileInputRef"
							type="file"
							multiple
							class="hidden"
							@change="handleFileInput"
						/>
						<UButton
							:loading="isUploading"
							icon="i-lucide-upload"
							size="sm"
							color="neutral"
							variant="solid"
							@click="triggerUpload"
						>
							Prześlij plik
						</UButton>
					</div>
				</div>
				<p v-if="uploadError" class="mt-2 text-xs text-red-500">{{ uploadError }}</p>
			</div>

			<!-- Drop zone overlay -->
			<div
				v-if="isDragging"
				class="fixed inset-0 z-50 flex items-center justify-center bg-primary-500/10 border-2 border-dashed border-primary-400 pointer-events-none"
			>
				<div class="flex flex-col items-center gap-3 text-primary-600 dark:text-primary-400">
					<UIcon name="i-lucide-upload-cloud" class="w-16 h-16" />
					<p class="text-lg font-semibold">Upuść pliki tutaj</p>
				</div>
			</div>

			<!-- Loading -->
			<div v-if="isLoading" class="flex flex-col items-center justify-center h-64 gap-3 text-gray-500 dark:text-gray-400">
				<UIcon name="i-lucide-loader-2" class="w-6 h-6 animate-spin" />
				<p class="text-sm">Ładowanie plików...</p>
			</div>

			<!-- Empty state -->
			<div
				v-else-if="files.length === 0"
				class="flex flex-col items-center justify-center h-64 text-center space-y-4"
			>
				<UIcon name="i-lucide-folder-open" class="w-16 h-16 text-gray-300 dark:text-gray-600" />
				<div>
					<h3 class="text-lg font-medium text-gray-900 dark:text-white">Brak plików</h3>
					<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Prześlij swój pierwszy plik lub przeciągnij go tutaj.</p>
				</div>
				<UButton :loading="isUploading" icon="i-lucide-upload" color="neutral" variant="solid" @click="triggerUpload">
					Prześlij plik
				</UButton>
			</div>

			<!-- File sections -->
			<div v-else class="space-y-8">
				<section v-for="section in sections" :key="section.key" class="space-y-3">
					<div class="flex items-center justify-between">
						<h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
							{{ section.label }}
						</h2>
						<span
							class="text-xs px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
							{{ section.files.length }}
						</span>
					</div>

					<div
						v-if="section.files.length === 0"
						class="text-sm text-gray-500 dark:text-gray-400 bg-white/70 dark:bg-gray-900/30 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-4"
					>
						Brak plików w sekcji {{ section.label }}.
					</div>

					<div v-else class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
						<div
							v-for="(file, index) in section.files"
							:key="file.id"
							:class="[
								'flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
								index !== section.files.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''
							]"
						>
							<!-- Icon -->
							<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
								<UIcon
									:name="getFileIcon(file.mime_type)"
									:class="['h-[18px] w-[18px] shrink-0', getFileIconColor(file.mime_type)]"
								/>
							</div>

							<!-- Name + meta -->
							<div class="flex-1 min-w-0">
								<p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ file.name }}</p>
								<div class="flex items-center gap-2 mt-0.5 flex-wrap">
									<span class="text-xs text-gray-400">{{ formatSize(file.size) }}</span>
									<span class="text-gray-300 dark:text-gray-600">·</span>
									<span class="text-xs text-gray-400">{{ formatDate(file.created_at) }}</span>
									<span v-if="file.group_name" class="inline-flex items-center rounded-md border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
										{{ file.group_name }}
									</span>
								</div>
							</div>

							<!-- Visibility badge -->
							<UButton
								v-if="file.is_owner"
								size="xs"
								color="neutral"
								variant="outline"
								:class="[
									'shrink-0 font-semibold transition-all duration-150',
									file.visibility === 'shared'
										? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
										: 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
								]"
								:title="file.visibility === 'shared' ? 'Udostępniony — kliknij aby ustawić prywatny' : 'Prywatny — kliknij aby udostępnić'"
								@click="handleToggleVisibility(file)"
							>
								{{ file.visibility === 'shared' ? 'Sh' : 'Ps' }}
							</UButton>
							<span
								v-else
								:class="[
									'shrink-0 text-xs px-2 py-1 rounded-md font-semibold border',
									'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
								]"
							>
								Sh
							</span>

							<!-- Actions -->
							<div class="flex items-center gap-1 shrink-0">
								<UButton
									:loading="isDownloading === file.id"
									icon="i-lucide-download"
									color="neutral"
									variant="ghost"
									size="xs"
									title="Pobierz"
									@click="handleDownload(file)"
								/>
								<UButton
									v-if="file.is_owner"
									icon="i-lucide-trash"
									color="error"
									variant="ghost"
									size="xs"
									title="Usuń"
									@click="handleDelete(file)"
								/>
							</div>
						</div>
					</div>
				</section>
			</div>
		</div>

		<!-- Share modal -->
		<UModal v-model:open="isGroupModalOpen">
			<template #content>
				<UCard>
					<template #header>
						<h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
							Udostępnij plik
						</h3>
					</template>

					<div class="p-4 space-y-4">
						<p class="text-sm text-gray-500 dark:text-gray-400">Zaznacz grupę z poniższej listy:</p>
						<div v-if="isFetchingGroups" class="flex justify-center py-4">
							<UIcon name="i-lucide-loader-2" class="w-6 h-6 animate-spin text-gray-500" />
						</div>
						<div v-else-if="userGroups.length === 0" class="text-sm text-red-500 py-2">
							Nie masz dodanych żadnych grup uczelnianych!
						</div>
						<div v-else class="space-y-3 pl-1">
							<URadioGroup
								v-model="selectedGroupId"
								name="file-group-selection"
								:items="userGroups.map(g => ({ value: g.id, label: g.name + ' (' + g.type + ' - Rola: ' + g.role + ')' }))"
							/>
						</div>
					</div>

					<template #footer>
						<div class="flex justify-end gap-2">
							<UButton color="neutral" variant="ghost" @click="isGroupModalOpen = false">Anuluj</UButton>
							<UButton
								color="neutral"
								:disabled="!selectedGroupId || isFetchingGroups"
								@click="confirmGroupSelection"
							>
								Zatwierdź
							</UButton>
						</div>
					</template>
				</UCard>
			</template>
		</UModal>
	</div>
</template>
