<script setup lang="ts">
const supabase = useSupabaseClient()
const user = useSupabaseUser()

type MembershipWithGroup = {
	group_id: string
	role: string
	group?: {
		type: string
		name: string
	} | null
}

definePageMeta({ layout: "dashboard" })

const { data: userGroups } = await useAsyncData(
	"userGroups",
	async () => {
		if (!user.value) return []
		const { data, error } = await supabase
			.from("user_memberships")
			.select("id, group_id, role, group:groups(type, name)")
			.eq("user_id", user.value.sub)
		if (error) throw error
		return data ?? []
	},
	{ default: () => [] },
)

const visibleUserGroups = computed(() =>
	((userGroups.value ?? []) as MembershipWithGroup[]).filter(
		(g) => g.group?.type !== "personal",
	),
)

const visibleUserGroupIds = computed(() =>
	visibleUserGroups.value.map((g) => g.group_id),
)

const academicGroupTypes = ["university", "faculty", "course"]
const allowedGroupIds = computed(() =>
	visibleUserGroups.value
		.filter((g) => academicGroupTypes.includes(g.group?.type ?? ""))
		.map((g) => g.group_id),
)

const { data: upcomingEvents } = await useAsyncData(
	"upcomingEvents",
	async () => {
		if (!user.value) return []
		const gids = allowedGroupIds.value || []
		if (gids.length === 0) return []
		const { data, error } = await supabase
			.from("events")
			.select("id, title, starts_at, ends_at, group_id, group:groups(type, name)")
			.in("group_id", gids)
			.order("starts_at", { ascending: true })
			.limit(3)
		if (error) throw error
		return data ?? []
	},
	{ default: () => [] },
)

const { data: recentFiles } = await useAsyncData(
	"recentFiles",
	async () => {
		if (!user.value) return []
		const gids = visibleUserGroupIds.value || []
		if (gids.length === 0) return []
		const { data, error } = await supabase
			.from("files")
			.select("id, name, file_type, created_at, group_id")
			.in("group_id", gids)
			.order("created_at", { ascending: false })
			.limit(6)
		if (error) throw error
		return data ?? []
	},
	{ default: () => [] },
)

const { data: resourceFiles } = await useAsyncData(
	"resourceFiles",
	async () => {
		if (!user.value) return []
		const gids = visibleUserGroupIds.value || []
		if (gids.length === 0) return []
		const { data, error } = await supabase
			.from("files")
			.select("id, file_type, group_id")
			.in("group_id", gids)
		if (error) throw error
		return data ?? []
	},
	{ default: () => [] },
)

const resourceStats = computed(() => {
	const files = (resourceFiles.value || []) as Array<{ file_type: string }>
	const acc = { notes: 0, summaries: 0, quizzes: 0, files: files.length }

	for (const f of files) {
		if (f.file_type === "note") acc.notes += 1
		if (f.file_type === "summary") acc.summaries += 1
		if (f.file_type === "quiz") acc.quizzes += 1
	}

	return {
		notes: acc.notes,
		summaries: acc.summaries,
		quizzes: acc.quizzes,
		files: acc.files,
	}
})

const getInitials = (name: string | undefined) => {
	if (!name) return "?"
	return name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()
}

const formatDate = (d: string | null | undefined) => {
	if (!d) return "—"
	try {
		return new Date(d).toLocaleString("pl-PL", {
			dateStyle: "short",
			timeStyle: "short",
		})
	} catch {
		return d
	}
}

const groupVisuals: Record<string, { badgeClass: string; avatarClass: string; dotColor: string }> = {
	university: { badgeClass: "badge-uni", avatarClass: "av-teal", dotColor: "#1D9E75" },
	faculty: { badgeClass: "badge-fac", avatarClass: "av-blue", dotColor: "#185FA5" },
	course: { badgeClass: "badge-course", avatarClass: "av-amber", dotColor: "#BA7517" },
}

