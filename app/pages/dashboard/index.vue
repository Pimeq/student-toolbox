<script setup lang="ts">
definePageMeta({ layout: "dashboard" })

type GroupType = "university" | "faculty" | "course"

type DashboardMetric = {
	label: string
	value: string
	note: string
	icon: string
	tone: string
}

type DashboardGroup = {
	id: string
	name: string
	type: GroupType
	role: string
	members: number
	progress: number
}

type DashboardEvent = {
	id: string
	title: string
	date: string
	group: string
	type: GroupType
}

type DashboardActivity = {
	id: string
	title: string
	detail: string
	time: string
	kind: string
}

type DashboardStats = {
	materials: number
	notes: number
	summaries: number
	quizzes: number
	files: number
}

const user = useSupabaseUser()

const displayName = computed(() => {
	const fullName = user.value?.user_metadata?.full_name as string | undefined
	if (fullName) return fullName
	const email = user.value?.email
	return email ? email.split("@")[0] : "Student"
})

const groupMeta: Record<GroupType, { label: string; chip: string }> = {
	university: { label: "Uniwersytet", chip: "chip-uni" },
	faculty: { label: "Wydział", chip: "chip-fac" },
	course: { label: "Kierunek", chip: "chip-course" },
}

const dashboardHooks = async (): Promise<{
	groups: DashboardGroup[]
	events: DashboardEvent[]
	activities: DashboardActivity[]
	stats: DashboardStats
}> => ({
	groups: [
		{ id: "g-1", name: "Warsaw University of Technology", type: "university", role: "student", members: 1284, progress: 84 },
		{ id: "g-2", name: "Wydział Elektroniki", type: "faculty", role: "student", members: 246, progress: 67 },
		{ id: "g-3", name: "Informatyka", type: "course", role: "instructor", members: 58, progress: 73 },
		{ id: "g-4", name: "Grupa 2137 - Informatyka", type: "course", role: "instructor", members: 11, progress: 56 },
	],
	events: [
		{ id: "e-1", title: "Wykład z architektury systemów", date: "2026-05-02T10:15:00.000Z", group: "Informatyka", type: "course" },
		{ id: "e-2", title: "Konsultacje do projektu", date: "2026-05-03T14:00:00.000Z", group: "Wydział Elektroniki", type: "faculty" },
		{ id: "e-3", title: "Spotkanie organizacyjne roku", date: "2026-05-04T09:30:00.000Z", group: "Warsaw University of Technology", type: "university" },
	],
	activities: [
		{ id: "a-1", title: "Notatka", detail: "Dodano skrót z wykładu.", time: "2 min temu", kind: "note" },
		{ id: "a-2", title: "Quiz", detail: "Test powtórkowy zaliczony.", time: "18 min temu", kind: "quiz" },
		{ id: "a-3", title: "Plik", detail: "Wgrano PDF z materiałami.", time: "1 h temu", kind: "file" },
		{ id: "a-4", title: "Streszczenie", detail: "Podsumowanie seminarium gotowe.", time: "wczoraj", kind: "summary" },
	],
	stats: {
		materials: 128,
		notes: 42,
		summaries: 18,
		quizzes: 11,
		files: 128,
	}
})

const { data: dashboardData } = await useAsyncData("dashboard-home", dashboardHooks, {
	default: () => ({
		groups: [] as DashboardGroup[],
		events: [] as DashboardEvent[],
		activities: [] as DashboardActivity[],
		stats: {
			materials: 0,
			notes: 0,
			summaries: 0,
			quizzes: 0,
			files: 0,
		},
	}),
})

const mockGroups = computed(() => dashboardData.value?.groups ?? [])
const mockEvents = computed(() => dashboardData.value?.events ?? [])
const mockActivities = computed(() => dashboardData.value?.activities ?? [])

const metrics = computed<DashboardMetric[]>(() => {
	const stats = dashboardData.value?.stats

	return [
		{ label: "Materiały", value: String(stats?.materials ?? 0), note: "Zasoby do przeglądu", icon: "i-lucide-folder-open", tone: "tone-course" },
		{ label: "Notatki", value: String(stats?.notes ?? 0), note: "Opracowania z zajęć", icon: "i-lucide-notebook-pen", tone: "tone-uni" },
		{ label: "Streszczenia", value: String(stats?.summaries ?? 0), note: "Gotowe skróty treści", icon: "i-lucide-file-text", tone: "tone-fac" },
		{ label: "Quizy", value: String(stats?.quizzes ?? 0), note: "Szybkie powtórki", icon: "i-lucide-award", tone: "tone-course" },
	]
})

const formatDate = (d: string) =>
	new Date(d).toLocaleString("pl-PL", {
		dateStyle: "medium",
		timeStyle: "short",
	})

