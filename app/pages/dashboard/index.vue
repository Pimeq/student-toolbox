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

type ScheduleItem = {
	id: string
	subject: string
	room: string
	time: string
	type: "lecture" | "lab" | "seminar"
}

type DashboardStats = {
	materials: number
	notes: number
	summaries: number
	quizzes: number
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
	faculty:    { label: "Wydział",     chip: "chip-fac" },
	course:     { label: "Kierunek",    chip: "chip-course" },
}

const scheduleTypeLabel: Record<ScheduleItem["type"], string> = {
	lecture: "Wykład",
	lab:     "Laboratorium",
	seminar: "Seminarium",
}

const dashboardHooks = async (): Promise<{
	events:     DashboardEvent[]
	activities: DashboardActivity[]
	schedule:   ScheduleItem[]
	stats:      DashboardStats
}> => ({
	events: [
		{ id: "e-1", title: "Wykład z architektury systemów", date: "2026-05-02T10:15:00.000Z", group: "Informatyka",                    type: "course" },
		{ id: "e-2", title: "Konsultacje do projektu",        date: "2026-05-03T14:00:00.000Z", group: "Wydział Elektroniki",             type: "faculty" },
		{ id: "e-3", title: "Spotkanie organizacyjne roku",   date: "2026-05-04T09:30:00.000Z", group: "Warsaw University of Technology", type: "university" },
		{ id: "e-4", title: "Oddanie projektu zaliczeniowego", date: "2026-05-09T23:59:00.000Z", group: "Informatyka",                   type: "course" },
		{ id: "e-5", title: "Egzamin z sieci komputerowych",  date: "2026-05-14T09:00:00.000Z", group: "Informatyka",                    type: "course" },
	],
	activities: [
		{ id: "a-1", title: "Notatka",      detail: "Dodano skrót z wykładu.",          time: "2 min temu",  kind: "note" },
		{ id: "a-2", title: "Quiz",         detail: "Test powtórkowy zaliczony.",        time: "18 min temu", kind: "quiz" },
		{ id: "a-3", title: "Plik",         detail: "Wgrano PDF z materiałami.",         time: "1 h temu",    kind: "file" },
		{ id: "a-4", title: "Streszczenie", detail: "Podsumowanie seminarium gotowe.",   time: "wczoraj",     kind: "summary" },
		{ id: "a-5", title: "Notatka",      detail: "Opracowanie z ćwiczeń.",            time: "wczoraj",     kind: "note" },
		{ id: "a-6", title: "Quiz",         detail: "Próbny test z algorytmów.",         time: "2 dni temu",  kind: "quiz" },
	],
	schedule: [
		{ id: "s-1", subject: "Matematyka dyskretna",         room: "A204", time: "08:00–09:30", type: "lecture" },
		{ id: "s-2", subject: "Sieci komputerowe",            room: "B112", time: "10:00–11:30", type: "lab" },
		{ id: "s-3", subject: "Algorytmy i struktury danych", room: "C305", time: "13:15–14:45", type: "lecture" },
		{ id: "s-4", subject: "Projekt zespołowy",            room: "D01",  time: "15:00–16:30", type: "seminar" },
		{ id: "s-5", subject: "Bazy danych",                  room: "A101", time: "16:45–18:15", type: "lab" },
	],
	stats: { materials: 128, notes: 42, summaries: 18, quizzes: 11 },
})

const { data } = await useAsyncData("dashboard-home", dashboardHooks, {
	default: () => ({
		events:     [] as DashboardEvent[],
		activities: [] as DashboardActivity[],
		schedule:   [] as ScheduleItem[],
		stats: { materials: 0, notes: 0, summaries: 0, quizzes: 0 },
	}),
})

const metrics = computed<DashboardMetric[]>(() => [
	{ label: "Materiały",    value: String(data.value?.stats.materials ?? 0), note: "Zasoby do przeglądu",  icon: "i-lucide-folder-open",  tone: "tone-course" },
	{ label: "Notatki",      value: String(data.value?.stats.notes     ?? 0), note: "Opracowania z zajęć",  icon: "i-lucide-notebook-pen", tone: "tone-uni" },
	{ label: "Streszczenia", value: String(data.value?.stats.summaries ?? 0), note: "Gotowe skróty treści", icon: "i-lucide-file-text",    tone: "tone-fac" },
	{ label: "Quizy",        value: String(data.value?.stats.quizzes   ?? 0), note: "Szybkie powtórki",     icon: "i-lucide-award",        tone: "tone-course" },
])

