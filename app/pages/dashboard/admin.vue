<script setup lang="ts">
	import type { Database, Tables } from "~/types/database.types"

	definePageMeta({
		layout: "dashboard",
	})

	const { t, locale } = useI18n()
	const intlLocale = computed(() => (locale.value === "en" ? "en-US" : "pl-PL"))
	const supabase = useSupabaseClient()
	const user = useSupabaseUser()
	const { fetchUserRoles, userRoles } = useUserRole()

	// Fetch user memberships and filter to admin groups
	const { data: adminGroups, refresh: refreshAdminGroups } = await useAsyncData(
		"adminGroups",
		async () => {
			if (!user.value) return []
			await fetchUserRoles()

			const adminGroupIds = Object.entries(userRoles.value)
				.filter(([, role]) => role === "admin")
				.map(([groupId]) => groupId)

			if (adminGroupIds.length === 0) return []

			const { data, error } = await supabase
				.from("groups")
				.select("*")
				.in("id", adminGroupIds)

			if (error) throw error
			return data ?? []
		},
		{ default: () => [] },
	)

	// Selected group state
	const selectedGroupId = ref<string | null>(null)
	const selectedGroup = computed(
		() => adminGroups.value.find((g) => g.id === selectedGroupId.value) || null,
	)

	// Fetch members for selected group
	const selectedGroupMembers = ref<Tables<"user_memberships">[]>([])
	const membersLoading = ref(false)

	const loadMembers = async () => {
		if (!selectedGroupId.value) {
			selectedGroupMembers.value = []
			return
		}
		membersLoading.value = true
		try {
			const { data, error } = await supabase
				.from("user_memberships")
				.select("*")
				.eq("group_id", selectedGroupId.value)

			if (error) throw error
			selectedGroupMembers.value = data ?? []
		} catch (err) {
			console.error("Failed to load members:", err)
		} finally {
			membersLoading.value = false
		}
	}

	// Fetch child groups
	const childGroups = ref<Tables<"groups">[]>([])
	const subgroupsLoading = ref(false)

	const loadChildGroups = async () => {
		if (!selectedGroupId.value || !selectedGroup.value) {
			childGroups.value = []
			return
		}
		subgroupsLoading.value = true
		try {
			const type = selectedGroup.value.type as Database["public"]["Enums"]["group_type"]

			if (type === "university") {
				const { data: facultiesData } = await supabase
					.from("faculties")
					.select("id")
					.eq("university_id", selectedGroupId.value)

				if (facultiesData?.length) {
					const facultyIds = facultiesData.map((f) => f.id)
					const { data: groupsData } = await supabase
						.from("groups")
						.select("*")
						.in("id", facultyIds)
					childGroups.value = groupsData ?? []
				} else {
					childGroups.value = []
				}
			} else if (type === "faculty") {
				const { data: coursesData } = await supabase
					.from("courses")
					.select("id")
					.eq("faculty_id", selectedGroupId.value)

				if (coursesData?.length) {
					const courseIds = coursesData.map((c) => c.id)
					const { data: groupsData } = await supabase
						.from("groups")
						.select("*")
						.in("id", courseIds)
					childGroups.value = groupsData ?? []
				} else {
					childGroups.value = []
				}
			} else if (type === "course") {
				const { data: classesData } = await supabase
					.from("classes")
					.select("id")
					.eq("course_id", selectedGroupId.value)

				if (classesData?.length) {
					const classIds = classesData.map((c) => c.id)
					const { data: groupsData } = await supabase
						.from("groups")
						.select("*")
						.in("id", classIds)
					childGroups.value = groupsData ?? []
				} else {
					childGroups.value = []
				}
			} else {
				childGroups.value = []
			}
		} catch (err) {
			console.error("Failed to load child groups:", err)
		} finally {
			subgroupsLoading.value = false
		}
	}

	// Fetch files for selected group (notes, quizzes, summaries)
	type FileType = Database["public"]["Enums"]["file_type"]
	const groupFiles = ref<Tables<"files">[]>([])
	const filesLoading = ref(false)

	const loadFiles = async () => {
		if (!selectedGroupId.value) {
			groupFiles.value = []
			return
		}
		filesLoading.value = true
		try {
			const { data, error } = await supabase
				.from("files")
				.select("*")
				.eq("group_id", selectedGroupId.value)
				.in("file_type", ["note", "quiz", "summary"] as FileType[])
				.order("created_at", { ascending: false })

			if (error) throw error
			groupFiles.value = data ?? []
		} catch (err) {
			console.error("Failed to load files:", err)
		} finally {
			filesLoading.value = false
		}
	}

	// Filter files by type
	const notes = computed(() => groupFiles.value.filter(f => f.file_type === "note"))
	const quizzes = computed(() => groupFiles.value.filter(f => f.file_type === "quiz"))
	const summaries = computed(() => groupFiles.value.filter(f => f.file_type === "summary"))

	// Delete file
	const deleteFile = async (fileId: string) => {
		if (!confirm(t("admin.alerts.deleteFile"))) return
		try {
			// First get the file to delete from storage
			const file = groupFiles.value.find(f => f.id === fileId)
			if (file?.object_id) {
				await supabase.storage.from("files").remove([file.object_id])
			}
			// Then delete from db
			const { error } = await supabase
				.from("files")
				.delete()
				.eq("id", fileId)

			if (error) throw error
			loadFiles()
		} catch (err) {
			alert(t("admin.alerts.deleteFileFailed", { message: (err as Error).message }))
		}
	}

	// Watch for group selection changes
	watch(selectedGroupId, () => {
		if (selectedGroupId.value) {
			loadMembers()
			loadChildGroups()
			loadFiles()
		}
	}, { immediate: true })

	// Create subgroup
	const showCreateModal = ref(false)
	const createForm = ref({ name: "", semester: 1 })
	const creating = ref(false)

	const allowedChildType = computed(() => {
		if (!selectedGroup.value) return null
		const type = selectedGroup.value.type
		if (type === "university") return "faculty"
		if (type === "faculty") return "course"
		if (type === "course") return "class"
		return null
	})

	const createSubgroup = async () => {
		if (!selectedGroup.value || !createForm.value.name.trim()) return
		creating.value = true

		try {
			const groupName = createForm.value.name.trim()
			const type = selectedGroup.value.type
			let result: { data: any; error: any }

			if (type === "university") {
				result = await supabase.rpc("create_faculty", {
					p_name: groupName,
					p_university_id: selectedGroupId.value!,
				})
			} else if (type === "faculty") {
				result = await supabase.rpc("create_course", {
					p_name: groupName,
					p_faculty_id: selectedGroupId.value!,
				})
			} else if (type === "course") {
				result = await supabase.rpc("create_class", {
					p_name: groupName,
					p_course_id: selectedGroupId.value!,
					p_semester: createForm.value.semester,
				})
			} else {
				throw new Error(t("admin.alerts.cannotCreateChild"))
			}

			if (result.error) throw result.error

			const newGroupId = result.data
			if (newGroupId && user.value) {
				await supabase.from("user_memberships").insert({
					user_id: user.value.id,
					group_id: newGroupId,
					role: "admin",
				})
			}

			showCreateModal.value = false
			createForm.value = { name: "", semester: 1 }
			loadChildGroups()
			refreshAdminGroups()
			alert(t("admin.alerts.created"))
		} catch (error) {
			alert(t("admin.alerts.createFailed", { message: (error as Error).message }))
		} finally {
			creating.value = false
		}
	}

	// Role change
	const changeMemberRole = async (
		memberId: string,
		newRole: Tables<"user_memberships">["role"],
	) => {
		const { error } = await supabase
			.from("user_memberships")
			.update({ role: newRole })
			.eq("id", memberId)

		if (error) {
			alert(t("admin.alerts.roleUpdateFailed", { message: error.message }))
		} else {
			loadMembers()
		}
	}

	// Remove member
	const removeMember = async (memberId: string) => {
		if (!confirm(t("admin.alerts.removeMember"))) return
		const { error } = await supabase
			.from("user_memberships")
			.delete()
			.eq("id", memberId)

		if (error) {
			alert(t("admin.alerts.removeFailed", { message: error.message }))
		} else {
			loadMembers()
		}
	}

	// Add member
	const addMemberId = ref("")
	const addingMember = ref(false)

	const addMember = async () => {
		if (!addMemberId.value.trim() || !selectedGroupId.value || !user.value) return
		addingMember.value = true

		try {
			const targetUserId = addMemberId.value.trim()
			const { data: existing } = await supabase
				.from("user_memberships")
				.select("id")
				.eq("group_id", selectedGroupId.value)
				.eq("user_id", targetUserId)
				.maybeSingle()

			if (existing) {
				alert(t("admin.alerts.alreadyMember"))
				addingMember.value = false
				return
			}

			const { error: insertError } = await supabase
				.from("user_memberships")
				.insert({
					user_id: targetUserId,
					group_id: selectedGroupId.value,
					role: "student",
				})

			if (insertError) throw insertError
			addMemberId.value = ""
			loadMembers()
			alert(t("admin.alerts.memberAdded"))
		} catch (error) {
			alert(t("admin.alerts.addMemberFailed", { message: (error as Error).message }))
		} finally {
			addingMember.value = false
		}
	}

	const getGroupTypeColor = (type: string) => {
		switch (type) {
			case "university": return "primary"
			case "faculty": return "secondary"
			case "course": return "info"
			case "class": return "success"
			default: return "outline"
		}
	}

	const getFileTypeColor = (type: FileType) => {
		switch (type) {
			case "note": return "primary"
			case "quiz": return "warning"
			case "summary": return "success"
			default: return "outline"
		}
	}

	const formatFileSize = (bytes: number | null) => {
		if (!bytes) return t("admin.unknownSize")
		if (bytes < 1024) return bytes + " B"
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
		return (bytes / (1024 * 1024)).toFixed(1) + " MB"
	}

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString(intlLocale.value, {
			month: "short",
			day: "numeric",
			year: "numeric",
		})
	}

	// Tabs: "members" | "subgroups" | "content"
	const activeTab = ref<"members" | "subgroups" | "content">("members")
	// Sub-tabs for content: "notes" | "quizzes" | "summaries"
	const contentTab = ref<"notes" | "quizzes" | "summaries">("notes")
