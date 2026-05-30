<script setup lang="ts">
import type { Database } from '~/types/database.types'

definePageMeta({ layout: "dashboard" })

type GroupType = Database["public"]["Enums"]["group_type"]
type ActivityKind = Database["public"]["Enums"]["file_type"] | "event"

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
	kind: ActivityKind
}

type ScheduleItem = {
	id: string
	subject: string
	group: string
	time: string
	type: GroupType
	startsAt?: string
	endsAt?: string
	sessionKind?: ParsedDescription['sessionKind']
	location?: string
	isPersonal?: boolean
}

type DashboardStats = {
	materials: number
	notes: number
	summaries: number
	quizzes: number
}

type RelatedGroup = {
	id: string
	name: string
	type: GroupType
} | null

type MembershipRow = {
	group_id: string
	group: RelatedGroup
}

type GroupRow = {
	id: string
	name: string
	type: GroupType
}

type FacultyLink = {
	id: string
	university_id: string
}

type CourseLink = {
	id: string
	faculty_id: string
}

type ClassLink = {
	id: string
	course_id: string
}

type EventRow = {
	id: number
	title: string
	description: string | null
	starts_at: string | null
	ends_at: string | null
	created_at: string
	group_id: string
	group: RelatedGroup
}

type FileRow = {
	id: string
	name: string
	file_type: Database["public"]["Enums"]["file_type"]
	created_at: string
	group_id: string
	group: RelatedGroup
}

type DashboardData = {
	events: DashboardEvent[]
	activities: DashboardActivity[]
	schedule: ScheduleItem[]
	stats: DashboardStats
}

type ParsedDescription = {
	note: string
	location: string
	seriesId: string
	sessionKind: '' | 'lecture' | 'lab' | 'exercise' | 'project'
	scopeGroupId: string
}

const emptyDashboard = (): DashboardData => ({
	events: [],
	activities: [],
	schedule: [],
	stats: { materials: 0, notes: 0, summaries: 0, quizzes: 0 },
})

const supabase = useSupabaseClient<Database>()
const user = useSupabaseUser()

type UserLike = { id?: string; sub?: string } | null | undefined

function resolveCurrentUserId(currentUser: UserLike) {
	return currentUser?.id ?? currentUser?.sub ?? ''
}

const currentUserId = computed(() => resolveCurrentUserId(user.value as UserLike))

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
	class: { label: "Zajęcia", chip: "chip-class" },
	personal: { label: "Prywatne", chip: "chip-personal" },
}

const activityKindLabel: Record<ActivityKind, string> = {
	note: "Notatka",
	summary: "Streszczenie",
	quiz: "Quiz",
	generic: "Plik",
	event: "Wydarzenie",
}

const formatRelativeTime = (value: string) => {
	const diffMinutes = Math.round((Date.now() - new Date(value).getTime()) / 60000)
	if (Number.isNaN(diffMinutes)) return "ostatnio"
	if (Math.abs(diffMinutes) < 1) return "teraz"

	const formatter = new Intl.RelativeTimeFormat("pl-PL", { numeric: "auto" })
	if (Math.abs(diffMinutes) < 60) return formatter.format(-diffMinutes, "minute")

	const diffHours = Math.round(diffMinutes / 60)
	if (Math.abs(diffHours) < 24) return formatter.format(-diffHours, "hour")

	const diffDays = Math.round(diffHours / 24)
	return formatter.format(-diffDays, "day")
}