const mockEvents     = computed(() => data.value?.events     ?? [])
const mockActivities = computed(() => data.value?.activities ?? [])
const todaySchedule  = computed(() => data.value?.schedule   ?? [])

const formatDate = (d: string) =>
	new Date(d).toLocaleString("pl-PL", { dateStyle: "medium", timeStyle: "short" })

const heroDateTime = new Intl.DateTimeFormat("pl-PL", {
	weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
}).format(new Date())
</script>

<template>
	<div style="display: contents">
		<UDashboardPanel>
			<template #header>
				<UDashboardNavbar title="Dashboard">
					<template #leading>
						<UDashboardSidebarCollapse />
					</template>
				</UDashboardNavbar>
			</template>

			<div class="dash">

				<!-- ── Hero ── -->
				<section class="hero">
					<p class="kicker">{{ heroDateTime }}</p>
					<h1 class="hero-title">Witaj, {{ displayName }}</h1>
					<p class="hero-desc">Szybki przegląd materiałów, aktywności i grup.</p>
				</section>

				<!-- ── Metrics ── -->
				<section class="metrics-grid" aria-label="Statystyki">
					<UCard v-for="m in metrics" :key="m.label">
						<div class="metric-row">
							<div class="icon-box" :class="m.tone">
								<UIcon :name="m.icon" class="h-5 w-5" />
							</div>
							<div>
								<p class="kicker">{{ m.label }}</p>
								<p class="metric-val">{{ m.value }}</p>
								<p class="sub">{{ m.note }}</p>
							</div>
						</div>
					</UCard>
				</section>

				<!-- ── 3 columns ── -->
				<div class="cols">

					<!-- Nadchodzące terminy -->
					<div class="panel">
						<div class="panel-hd">
							<div>
								<p class="kicker">Do zrobienia</p>
								<h2 class="panel-title">Nadchodzące terminy</h2>
							</div>
							<UBadge color="neutral" variant="soft">{{ mockEvents.length }}</UBadge>
						</div>
						<ul class="panel-bd">
							<li v-for="ev in mockEvents" :key="ev.id" class="row">
								<div class="row-body">
									<p class="row-title">{{ ev.title }}</p>
									<p class="sub">{{ formatDate(ev.date) }} · {{ ev.group }}</p>
								</div>
								<UBadge :class="groupMeta[ev.type].chip" variant="soft" size="sm">
									{{ groupMeta[ev.type].label }}
								</UBadge>
							</li>
						</ul>
					</div>

					<!-- Plan zajęć -->
					<div class="panel">
						<div class="panel-hd">
							<div>
								<p class="kicker">Dzisiaj</p>
								<h2 class="panel-title">Plan zajęć</h2>
							</div>
							<UBadge color="neutral" variant="soft">{{ todaySchedule.length }}</UBadge>
						</div>
						<ul class="panel-bd">
							<li v-for="s in todaySchedule" :key="s.id" class="row">
								<span class="sched-time">{{ s.time }}</span>
								<div class="row-body">
									<p class="row-title">{{ s.subject }}</p>
									<p class="sub">{{ s.room }} · {{ scheduleTypeLabel[s.type] }}</p>
								</div>
							</li>
						</ul>
					</div>

					<!-- Aktywność -->
					<div class="panel">
						<div class="panel-hd">
							<div>
								<p class="kicker">Ostatnio</p>
								<h2 class="panel-title">Aktywność</h2>
							</div>
							<UBadge color="primary" variant="soft">{{ mockActivities.length }}</UBadge>
						</div>
						<ul class="panel-bd">
							<li v-for="act in mockActivities" :key="act.id" class="row row--activity">
								<span class="dot" :class="`dot-${act.kind}`" aria-hidden="true" />
								<div class="row-body">
									<p class="row-title">{{ act.title }}</p>
									<p class="sub">{{ act.detail }}</p>
								</div>
								<span class="sub">{{ act.time }}</span>
							</li>
						</ul>
					</div>

				</div>
			</div>
		</UDashboardPanel>
	</div>