</script>

<template>
	<UDashboardPanel>
		<template #header>
			<UDashboardNavbar :title="t('admin.title')">
				<template #leading>
					<UDashboardSidebarCollapse />
				</template>
			</UDashboardNavbar>
		</template>

		<template #body>
			<div class="flex-1 overflow-y-auto p-6">
				<!-- No Admin Access -->
				<div v-if="!adminGroups?.length" class="flex flex-col items-center justify-center h-96">
					<div class="text-6xl mb-4">🔒</div>
					<h2 class="text-xl font-semibold mb-2">{{ t('admin.noAccessTitle') }}</h2>
					<p class="text-gray-500">{{ t('admin.noAccessDescription') }}</p>
				</div>

				<!-- Admin Dashboard -->
				<div v-else class="max-w-5xl mx-auto space-y-6">
					<!-- Header -->
					<div>
						<h1 class="text-2xl font-bold">{{ t('admin.title') }}</h1>
						<p class="text-sm text-gray-500">
							{{ t('admin.adminOfGroups', { count: adminGroups.length }) }}
						</p>
					</div>

					<!-- Group Selector -->
					<UCard>
						<template #header>
							<h2 class="font-semibold">{{ t('admin.selectGroup') }}</h2>
						</template>
						<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
							<button
								v-for="group in adminGroups"
								:key="group.id"
								@click="selectedGroupId = group.id"
								class="p-4 rounded-lg border-2 text-left transition-all hover:border-primary-500 flex items-center gap-3"
								:class="selectedGroupId === group.id
									? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
									: 'border-gray-200 dark:border-gray-700'"
							>
								<div
									class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0"
									:style="{ backgroundColor: `hsl(${group.name.charCodeAt(0) * 10}, 60%, 50%)` }"
								>
									{{ group.name.charAt(0).toUpperCase() }}
								</div>
								<div class="min-w-0 flex-1">
									<div class="font-medium truncate">{{ group.name }}</div>
									<UBadge :color="getGroupTypeColor(group.type)" size="xs" class="mt-1">
										{{ t(`groupType.${group.type}`) }}
									</UBadge>
								</div>
							</button>
						</div>
					</UCard>

					<!-- Selected Group Management -->
					<template v-if="selectedGroup">
						<UCard>
							<template #header>
								<div class="flex items-center justify-between">
									<div>
										<h2 class="font-semibold text-lg">{{ t('admin.managing', { name: selectedGroup.name }) }}</h2>
										<span class="text-xs text-gray-500 uppercase">{{ t(`groupType.${selectedGroup.type}`) }}</span>
									</div>
								</div>
							</template>

							<!-- Tab Navigation -->
							<div class="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-4">
								<button
									@click="activeTab = 'members'"
									class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
									:class="activeTab === 'members'
										? 'border-primary-500 text-primary-600'
										: 'border-transparent text-gray-500 hover:text-gray-700'"
								>
									{{ t('admin.tabs.members') }}
								</button>
								<button
									@click="activeTab = 'subgroups'"
									class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
									:class="activeTab === 'subgroups'
										? 'border-primary-500 text-primary-600'
										: 'border-transparent text-gray-500 hover:text-gray-700'"
								>
									{{ t('admin.tabs.subgroups') }}
								</button>
								<button
									@click="activeTab = 'content'"
									class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
									:class="activeTab === 'content'
										? 'border-primary-500 text-primary-600'
										: 'border-transparent text-gray-500 hover:text-gray-700'"
								>
									{{ t('admin.tabs.content') }}
								</button>
							</div>

							<!-- Members Tab -->
							<div v-if="activeTab === 'members'" class="space-y-4">
								<UCard>
									<template #header>
										<h3 class="font-semibold">{{ t('admin.addMember') }}</h3>
									</template>
									<div class="flex gap-2">
										<UInput
											v-model="addMemberId"
											:placeholder="t('admin.enterUserId')"
											class="flex-1"
											@keyup.enter="addMember"
										/>
										<UButton :loading="addingMember" @click="addMember" :disabled="!addMemberId.trim()">
											{{ t('admin.add') }}
										</UButton>
									</div>
								</UCard>

								<UCard>
									<template #header>
										<h3 class="font-semibold">{{ t('admin.members', { count: selectedGroupMembers.length }) }}</h3>
									</template>
									<div v-if="membersLoading" class="text-center py-4 text-gray-500">
										{{ t('common.loading') }}
									</div>
									<div v-else-if="selectedGroupMembers.length" class="divide-y">
										<div
											v-for="member in selectedGroupMembers"
											:key="member.id"
											class="flex items-center justify-between py-3 px-2 hover:bg-gray-50 dark:hover:bg-gray-800/50"
										>
											<div class="flex items-center gap-3">
												<UAvatar
													:placeholder="member.user_id.charAt(0).toUpperCase()"
													size="md"
												/>
												<div>
													<div class="font-medium text-sm">
														{{ t('admin.user', { id: member.user_id.slice(0, 8) }) }}
													</div>
													<div class="text-xs text-gray-500">{{ t('admin.memberId', { id: member.user_id }) }}</div>
												</div>
											</div>
											<div class="flex items-center gap-2">
												<USelect
													:modelValue="member.role"
													:items="[
														{ label: t('role.student'), value: 'student' },
														{ label: t('role.instructor'), value: 'instructor' },
														{ label: t('role.admin'), value: 'admin' },
													]"
													size="sm"
													@update:modelValue="(role) => changeMemberRole(member.id, role as Tables<'user_memberships'>['role'])"
												/>
												<UButton
													variant="ghost"
													color="error"
													size="sm"
													@click="removeMember(member.id)"
												>
													{{ t('admin.remove') }}
												</UButton>
											</div>
										</div>
									</div>
									<div v-else class="text-center py-8 text-gray-500">
										{{ t('admin.noMembers') }}
									</div>
								</UCard>
							</div>

							<!-- Subgroups Tab -->
							<div v-if="activeTab === 'subgroups'" class="space-y-4">
								<UCard v-if="allowedChildType">
									<template #header>
										<div class="flex items-center justify-between">
											<div>
												<h3 class="font-semibold">{{ t('admin.createType', { type: t(`groupType.${allowedChildType}`) }) }}</h3>
												<p class="text-xs text-gray-500 mt-1">
													{{ t('admin.createTypeUnder', { type: t(`groupType.${allowedChildType}`), name: selectedGroup.name }) }}
												</p>
											</div>
											<UButton size="sm" @click="showCreateModal = true">
												{{ t('admin.create') }}
											</UButton>
										</div>
									</template>
								</UCard>

								<UCard>
									<template #header>
										<h3 class="font-semibold">{{ t('admin.subgroups', { count: childGroups.length }) }}</h3>
									</template>
									<div v-if="subgroupsLoading" class="text-center py-4 text-gray-500">
										{{ t('common.loading') }}
									</div>
									<div v-else-if="childGroups.length" class="divide-y">
										<div
											v-for="child in childGroups"
											:key="child.id"
											class="flex items-center gap-3 py-3 px-2"
										>
											<div class="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-medium">
												{{ child.name.charAt(0).toUpperCase() }}
											</div>
											<div>
												<div class="font-medium text-sm">{{ child.name }}</div>
												<UBadge :color="getGroupTypeColor(child.type)" size="xs">{{ t(`groupType.${child.type}`) }}</UBadge>
											</div>
										</div>
									</div>
									<div v-else class="text-center py-8 text-gray-500">
										{{ t('admin.noSubgroups') }}
									</div>
								</UCard>
							</div>

							<!-- Content Tab -->
							<div v-if="activeTab === 'content'" class="space-y-4">
								<!-- Content Sub-tabs -->
								<div class="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-4">
									<button
										@click="contentTab = 'notes'"
										class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
										:class="contentTab === 'notes'
											? 'border-primary-500 text-primary-600'
											: 'border-transparent text-gray-500 hover:text-gray-700'"
									>
										{{ t('admin.notes', { count: notes.length }) }}
									</button>
									<button
										@click="contentTab = 'quizzes'"
										class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
										:class="contentTab === 'quizzes'
											? 'border-primary-500 text-primary-600'
											: 'border-transparent text-gray-500 hover:text-gray-700'"
									>
										{{ t('admin.quizzes', { count: quizzes.length }) }}
									</button>
									<button
										@click="contentTab = 'summaries'"
										class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
										:class="contentTab === 'summaries'
											? 'border-primary-500 text-primary-600'
											: 'border-transparent text-gray-500 hover:text-gray-700'"
									>
										{{ t('admin.summaries', { count: summaries.length }) }}
									</button>
								</div>

								<UCard>
									<template #header>
										<h3 class="font-semibold capitalize">{{ t(`nav.${contentTab}`) }}</h3>
									</template>
									<div v-if="filesLoading" class="text-center py-4 text-gray-500">
										{{ t('common.loading') }}
									</div>
									<div v-else-if="contentTab === 'notes' && notes.length">
										<div class="divide-y">
											<div
												v-for="file in notes"
												:key="file.id"
												class="flex items-center justify-between py-3 px-2 hover:bg-gray-50 dark:hover:bg-gray-800/50"
											>
												<div class="flex items-center gap-3">
													<div class="w-8 h-8 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
														<span class="text-blue-600 dark:text-blue-400 text-xs font-bold">N</span>
													</div>
													<div>
														<div class="font-medium text-sm">{{ file.name }}</div>
														<div class="text-xs text-gray-500">
															{{ formatFileSize(file.size) }} • {{ formatDate(file.created_at) }}
														</div>
													</div>
												</div>
												<UButton variant="ghost" color="error" size="sm" @click="deleteFile(file.id)">
													{{ t('admin.delete') }}
												</UButton>
											</div>
										</div>
									</div>
									<div v-else-if="contentTab === 'quizzes' && quizzes.length">
										<div class="divide-y">
											<div
												v-for="file in quizzes"
												:key="file.id"
												class="flex items-center justify-between py-3 px-2 hover:bg-gray-50 dark:hover:bg-gray-800/50"
											>
												<div class="flex items-center gap-3">
													<div class="w-8 h-8 rounded bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
														<span class="text-amber-600 dark:text-amber-400 text-xs font-bold">Q</span>
													</div>
													<div>
														<div class="font-medium text-sm">{{ file.name }}</div>
														<div class="text-xs text-gray-500">
															{{ formatFileSize(file.size) }} • {{ formatDate(file.created_at) }}
														</div>
													</div>
												</div>
												<UButton variant="ghost" color="error" size="sm" @click="deleteFile(file.id)">
													{{ t('admin.delete') }}
												</UButton>
											</div>
										</div>
									</div>
									<div v-else-if="contentTab === 'summaries' && summaries.length">
										<div class="divide-y">
											<div
												v-for="file in summaries"
												:key="file.id"
												class="flex items-center justify-between py-3 px-2 hover:bg-gray-50 dark:hover:bg-gray-800/50"
											>
												<div class="flex items-center gap-3">
													<div class="w-8 h-8 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
														<span class="text-green-600 dark:text-green-400 text-xs font-bold">S</span>
													</div>
													<div>
														<div class="font-medium text-sm">{{ file.name }}</div>
														<div class="text-xs text-gray-500">
															{{ formatFileSize(file.size) }} • {{ formatDate(file.created_at) }}
														</div>
													</div>
												</div>
												<UButton variant="ghost" color="error" size="sm" @click="deleteFile(file.id)">
													{{ t('admin.delete') }}
												</UButton>
											</div>
										</div>
									</div>
									<div v-else class="text-center py-8 text-gray-500">
										{{ t('admin.noContent') }}
									</div>
								</UCard>
							</div>
						</UCard>
					</template>

					<!-- No Group Selected -->
					<div v-else class="text-center py-12 text-gray-500">
						{{ t('admin.selectGroupPrompt') }}
					</div>
				</div>
			</div>
		</template>
	</UDashboardPanel>

	<!-- Create Modal -->
	<UModal v-model:open="showCreateModal" :title="t('admin.createSubgroupTitle')">
		<template #body>
			<div class="space-y-4">
				<div>
					<label class="block text-sm font-medium mb-1">{{ t('admin.name') }}</label>
					<UInput v-model="createForm.name" :placeholder="t('admin.enterName')" />
				</div>
				<div v-if="allowedChildType === 'class'">
					<label class="block text-sm font-medium mb-1">{{ t('admin.semester') }}</label>
					<UInputNumber v-model="createForm.semester" :min="1" :max="20" />
				</div>
			</div>
		</template>
		<template #footer>
			<div class="flex justify-end gap-2">
				<UButton variant="outline" @click="showCreateModal = false">{{ t('common.cancel') }}</UButton>
				<UButton :loading="creating" @click="createSubgroup" :disabled="!createForm.name.trim()">
					{{ t('admin.createType', { type: t(`groupType.${allowedChildType}`) }) }}
				</UButton>
			</div>
		</template>
	</UModal>
</template>