const groupTypeBadge = (type: string | undefined) => ({
	label: type ?? "—",
	cls: groupVisuals[type ?? ""]?.badgeClass ?? "badge-default",
})

const groupAvatarCls = (type: string | undefined) =>
	groupVisuals[type ?? ""]?.avatarClass ?? "av-gray"

const eventDotColor = (type: string | undefined) =>
	groupVisuals[type ?? ""]?.dotColor ?? "#888780"

const selectedGroupId = ref<string | null>(null)
const isGroupModalOpen = ref(false)

const openGroupModal = (groupId: string) => {
	memberPage.value = 1
	selectedGroupId.value = groupId
	isGroupModalOpen.value = true
}

const selectedGroupData = computed(() =>
	visibleUserGroups.value.find((g: MembershipWithGroup) => g.group_id === selectedGroupId.value),
)

const groupMembers = ref<Array<{ id: string; user_id: string; role: string; created_at: string }>>([])

watch(selectedGroupId, async (newGroupId) => {
	if (!newGroupId) {
		groupMembers.value = []
		return
	}
	const { data, error } = await supabase
		.from("user_memberships")
		.select("id, user_id, role, created_at")
		.eq("group_id", newGroupId)
		.order("created_at", { ascending: false })
	if (error) {
		console.error("Error fetching members:", error)
		return
	}
	groupMembers.value = data ?? []
})

const memberPageSize = 10
const memberPage = ref(1)

watch(isGroupModalOpen, (isOpen) => {
	if (!isOpen) {
		memberPage.value = 1
		setTimeout(() => { selectedGroupId.value = null }, 200)
	}
})

const memberPageCount = computed(() =>
	Math.max(1, Math.ceil((groupMembers.value?.length ?? 0) / memberPageSize)),
)

const pagedMembers = computed(() => {
	const start = (memberPage.value - 1) * memberPageSize
	return (groupMembers.value ?? []).slice(start, start + memberPageSize)
})

const canMemberGoPrev = computed(() => memberPage.value > 1)
const canMemberGoNext = computed(() => memberPage.value < memberPageCount.value)

const memberGoPrev = () => { if (canMemberGoPrev.value) memberPage.value -= 1 }
const memberGoNext = () => { if (canMemberGoNext.value) memberPage.value += 1 }
</script>