</template>

<style scoped>
/* ── Outer shell ── */
.dash {
	height: 100%;
	overflow: hidden;
	padding: 1rem;
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

/* ── Hero ── */
.hero {
	flex-shrink: 0;
	padding: 1.15rem 1.25rem;
	border: 1px solid var(--ui-border);
	border-radius: var(--ui-radius-lg);
	background: linear-gradient(135deg, rgba(16, 185, 129, 0.07), rgba(59, 130, 246, 0.07));
}

.hero-title {
	font-size: clamp(1.4rem, 2.5vw, 2.2rem);
	font-weight: 800;
	color: var(--ui-text);
	margin: 0.2rem 0 0.3rem;
	line-height: 1.1;
}

.hero-desc {
	font-size: 0.875rem;
	color: var(--ui-text-muted);
}

/* ── Metrics ── */
.metrics-grid {
	flex-shrink: 0;
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
	gap: 0.75rem;
}

.metric-row {
	display: flex;
	gap: 0.75rem;
	align-items: flex-start;
}

.metric-val {
	font-size: 1.6rem;
	font-weight: 800;
	line-height: 1;
	color: var(--ui-text);
	margin: 0.15rem 0 0.1rem;
}

.icon-box {
	flex-shrink: 0;
	width: 2.4rem;
	height: 2.4rem;
	border-radius: 0.7rem;
	display: grid;
	place-items: center;
	color: #fff;
}

/* ── 3 columns ── */
.cols {
	flex: 1;
	min-height: 0;
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 0.75rem;
}

/* ── Panel (custom card that stretches) ── */
.panel {
	display: flex;
	flex-direction: column;
	min-height: 0;
	background: var(--ui-bg);
	border: 1px solid var(--ui-border);
	border-radius: var(--ui-radius-lg);
	overflow: hidden;
}

.panel-hd {
	flex-shrink: 0;
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 0.5rem;
	padding: 0.875rem 1rem;
	border-bottom: 1px solid var(--ui-border);
}

.panel-title {
	font-size: 0.95rem;
	font-weight: 700;
	color: var(--ui-text);
	line-height: 1.2;
}

.panel-bd {
	flex: 1;
	overflow-y: auto;
	padding: 0 1rem;
	list-style: none;
	margin: 0;
}

/* ── Rows ── */
.row {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	padding: 0.7rem 0;
	border-bottom: 1px solid var(--ui-border);
}

.row:last-child { border-bottom: none; }

.row--activity { align-items: flex-start; }

.row-body {
	flex: 1;
	min-width: 0;
}

.row-title {
	font-size: 0.875rem;
	font-weight: 600;
	color: var(--ui-text);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

/* ── Activity dot ── */
.dot {
	flex-shrink: 0;
	width: 0.55rem;
	height: 0.55rem;
	border-radius: 999px;
	margin-top: 0.35rem;
}

.dot-note    { background: #185FA5; }
.dot-quiz    { background: #BA7517; }
.dot-file    { background: #0F6E56; }
.dot-summary { background: #6B7280; }

/* ── Schedule time ── */
.sched-time {
	flex-shrink: 0;
	width: 5.5rem;
	font-size: 0.72rem;
	font-weight: 700;
	color: var(--ui-text-muted);
}

/* ── Shared ── */
.kicker {
	font-size: 0.68rem;
	font-weight: 700;
	color: var(--ui-text-muted);
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.sub { font-size: 0.78rem; color: var(--ui-text-muted); }

/* ── Colors ── */
.tone-uni    { background: #0F6E56; }
.tone-fac    { background: #185FA5; }
.tone-course { background: #BA7517; }

.chip-uni    { background: #E1F5EE; color: #0F6E56; }
.chip-fac    { background: #E6F1FB; color: #185FA5; }
.chip-course { background: #FAEEDA; color: #BA7517; }

/* ── Responsive ── */
@media (max-width: 768px) {
	.dash { padding: 0.75rem; overflow-y: auto; }
	.cols { grid-template-columns: 1fr; flex: none; }
	.panel { min-height: 300px; }
}
</style>