const heroDateTime = new Intl.DateTimeFormat("pl-PL", {
	weekday: "long",
	day: "numeric",
	month: "long",
	hour: "2-digit",
	minute: "2-digit",
}).format(new Date())

</script>

<template>
	<div class="page-shell">
		<UDashboardPanel>
			<template #header>
				<UDashboardNavbar title="Dashboard">
					<template #leading>
						<UDashboardSidebarCollapse />
					</template>
				</UDashboardNavbar>
			</template>

			<div class="dashboard-root">
				<section class="hero-card">
					<div class="hero-copy">
						<p class="hero-meta">{{ heroDateTime }}</p>
						<h1 class="hero-title">Witaj, {{ displayName }}</h1>
						<p class="hero-text">Szybki przegląd materiałów, aktywności i grup. Wszystko w jednym miejscu, bez szumu.</p>
					</div>
				</section>

				<section class="metric-grid" aria-label="Najważniejsze statystyki">
					<UCard v-for="metric in metrics" :key="metric.label" class="metric-card">
						<div class="metric-inner">
							<div :class="['metric-icon', metric.tone]">
								<UIcon :name="metric.icon" class="h-5 w-5" />
							</div>
							<div class="metric-copy">
								<p class="metric-label">{{ metric.label }}</p>
								<p class="metric-value">{{ metric.value }}</p>
								<p class="metric-note">{{ metric.note }}</p>
							</div>
						</div>
					</UCard>
				</section>

				<section class="content-grid">
					<div class="stack">
						<UCard id="focus" class="panel-card">
							<template #header>
								<div class="panel-head">
									<div>
										<p class="panel-kicker">Do zrobienia</p>
										<h2 class="panel-title">Nadchodzące terminy</h2>
									</div>
									<UBadge color="neutral" variant="soft">{{ mockEvents.length }}</UBadge>
								</div>
							</template>

							<div class="section-list">
								<article v-for="event in mockEvents" :key="event.id" class="row">
									<div class="row-main">
										<div class="row-title">{{ event.title }}</div>
										<div class="row-meta">{{ formatDate(event.date) }} · {{ event.group }}</div>
									</div>
									<UBadge :class="groupMeta[event.type].chip" variant="soft">{{ groupMeta[event.type].label }}</UBadge>
								</article>
							</div>
						</UCard>

						<UCard id="activity" class="panel-card">
							<template #header>
								<div class="panel-head">
									<div>
										<p class="panel-kicker">Ostatnio</p>
										<h2 class="panel-title">Aktywność</h2>
									</div>
									<UBadge color="primary" variant="soft">4</UBadge>
								</div>
							</template>

							<div class="section-list">
								<article v-for="activity in mockActivities" :key="activity.id" class="row activity-row">
									<div class="activity-dot" :class="`dot-${activity.kind}`" />
									<div class="row-main">
										<div class="row-title">{{ activity.title }}</div>
										<div class="row-meta">{{ activity.detail }}</div>
									</div>
									<span class="row-time">{{ activity.time }}</span>
								</article>
							</div>
						</UCard>
					</div>

					<div class="stack">
						<UCard id="groups" class="panel-card">
							<template #header>
								<div class="panel-head">
									<div>
										<p class="panel-kicker">Współpraca</p>
										<h2 class="panel-title">Twoje grupy</h2>
									</div>
									<UBadge color="neutral" variant="soft">{{ mockGroups.length }}</UBadge>
								</div>
							</template>

							<div class="section-list">
								<article v-for="group in mockGroups" :key="group.id" class="group-card">
									<div class="group-top">
										<div class="group-avatar" :class="`tone-${group.type}`">{{ group.name.slice(0, 2).toUpperCase() }}</div>
										<div class="row-main">
											<div class="row-title">{{ group.name }}</div>
											<div class="row-meta">{{ groupMeta[group.type].label }} · {{ group.members }} osób · {{ group.role }}</div>
										</div>
									</div>

									<div class="progress-line" aria-hidden="true">
										<span :style="{ width: `${group.progress}%` }" :class="`progress-${group.type}`" />
									</div>
								</article>
							</div>
						</UCard>
					</div>
				</section>
			</div>
		</UDashboardPanel>
	</div>
</template>

<style scoped>
.page-shell {
	min-height: 100vh;
	width: 100%;
}

.dashboard-root {
	min-height: calc(100vh - 4rem);
	padding: 1rem;
	display: grid;
	gap: 1rem;
	align-content: start;
	overflow-y: auto;
}

.hero-card {
	position: relative;
	overflow: hidden;
	border: 1px solid var(--ui-border);
	border-radius: var(--ui-radius-lg);
	background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(59, 130, 246, 0.08));
	padding: 1.15rem 1.25rem;
	display: flex;
	justify-content: space-between;
	gap: 1rem;
	align-items: flex-start;
}