<template>
	<div class="page-wrapper">
		<NewUserModal :show="visibleUserGroups.length === 0" />

		<UDashboardPanel>
			<template #header>
				<UDashboardNavbar title="Dashboard">
					<template #leading>
						<UDashboardSidebarCollapse />
					</template>
				</UDashboardNavbar>
			</template>

			<div class="db-root">

				<!-- Top stats row -->
				<div class="stats-row">
					<div class="stat-card">
						<div class="stat-icon icon-blue">
							<UIcon name="i-lucide-users" class="w-3.5 h-3.5" style="color:#185FA5" />
						</div>
						<div class="stat-label">Grupy</div>
						<div class="stat-num">{{ visibleUserGroups.length }}</div>
						<div class="stat-sub">Twoje aktywne grupy</div>
					</div>

					<div class="stat-card">
						<div class="stat-icon icon-teal">
							<UIcon name="i-lucide-calendar" class="w-3.5 h-3.5" style="color:#0F6E56" />
						</div>
						<div class="stat-label">Nadchodzące</div>
						<div class="stat-num">{{ upcomingEvents.length }}</div>
						<div class="stat-sub">Wydarzenia w tym tygodniu</div>
					</div>

					<div class="stat-card">
						<div class="stat-icon icon-amber">
							<UIcon name="i-lucide-folder" class="w-3.5 h-3.5" style="color:#854F0B" />
						</div>
						<div class="stat-label">Ostatnie pliki</div>
						<div class="stat-num">{{ recentFiles.length }}</div>
						<div class="stat-sub">Najnowsze zasoby</div>
					</div>
				</div>

				<!-- Modules strip -->
				<div class="modules-strip">
					<div class="mod-cell">
						<div class="mod-label">Notatki</div>
						<div class="mod-num">{{ resourceStats.notes }}</div>
						<div class="mod-desc">We wszystkich grupach</div>
					</div>
					<div class="mod-cell">
						<div class="mod-label">Streszczenia</div>
						<div class="mod-num">{{ resourceStats.summaries }}</div>
						<div class="mod-desc">Wygenerowane z notatek</div>
					</div>
					<div class="mod-cell">
						<div class="mod-label">Quizy</div>
						<div class="mod-num">{{ resourceStats.quizzes }}</div>
						<div class="mod-desc">Sprawdziany wiedzy</div>
					</div>
					<div class="mod-cell">
						<div class="mod-label">Pliki</div>
						<div class="mod-num">{{ resourceStats.files }}</div>
						<div class="mod-desc">Łączna baza materiałów</div>
					</div>
				</div>

				<!-- Main grid: 2/3 + 1/3 -->
				<div class="main-grid">

					<!-- Left column -->
					<div class="col-left">

						<!-- Events -->
						<div class="db-card">
							<div class="db-card-header">
								<span class="db-card-title">Najbliższe wydarzenia</span>
							</div>
							<div class="db-card-body">
								<ul class="event-list">
									<li v-for="ev in upcomingEvents" :key="ev.id" class="event-row">
										<span class="event-dot" :style="{ background: eventDotColor(ev.group?.type) }" />
										<div class="event-info">
											<div class="event-title">{{ ev.title }}</div>
											<div class="event-meta">
												{{ formatDate(ev.starts_at) }}
												<template v-if="ev.group?.name"> · {{ ev.group.name }}</template>
											</div>
										</div>
										<span :class="['badge', groupTypeBadge(ev.group?.type).cls]">
											{{ groupTypeBadge(ev.group?.type).label }}
										</span>
									</li>
									<li v-if="upcomingEvents.length === 0" class="empty-state">
										Brak nadchodzących wydarzeń.
									</li>
								</ul>
							</div>
						</div>

						<!-- Quick actions -->
						<div class="db-card">
							<div class="db-card-header">
								<span class="db-card-title">Szybkie akcje</span>
							</div>
							<div class="db-card-body">
								<div class="actions-row">
									<UButton to="/dashboard/notes" icon="i-lucide-edit-2" size="sm">Dodaj notatkę</UButton>
									<UButton to="/dashboard/calendar" variant="ghost" icon="i-lucide-calendar" size="sm">Kalendarz</UButton>
									<UButton to="/dashboard/files" color="neutral" icon="i-lucide-folder" size="sm">Przeglądaj pliki</UButton>
									<UButton to="/dashboard/quiz" color="neutral" icon="i-lucide-award" size="sm">Utwórz quiz</UButton>
								</div>
							</div>
						</div>
					</div>

					<!-- Right column -->
					<div class="col-right">

						<!-- Groups -->
						<div class="db-card">
							<div class="db-card-header">
								<span class="db-card-title">Twoje grupy</span>
							</div>
							<div class="db-card-body">
								<ul class="group-list">
									<li v-for="g in visibleUserGroups" :key="g.group_id" class="group-row">
										<div :class="['group-avatar', groupAvatarCls(g.group?.type)]">
											{{ getInitials(g.group?.name) }}
										</div>
										<div class="group-info">
											<div class="group-name">{{ g.group?.name ?? g.group_id }}</div>
											<div class="group-meta">{{ g.group?.type ?? "—" }} · {{ g.role }}</div>
										</div>
										<UButton
											variant="ghost"
											size="xs"
											icon="i-lucide-arrow-right"
											trailing
											@click="openGroupModal(g.group_id)"
										/>
									</li>
									<li v-if="visibleUserGroups.length === 0" class="empty-state">
										Jeszcze nie należysz do żadnej grupy.
									</li>
								</ul>
							</div>
						</div>

						<!-- Recent files -->
						<div class="db-card">
							<div class="db-card-header">
								<span class="db-card-title">Najnowsze pliki</span>
							</div>
							<div class="db-card-body">
								<ul class="file-list">
									<li v-for="f in recentFiles" :key="f.id" class="file-row">
										<div class="file-icon">
											<UIcon name="i-lucide-file-text" class="w-3.5 h-3.5" />
										</div>
										<div class="file-info">
											<div class="file-name">{{ f.name }}</div>
											<div class="file-type">{{ f.file_type }}</div>
										</div>
										<UButton :to="`/dashboard/files/${f.id}`" variant="outline" size="xs">Pobierz</UButton>
									</li>
									<li v-if="recentFiles.length === 0" class="empty-state">Brak plików.</li>
								</ul>
							</div>
						</div>

					</div>
				</div>
			</div>
		</UDashboardPanel>

		<UModal v-model:open="isGroupModalOpen">
			<template #content>

				<!-- Header -->
				<div v-if="selectedGroupData" class="modal-header">
					<div :class="['group-avatar', 'modal-avatar', groupAvatarCls(selectedGroupData.group?.type)]">
						{{ getInitials(selectedGroupData.group?.name) }}
					</div>
					<div class="modal-header-info">
						<div class="modal-group-name">{{ selectedGroupData.group?.name ?? 'Grupa' }}</div>
						<div class="modal-group-meta">
							{{ selectedGroupData.group?.type }} · {{ groupMembers.length }} członków
						</div>
					</div>
					<UButton
						icon="i-lucide-x"
						variant="ghost"
						color="neutral"
						size="sm"
						@click="isGroupModalOpen = false"
					/>
				</div>

				<!-- Memebers list -->
				<div class="modal-body">
					<div v-for="(m, index) in pagedMembers" :key="m.id" class="member-row">
						<div class="member-index">
							{{ (memberPage - 1) * memberPageSize + index + 1 }}
						</div>
						<div class="member-info">
							<div class="member-id">{{ m.user_id }}</div>
							<div class="member-meta">Dołączył: {{ formatDate(m.created_at) }}</div>
						</div>
						<span :class="['badge', m.role === 'admin' ? 'badge-uni' : 'badge-fac']">
							{{ m.role }}
						</span>
					</div>
					<div v-if="groupMembers.length === 0" class="modal-empty">
						Brak członków w tej grupie.
					</div>
				</div>

				<div v-if="groupMembers.length > memberPageSize" class="modal-footer">
					<span class="modal-page-info">Strona {{ memberPage }} / {{ memberPageCount }}</span>
					<div class="modal-footer-actions">
						<UButton variant="outline" color="neutral" size="sm" :disabled="!canMemberGoPrev" @click="memberGoPrev">
							Poprzednia
						</UButton>
						<UButton variant="outline" color="neutral" size="sm" :disabled="!canMemberGoNext" @click="memberGoNext">
							Następna
						</UButton>
					</div>
				</div>

			</template>
		</UModal>

	</div>
