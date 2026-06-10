<script setup lang="ts">
	import type { Database, Tables } from "~/types/database.types"

	definePageMeta({
		layout: "dashboard",
	})

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

	// Watch for group selection changes
	watch(selectedGroupId, () => {
		if (selectedGroupId.value) {
			loadMembers()
			loadChildGroups()
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
				throw new Error("Cannot create child groups for this type")
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
			alert("Created successfully!")
		} catch (error) {
			alert("Failed to create: " + (error as Error).message)
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
			alert("Failed to update role: " + error.message)
		} else {
			loadMembers()
		}
	}

	// Remove member
	const removeMember = async (memberId: string) => {
		if (!confirm("Remove this member?")) return
		const { error } = await supabase
			.from("user_memberships")
			.delete()
			.eq("id", memberId)

		if (error) {
			alert("Failed to remove: " + error.message)
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
				alert("User is already a member")
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
			alert("Member added!")
		} catch (error) {
			alert("Failed to add member: " + (error as Error).message)
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

	const activeTab = ref<"members" | "subgroups">("members")
</script>

<template>
	<UDashboardPanel>
		<template #header>
			<UDashboardNavbar title="Admin Dashboard">
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
					<h2 class="text-xl font-semibold mb-2">No Admin Access</h2>
					<p class="text-gray-500">You don't have admin privileges in any group yet.</p>
				</div>

				<!-- Admin Dashboard -->
				<div v-else class="max-w-5xl mx-auto space-y-6">
					<!-- Header -->
					<div>
						<h1 class="text-2xl font-bold">Admin Dashboard</h1>
						<p class="text-sm text-gray-500">
							{{ adminGroups.length }} group{{ adminGroups.length !== 1 ? "s" : "" }} you're admin of
						</p>
					</div>

					<!-- Group Selector -->
					<UCard>
						<template #header>
							<h2 class="font-semibold">Select a Group to Manage</h2>
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
										{{ group.type }}
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
										<h2 class="font-semibold text-lg">Managing: {{ selectedGroup.name }}</h2>
										<span class="text-xs text-gray-500 uppercase">{{ selectedGroup.type }}</span>
									</div>
								</div>
							</template>

							<!-- Simple Tab Navigation -->
							<div class="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-4">
								<button
									@click="activeTab = 'members'"
									class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
									:class="activeTab === 'members'
										? 'border-primary-500 text-primary-600'
										: 'border-transparent text-gray-500 hover:text-gray-700'"
								>
									Members ({{ selectedGroupMembers.length }})
								</button>
								<button
									@click="activeTab = 'subgroups'"
									class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
									:class="activeTab === 'subgroups'
										? 'border-primary-500 text-primary-600'
										: 'border-transparent text-gray-500 hover:text-gray-700'"
								>
									Subgroups ({{ childGroups.length }})
								</button>
							</div>

							<!-- Members Tab -->
							<div v-if="activeTab === 'members'" class="space-y-4">
								<UCard>
									<template #header>
										<h3 class="font-semibold">Add Member</h3>
									</template>
									<div class="flex gap-2">
										<UInput
											v-model="addMemberId"
											placeholder="Enter user ID..."
											class="flex-1"
											@keyup.enter="addMember"
										/>
										<UButton :loading="addingMember" @click="addMember" :disabled="!addMemberId.trim()">
											Add
										</UButton>
									</div>
								</UCard>

								<UCard>
									<template #header>
										<h3 class="font-semibold">Members</h3>
									</template>
									<div v-if="membersLoading" class="text-center py-4 text-gray-500">
										Loading...
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
													<div class="font-medium text-sm">{{ member.user_id.slice(0, 20) }}...</div>
													<div class="text-xs text-gray-500">ID: {{ member.user_id.slice(0, 12) }}...</div>
												</div>
											</div>
											<div class="flex items-center gap-2">
												<USelect
													:modelValue="member.role"
													:items="[
														{ label: 'Student', value: 'student' },
														{ label: 'Instructor', value: 'instructor' },
														{ label: 'Admin', value: 'admin' },
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
													Remove
												</UButton>
											</div>
										</div>
									</div>
									<div v-else class="text-center py-8 text-gray-500">
										No members yet
									</div>
								</UCard>
							</div>

							<!-- Subgroups Tab -->
							<div v-if="activeTab === 'subgroups'" class="space-y-4">
								<UCard v-if="allowedChildType">
									<template #header>
										<div class="flex items-center justify-between">
											<div>
												<h3 class="font-semibold">Create {{ allowedChildType }}</h3>
												<p class="text-xs text-gray-500 mt-1">
													Add a new {{ allowedChildType }} under {{ selectedGroup.name }}
												</p>
											</div>
											<UButton size="sm" @click="showCreateModal = true">
												Create
											</UButton>
										</div>
									</template>
								</UCard>

								<UCard>
									<template #header>
										<h3 class="font-semibold">Subgroups</h3>
									</template>
									<div v-if="subgroupsLoading" class="text-center py-4 text-gray-500">
										Loading...
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
												<UBadge :color="getGroupTypeColor(child.type)" size="xs">{{ child.type }}</UBadge>
											</div>
										</div>
									</div>
									<div v-else class="text-center py-8 text-gray-500">
										No subgroups yet
									</div>
								</UCard>
							</div>
						</UCard>
					</template>

					<!-- No Group Selected -->
					<div v-else class="text-center py-12 text-gray-500">
						Select a group above to manage it
					</div>
				</div>
			</div>
		</template>
	</UDashboardPanel>

	<!-- Create Modal -->
	<UModal v-model:open="showCreateModal" title="Create Subgroup">
		<template #body>
			<div class="space-y-4">
				<div>
					<label class="block text-sm font-medium mb-1">Name</label>
					<UInput v-model="createForm.name" placeholder="Enter name..." />
				</div>
				<div v-if="allowedChildType === 'class'">
					<label class="block text-sm font-medium mb-1">Semester</label>
					<UInputNumber v-model="createForm.semester" :min="1" :max="20" />
				</div>
			</div>
		</template>
		<template #footer>
			<div class="flex justify-end gap-2">
				<UButton variant="outline" @click="showCreateModal = false">Cancel</UButton>
				<UButton :loading="creating" @click="createSubgroup" :disabled="!createForm.name.trim()">
					Create {{ allowedChildType }}
				</UButton>
			</div>
		</template>
	</UModal>
</template>