.hero-card::after {
	content: "";
	position: absolute;
	inset: auto -2rem -2rem auto;
	width: 10rem;
	height: 10rem;
	border-radius: 999px;
	background: radial-gradient(circle, rgba(59, 130, 246, 0.22), transparent 70%);
	pointer-events: none;
}

.hero-copy,
.hero-actions,
.row-main {
	min-width: 0;
}

.hero-copy {
	max-width: 42rem;
}

.hero-meta,
.panel-kicker,
.metric-label,
.row-meta,
.row-time {
	font-size: 0.75rem;
	color: var(--ui-text-muted);
}

.hero-meta,
.panel-kicker {
	font-weight: 700;
}

.hero-meta {
	text-transform: capitalize;
}

.hero-title {
	margin: 0.35rem 0 0;
	font-size: clamp(1.7rem, 3vw, 2.8rem);
	font-weight: 800;
	line-height: 1.05;
	color: var(--ui-text);
}

.hero-text {
	margin-top: 0.75rem;
	max-width: 44rem;
	color: var(--ui-text-muted);
	line-height: 1.55;
	font-size: 0.95rem;
}

.hero-actions {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
}

.metric-grid {
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 0.75rem;
}

.metric-card,
.panel-card {
	height: 100%;
}

.metric-inner {
	display: flex;
	gap: 0.75rem;
	align-items: flex-start;
}

.metric-copy {
	min-width: 0;
}

.metric-icon,
.group-avatar,
.activity-dot {
	flex-shrink: 0;
}

.metric-icon {
	width: 2.75rem;
	height: 2.75rem;
	border-radius: 0.9rem;
	display: grid;
	place-items: center;
	color: #fff;
}

.metric-value {
	font-size: 1.65rem;
	font-weight: 800;
	line-height: 1;
	margin: 0.15rem 0 0.15rem;
	color: var(--ui-text);
}

.metric-note,
.panel-title,
.row-title {
	color: var(--ui-text);
}

.metric-note {
	font-size: 0.78rem;
	color: var(--ui-text-muted);
}

.content-grid {
	display: grid;
	grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.95fr);
	gap: 0.75rem;
}

.stack {
	display: grid;
	gap: 0.75rem;
}

.panel-head,
.row,
.group-card,
.group-top,
.group-bottom {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.75rem;
}

.panel-title {
	font-size: 1rem;
	font-weight: 700;
	line-height: 1.2;
}

.section-list {
	display: flex;
	flex-direction: column;
	gap: 0;
}

.row,
.group-card {
	padding: 0.75rem 0;
	border-bottom: 1px solid var(--ui-border);
}

.row .u-badge {
	min-width: 6.75rem;
	justify-content: center;
	text-align: center;
}

.row:last-child,
.group-card:last-child {
	border-bottom: 0;
	padding-bottom: 0;
}

.row:first-child,
.group-card:first-child {
	padding-top: 0;
}

.activity-row {
	display: grid;
	grid-template-columns: auto minmax(0, 1fr) auto;
	align-items: start;
}

.activity-dot {
	width: 0.7rem;
	height: 0.7rem;
	margin-top: 0.3rem;
	border-radius: 999px;
}

.dot-note { background: #185FA5; }
.dot-quiz { background: #BA7517; }
.dot-file { background: #0F6E56; }
.dot-summary { background: #6B7280; }

.group-top {
	align-items: flex-start;
}

.group-avatar {
	width: 2.5rem;
	height: 2.5rem;
	border-radius: 0.9rem;
	display: grid;
	place-items: center;
	font-size: 0.78rem;
	font-weight: 800;
}

.row-title {
	font-weight: 700;
	line-height: 1.2;
	font-size: 0.95rem;
}

.progress-line {
	margin: 0.65rem 0 0.35rem;
	height: 0.55rem;
	border-radius: 999px;
	background: var(--ui-bg-muted);
	overflow: hidden;
}

.progress-line > span {
	display: block;
	height: 100%;
	border-radius: inherit;
}

.progress-university { background: linear-gradient(90deg, #0F6E56, #34D399); }
.progress-faculty { background: linear-gradient(90deg, #185FA5, #60A5FA); }
.progress-course { background: linear-gradient(90deg, #BA7517, #FBBF24); }

.chip-uni { background: #E1F5EE; color: #0F6E56; }
.chip-fac { background: #E6F1FB; color: #185FA5; }
.chip-course { background: #FAEEDA; color: #BA7517; }

.tone-uni { background: #0F6E56; }
.tone-fac { background: #185FA5; }
.tone-course { background: #BA7517; }
.tone-neutral { background: #6B7280; }

@media (max-width: 1100px) {
	.metric-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.content-grid {
		grid-template-columns: 1fr;
	}
}

@media (max-width: 720px) {
	.dashboard-root {
		padding: 0.75rem;
	}

	.hero-card {
		flex-direction: column;
	}

	.metric-grid {
		grid-template-columns: 1fr;
	}
}
</style>