</template>

<style scoped>
.page-wrapper {
	display: flex;
	flex-direction: column;
	min-height: 100vh;
	width: 100%;
}

.db-root {
	flex: 1;
	min-height: calc(100vh - 4rem);
	padding: 1rem;
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	overflow-y: auto;
}

.stats-row,
.modules-strip {
	display: grid;
	gap: 0.5rem;
}

.stats-row {
	grid-template-columns: repeat(3, minmax(0, 1fr));
}

.modules-strip {
	grid-template-columns: repeat(4, minmax(0, 1fr));
}

.main-grid {
	display: grid;
	grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
	gap: 0.75rem;
}

.col-left,
.col-right {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.stat-card,
.mod-cell,
.db-card {
	background: var(--ui-bg);
	border: 1px solid var(--ui-border);
	border-radius: var(--ui-radius-lg);
}

.stat-card,
.mod-cell,
.db-card-body {
	padding: 0.875rem 1rem;
}

.mod-cell {
	background: var(--ui-bg-muted);
}

.db-card-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.75rem 1rem;
	border-bottom: 1px solid var(--ui-border);
}

.db-card-title,
.group-name,
.file-name,
.event-title,
.modal-group-name {
	font-weight: 600;
	color: var(--ui-text);
}

.stat-label,
.mod-label,
.event-meta,
.group-meta,
.file-type,
.empty-state,
.member-meta,
.modal-group-meta,
.modal-page-info {
	font-size: 0.75rem;
	color: var(--ui-text-muted);
}