const normalizeDbDateTime = (value: string) => {
	if (!value) return value
	if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00`
	return value
}

const extractTime = (value: string) => {
	if (!value) return ''
	if (value.includes('T')) return value.split('T')[1]?.slice(0, 8) ?? ''
	if (value.includes(' ')) return value.split(' ')[1]?.slice(0, 8) ?? ''
	return ''
}

const isDateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)

function parseStoredDescription(raw?: string | null): ParsedDescription {
	const text = (raw ?? '').trim()
	if (!text) return { note: '', location: '', seriesId: '', sessionKind: '', scopeGroupId: '' }

	const lines = text.split(/\r?\n/)
	let cursor = 0
	let location = ''
	let seriesId = ''
	let sessionKind: ParsedDescription['sessionKind'] = ''
	let scopeGroupId = ''

	while (cursor < lines.length) {
		const line = lines[cursor]?.trim() ?? ''
		if (!line) {
			cursor += 1
			break
		}

		if (line.startsWith('@loc:')) {
			location = line.slice(5).trim()
			cursor += 1
			continue
		}

		if (line.startsWith('@series:')) {
			seriesId = line.slice(8).trim()
			cursor += 1
			continue
		}

		if (line.startsWith('@kind:')) {
			const rawKind = line.slice(6).trim()
			if (rawKind === 'lecture' || rawKind === 'lab' || rawKind === 'exercise' || rawKind === 'project') {
				sessionKind = rawKind
			}
			cursor += 1
			continue
		}

		if (line.startsWith('@scope:')) {
			scopeGroupId = line.slice(7).trim()
			cursor += 1
			continue
		}

		break
	}

	const note = lines.slice(cursor).join('\n').trim()
	if (!location && !seriesId && !sessionKind && !scopeGroupId) {
		return { note: text, location: '', seriesId: '', sessionKind: '', scopeGroupId: '' }
	}

	return { note, location, seriesId, sessionKind, scopeGroupId }
}

const formatAllDayDate = (value: string) =>
	new Date(normalizeDbDateTime(value)).toLocaleDateString('pl-PL', { dateStyle: 'medium' })

const isAllDayEvent = (startsAt: string | null, endsAt: string | null) => {
	if (!startsAt || !endsAt) return false
	return (
		(isDateOnly(startsAt) && isDateOnly(endsAt))
		|| (extractTime(startsAt) === '00:00:00' && extractTime(endsAt) === '00:00:00')
	)
}

const resolveGroup = (group: RelatedGroup, fallbackId: string) => ({
	name: group?.name ?? fallbackId,
	type: group?.type ?? "personal",
})

const sessionKindLabel: Record<ParsedDescription['sessionKind'], string> = {
	'': '',
	lecture: 'Wykład',
	lab: 'Laboratorium',
	exercise: 'Ćwiczenia',
	project: 'Projekt',
}

const loadDashboard = async (): Promise<DashboardData> => {
	const userId = currentUserId.value
	if (!userId) return emptyDashboard()

	const { data: membershipsData, error: membershipsError } = await supabase
		.from("user_memberships")
		.select("group_id, group:groups(id, name, type)")
		.eq("user_id", userId)

	if (membershipsError) throw membershipsError

	const memberships = (membershipsData ?? []) as MembershipRow[]
	const directGroupIds = Array.from(new Set(memberships.map((membership) => membership.group_id)))
	if (!directGroupIds.length) return emptyDashboard()

	const [facultiesResult, coursesResult, classesResult] = await Promise.all([
		supabase.from("faculties").select("id, university_id"),
		supabase.from("courses").select("id, faculty_id"),
		supabase.from("classes").select("id, course_id"),
	])

	if (facultiesResult.error) throw facultiesResult.error
	if (coursesResult.error) throw coursesResult.error
	if (classesResult.error) throw classesResult.error

	const faculties = (facultiesResult.data ?? []) as FacultyLink[]
	const courses = (coursesResult.data ?? []) as CourseLink[]
	const classes = (classesResult.data ?? []) as ClassLink[]

	const childGroupIdsByParent = new Map<string, string[]>()
	const parentGroupIdByChild = new Map<string, string>()

	for (const faculty of faculties) {
		parentGroupIdByChild.set(faculty.id, faculty.university_id)
		const currentChildren = childGroupIdsByParent.get(faculty.university_id) ?? []
		currentChildren.push(faculty.id)
		childGroupIdsByParent.set(faculty.university_id, currentChildren)
	}

	for (const course of courses) {
		parentGroupIdByChild.set(course.id, course.faculty_id)
		const currentChildren = childGroupIdsByParent.get(course.faculty_id) ?? []
		currentChildren.push(course.id)
		childGroupIdsByParent.set(course.faculty_id, currentChildren)
	}

	for (const cls of classes) {
		parentGroupIdByChild.set(cls.id, cls.course_id)
		const currentChildren = childGroupIdsByParent.get(cls.course_id) ?? []
		currentChildren.push(cls.id)
		childGroupIdsByParent.set(cls.course_id, currentChildren)
	}

	const relatedGroupIds = new Set<string>(directGroupIds)
	const queue = [...directGroupIds]

	while (queue.length > 0) {
		const groupId = queue.shift() as string
		const parentId = parentGroupIdByChild.get(groupId)
		if (parentId && !relatedGroupIds.has(parentId)) {
			relatedGroupIds.add(parentId)
			queue.push(parentId)
		}

		for (const childId of childGroupIdsByParent.get(groupId) ?? []) {
			if (relatedGroupIds.has(childId)) continue
			relatedGroupIds.add(childId)
			queue.push(childId)
		}
	}

	const accessibleGroupIds = Array.from(relatedGroupIds)

	if (!accessibleGroupIds.length) return emptyDashboard()

	const { data: groupRowsData, error: groupRowsError } = await supabase
		.from("groups")
		.select("id, name, type")
		.in("id", accessibleGroupIds)

	if (groupRowsError) throw groupRowsError

	const groupRows = (groupRowsData ?? []) as GroupRow[]
	const accessibleGroupMap = new Map<string, GroupRow>(groupRows.map((group) => [group.id, group]))

	const [statsResult, recentFilesResult, eventsResult] = await Promise.all([
		supabase
			.from("files")
			.select("id, file_type")
			.in("group_id", accessibleGroupIds),
		supabase
			.from("files")
			.select("id, name, file_type, created_at, group_id, group:groups(id, name, type)")
			.in("group_id", accessibleGroupIds)
			.order("created_at", { ascending: false })
			.limit(6),
		supabase
			.from("events")
			.select("id, title, description, starts_at, ends_at, created_at, group_id, group:groups(id, name, type)")
				.in("group_id", accessibleGroupIds)
				.gte("starts_at", new Date().toISOString())
			.order("starts_at", { ascending: true })
			.limit(12),
	])

	if (statsResult.error) throw statsResult.error
	if (recentFilesResult.error) throw recentFilesResult.error
	if (eventsResult.error) throw eventsResult.error

	const fileStats = (statsResult.data ?? []) as Pick<FileRow, "file_type">[]
	const recentFiles = (recentFilesResult.data ?? []) as FileRow[]
	const eventRows = (eventsResult.data ?? []) as EventRow[]

	const stats: DashboardStats = {
		materials: fileStats.length,
		notes: fileStats.filter((file) => file.file_type === "note").length,
		summaries: fileStats.filter((file) => file.file_type === "summary").length,
		quizzes: fileStats.filter((file) => file.file_type === "quiz").length,
	}

	const now = Date.now()
	const todayStart = new Date()
	todayStart.setHours(0, 0, 0, 0)
	const tomorrowStart = new Date(todayStart)
	tomorrowStart.setDate(tomorrowStart.getDate() + 1)
	const decoratedEvents = eventRows.map((event) => {
		const parsedDescription = parseStoredDescription(event.description)
		const scopeGroup = parsedDescription.scopeGroupId ? accessibleGroupMap.get(parsedDescription.scopeGroupId) ?? null : null
		const eventGroup = accessibleGroupMap.get(event.group_id) ?? resolveGroup(event.group, event.group_id)
		const resolvedGroup = scopeGroup ?? eventGroup
		const startsAt = event.starts_at ?? event.created_at
		const endsAt = event.ends_at ?? event.starts_at ?? event.created_at
		const allDay = isAllDayEvent(startsAt, endsAt)

		return {
			id: String(event.id),
			title: event.title,
			group: resolvedGroup.name,
			type: resolvedGroup.type,
			startsAt,
			endsAt,
			allDay,
			moment: new Date(startsAt).getTime(),
			seriesId: parsedDescription.seriesId,
			sessionKind: parsedDescription.sessionKind,
			location: parsedDescription.location,
			isPersonal: resolvedGroup.type === 'personal',
		}
	})

	const upcomingEvents = decoratedEvents
		.filter((event) => event.allDay)
		.filter((event) => event.moment >= now)
		.slice(0, 5)
		.map((event) => ({
			id: event.id,
			title: event.title,
			date: event.startsAt,
			group: event.group,
			type: event.type,
			sessionKind: event.sessionKind,
			location: event.location,
			isPersonal: event.isPersonal,
		}))

	const todaySchedule = decoratedEvents
		.filter((event) => event.type !== "personal")
		.filter((event) => !event.allDay)
		.filter((event) => event.moment >= todayStart.getTime() && event.moment < tomorrowStart.getTime())
		.slice(0, 5)
		.map((event) => {
			const startTime = new Date(event.startsAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })
			const endTime = event.endsAt ? new Date(event.endsAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }) : ''
			const time = endTime && endTime !== startTime ? `${startTime} – ${endTime}` : startTime

			return {
				id: event.id,
				subject: event.title,
				group: event.group,
				time,
				type: event.type,
				startsAt: event.startsAt,
				endsAt: event.endsAt,
				sessionKind: event.sessionKind,
				location: event.location,
				isPersonal: event.isPersonal,
			}
		})

	const activityRows = [
		...recentFiles.map((file) => {
			const group = resolveGroup(file.group, file.group_id)
			return {
				id: `file-${file.id}`,
				title: file.name,
				detail: `${activityKindLabel[file.file_type]} · ${group.name}`,
				time: formatRelativeTime(file.created_at),
				kind: file.file_type,
				moment: new Date(file.created_at).getTime(),
			}
		}),
		...eventRows
			.slice()
			.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
			.slice(0, 3)
			.map((event) => {
				const group = resolveGroup(event.group, event.group_id)
				const parsed = parseStoredDescription(event.description)
				const sessionLabel = parsed.sessionKind ? sessionKindLabel[parsed.sessionKind] : groupMeta[group.type].label
				const location = parsed.location ? ` · ${parsed.location}` : ''
				return {
					id: `event-${event.id}`,
					title: event.title,
					detail: `${sessionLabel} · ${group.name}${location}`,
					time: formatRelativeTime(event.created_at),
					kind: "event" as const,
					moment: new Date(event.created_at).getTime(),
				}
			}),
	]

	const activities = activityRows
		.sort((left, right) => right.moment - left.moment)
		.slice(0, 6)
		.map(({ moment: _moment, ...activity }) => activity)

	return {
		events: upcomingEvents,
		activities,
		schedule: todaySchedule.length > 0 ? todaySchedule : upcomingEvents.map((event) => ({
			id: event.id,
			subject: event.title,
			group: event.group,
			time: new Date(event.date).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }),
			type: event.type,
		})),
		stats,
	}
}

const { data } = await useAsyncData("dashboard-home", loadDashboard, {
	default: emptyDashboard,
	watch: [currentUserId],
})

const metrics = computed<DashboardMetric[]>(() => [
	{ label: "Materiały", value: String(data.value?.stats.materials ?? 0), note: "Zasoby do przeglądu", icon: "i-lucide-folder-open", tone: "tone-course" },
	{ label: "Notatki", value: String(data.value?.stats.notes ?? 0), note: "Opracowania z zajęć", icon: "i-lucide-notebook-pen", tone: "tone-uni" },
	{ label: "Streszczenia", value: String(data.value?.stats.summaries ?? 0), note: "Gotowe skróty treści", icon: "i-lucide-file-text", tone: "tone-fac" },
	{ label: "Quizy", value: String(data.value?.stats.quizzes ?? 0), note: "Szybkie powtórki", icon: "i-lucide-award", tone: "tone-course" },
])

const upcomingEvents = computed(() => data.value?.events ?? [])
const recentActivities = computed(() => data.value?.activities ?? [])
const todaySchedule = computed(() => data.value?.schedule ?? [])

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

				<section class="hero">
					<p class="kicker">{{ heroDateTime }}</p>
					<h1 class="hero-title">Witaj, {{ displayName }}</h1>
					<p class="hero-desc">Szybki przegląd materiałów, aktywności i grup.</p>
				</section>

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

				<div class="cols">

					<div class="panel">
						<div class="panel-hd">
							<div>
								<h2 class="panel-title">Nadchodzące terminy</h2>
							</div>
							<UBadge color="neutral" variant="soft">{{ upcomingEvents.length }}</UBadge>
						</div>
						<ul class="panel-bd">
							<li v-if="!upcomingEvents.length" class="row row--empty">
								<p class="sub">Brak nadchodzących terminów.</p>
							</li>
							<li v-for="ev in upcomingEvents" :key="ev.id" class="row">
								<div class="row-body">
									<p class="row-title">{{ ev.title }}</p>
										<p class="sub">{{ formatAllDayDate(ev.date) }} · {{ ev.group }}</p>
								</div>
								<UBadge :class="groupMeta[ev.type].chip" variant="soft" size="sm">
									{{ groupMeta[ev.type].label }}
								</UBadge>
							</li>
						</ul>
					</div>

					<div class="panel">
						<div class="panel-hd">
							<div>
								<h2 class="panel-title">Plan zajęć</h2>
							</div>
							<UBadge color="neutral" variant="soft">{{ todaySchedule.length }}</UBadge>
						</div>
						<ul class="panel-bd">
							<li v-if="!todaySchedule.length" class="row row--empty">
								<p class="sub">Brak zajęć na dziś.</p>
							</li>
							<li v-for="s in todaySchedule" :key="s.id" class="row">
								<span class="sched-time">{{ s.time }}</span>
								<div class="row-body">
									<p class="row-title">{{ s.subject }}</p>
									<p class="sub">{{ s.group }} · {{ groupMeta[s.type].label }}</p>
								</div>
							</li>
						</ul>
					</div>

					<div class="panel">
						<div class="panel-hd">
							<div>
								<h2 class="panel-title">Aktywność</h2>
							</div>
							<UBadge color="primary" variant="soft">{{ recentActivities.length }}</UBadge>
						</div>
						<ul class="panel-bd">
							<li v-if="!recentActivities.length" class="row row--empty">
								<p class="sub">Brak ostatnich aktywności.</p>
							</li>
							<li v-for="act in recentActivities" :key="act.id" class="row row--activity">
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
.dash {
	height: 100%;
	overflow: hidden;
	padding: 1rem;
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

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

.cols {
	flex: 1;
	min-height: 0;
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 0.75rem;
}

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

.row {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	padding: 0.7rem 0;
	border-bottom: 1px solid var(--ui-border);
}

.row:last-child { border-bottom: none; }

.row--activity { align-items: flex-start; }

.row--empty {
	justify-content: center;
	color: var(--ui-text-muted);
}

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
.dot-event   { background: #7C3AED; }

.sched-time {
	flex-shrink: 0;
	width: 5.5rem;
	font-size: 0.72rem;
	font-weight: 700;
	color: var(--ui-text-muted);
}

.kicker {
	font-size: 0.68rem;
	font-weight: 700;
	color: var(--ui-text-muted);
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.sub { font-size: 0.78rem; color: var(--ui-text-muted); }

.tone-uni    { background: #0F6E56; }
.tone-fac    { background: #185FA5; }
.tone-course { background: #BA7517; }

.chip-uni    { background: #E1F5EE; color: #0F6E56; }
.chip-fac    { background: #E6F1FB; color: #185FA5; }
.chip-course { background: #FAEEDA; color: #BA7517; }
.chip-class  { background: #F3E8FF; color: #7C3AED; }
.chip-personal { background: #FCE7F3; color: #BE185D; }

@media (max-width: 768px) {
	.dash { padding: 0.75rem; overflow-y: auto; }
	.cols { grid-template-columns: 1fr; flex: none; }
	.panel { min-height: 300px; }
}
</style>