.group-name,
.file-name,
.event-title,
.modal-group-name,
.member-id {
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.stat-num,
.mod-num {
	font-size: 1.5rem;
	font-weight: 700;
	line-height: 1.1;
	font-variant-numeric: tabular-nums;
}

.stat-icon,
.file-icon,
.group-avatar,
.member-index {
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border-radius: 8px;
	background: var(--ui-bg-muted);
}

.stat-icon {
	width: 28px;
	height: 28px;
	margin-bottom: 0.5rem;
}

.file-icon,
.group-avatar {
	width: 32px;
	height: 32px;
}

.member-index {
	width: 24px;
	height: 24px;
	font-size: 0.7rem;
	font-weight: 600;
}

.icon-blue { background: #E6F1FB; }
.icon-teal { background: #E1F5EE; }
.icon-amber { background: #FAEEDA; }

.event-list,
.group-list,
.file-list {
	list-style: none;
	display: flex;
	flex-direction: column;
	margin: 0;
	padding: 0;
}

.event-row,
.group-row,
.file-row,
.member-row {
	display: flex;
	align-items: center;
	gap: 0.625rem;
	padding: 0.5rem 0;
	border-bottom: 1px solid var(--ui-border);
}

.event-row:last-child,
.group-row:last-child,
.file-row:last-child,
.member-row:last-child {
	border-bottom: 0;
	padding-bottom: 0;
}

.event-row:first-child,
.group-row:first-child,
.file-row:first-child,
.member-row:first-child {
	padding-top: 0;
}

.event-dot {
	width: 8px;
	height: 8px;
	border-radius: 999px;
	flex-shrink: 0;
}

.event-info,
.group-info,
.file-info,
.member-info,
.modal-header-info {
	flex: 1;
	min-width: 0;
}

.actions-row,
.modal-footer-actions {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
}

.badge {
	display: inline-block;
	padding: 2px 8px;
	font-size: 0.625rem;
	font-weight: 600;
	border-radius: 999px;
	white-space: nowrap;
	flex-shrink: 0;
}

.badge-uni { background: #9FE1CB; color: #085041; }
.badge-fac { background: #B5D4F4; color: #0C447C; }
.badge-course { background: #FAEEDA; color: #633806; }
.badge-default { background: var(--ui-bg-muted); color: var(--ui-text-muted); }

.av-teal { background: #9FE1CB; color: #085041; }
.av-blue { background: #B5D4F4; color: #0C447C; }
.av-amber { background: #FAEEDA; color: #633806; }
.av-gray { background: var(--ui-bg-muted); color: var(--ui-text-muted); }

.modal-header {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	padding: 1rem;
	border-bottom: 1px solid var(--ui-border);
}

.modal-avatar {
	width: 40px;
	height: 40px;
	border-radius: 10px;
}

.modal-body {
	padding: 0.75rem 1rem;
	max-height: 24rem;
	overflow-y: auto;
}

.member-id {
	font-size: 0.75rem;
}

.modal-empty {
	padding: 1.25rem 0;
	text-align: center;
	color: var(--ui-text-muted);
}

.modal-footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.75rem;
	padding: 0.75rem 1rem;
	border-top: 1px solid var(--ui-border);
}

@media (max-width: 1024px) {
	.main-grid {
		grid-template-columns: 1fr;
	}

	.modules-strip {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
}

@media (max-width: 768px) {
	.stats-row,
	.modules-strip {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
}

@media (max-width: 480px) {
	.db-root {
		padding: 0.75rem;
	}

	.stats-row,
	.modules-strip {
		grid-template-columns: 1fr;
	}
}
</style>