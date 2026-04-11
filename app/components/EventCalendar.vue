<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { CalendarOptions, EventClickArg, DateSelectArg, EventDropArg } from '@fullcalendar/core'
import type { Database } from '~/types/database.types'

// Types 
interface CalEvent {
  id: string
  title: string
  start: string
  end: string
  classNames: string[]
  extendedProps: {
    location?: string
    description?: string
    seriesId?: string
    type: 'university' | 'faculty' | 'course' | 'class' | 'private'
    groupId?: string | null
    uploadedBy?: string | null
    canEdit?: boolean
  }
  allDay?: boolean
}

interface MembershipItem {
  id: string
  group_id: string
  role: MembershipRole
  user_id: string
  group: {
    type: Database['public']['Enums']['group_type']
    name: string
  } | null
}

type GroupType = Database['public']['Enums']['group_type']

interface GroupOption {
  id: string
  name: string
  type: GroupType
  role: MembershipRole
}

interface FacultyLink {
  id: string
  university_id: string
}

interface CourseLink {
  id: string
  faculty_id: string
}

interface ClassLink {
  id: string
  course_id: string
}

interface EventMutationArg {
  event: {
    id: string
    startStr: string
    endStr: string
    extendedProps?: {
      canEdit?: boolean
      seriesId?: string
    }
  }
  revert: () => void
}

type MembershipRole = Database['public']['Enums']['membership_role']

// State 
const supabase = useSupabaseClient<Database>()
const user = useSupabaseUser()
const toast = useToast()
const calendarRef = ref<InstanceType<typeof FullCalendar> | null>(null)

const currentUserId = computed(() => user.value?.id ?? (user.value as { sub?: string } | null)?.sub ?? '')

const { data: memberships, pending: membershipsPending, refresh: refreshMemberships } = await useAsyncData<MembershipItem[]>(
  'calendar-memberships',
  async () => {
    if (!currentUserId.value) return []

    const { data, error } = await supabase
      .from('user_memberships')
      .select('id, group_id, role, user_id, group:groups(type, name)')
      .eq('user_id', currentUserId.value)

    if (error) throw error
    return data ?? []
  },
  { default: () => [] },
)

const currentRole = computed<MembershipRole>(() => {
  const roles = memberships.value.map(membership => membership.role)
  if (roles.includes('admin')) return 'admin'
  if (roles.includes('instructor')) return 'instructor'
  return 'student'
})

const personalGroupId = computed(() => memberships.value.find(membership => membership.group?.type === 'personal')?.group_id ?? null)
const userGroupIds = computed(() => memberships.value.map(membership => membership.group_id))

const canEditPrivateEvents = computed(() =>
  currentRole.value === 'admin' || currentRole.value === 'student' || currentRole.value === 'instructor',
)
const isCreating = ref(false)
const isSavingEdit = ref(false)
const addError = ref<string | null>(null)

const selectedEvent = ref<CalEvent | null>(null)
const isEditingEvent = ref(false)
const eventActionError = ref<string | null>(null)
const showEventModal = ref(false)
const showAddModal = ref(false)
const showSeriesScopeModal = ref(false)
const addSlot = ref<{ start: string; end: string; allDay: boolean } | null>(null)
const selectedViewGroupId = ref<string | null>(null)
const createAsPrivate = ref(false)
const applyEditToFollowing = ref(false)
const repeatWeekly = ref(false)
const repeatWeeks = ref(2)
const semesterWeekLimit = 15
const ensuringPersonalGroup = ref(false)

const modalUi = {
  content: '!bg-transparent !shadow-none !ring-0 !divide-y-0 !border-0 !p-0 !overflow-visible w-[calc(100vw-2rem)] !max-w-[400px]',
}

const seriesScopePrompt = ref('')
let resolveSeriesScopeChoice: ((choice: 'single' | 'following' | 'cancel') => void) | null = null

const newEvent = ref({ title: '', location: '', description: '' })
const editEvent = ref({ title: '', location: '', description: '' })

// Helpers 
function pad(n: number) { return n.toString().padStart(2, '0') }
function offsetDay(offset: number, hour = 0, min = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:${pad(min)}:00`
}

function normalizeDbDateTime(value: string) {
  if (!value) return value
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00`
  return value
}

function extractTime(value: string) {
  if (!value) return ''
  if (value.includes('T')) return value.split('T')[1]?.slice(0, 8) ?? ''
  if (value.includes(' ')) return value.split(' ')[1]?.slice(0, 8) ?? ''
  return ''
}

function isDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function formatLocalDateTime(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function addDaysKeepingTime(value: string, days: number) {
  const base = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  base.setDate(base.getDate() + days)

  // Keep timezone information for DB writes to avoid local -> UTC drift (e.g. +2h shifts).
  if (value.includes('T') && (value.includes('Z') || /[+-]\d{2}:\d{2}$/.test(value))) {
    return base.toISOString()
  }

  return formatLocalDateTime(base)
}

function toDateKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value.includes('T') ? value : `${value}T00:00:00`)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function parseStoredDescription(raw?: string | null) {
  const text = (raw ?? '').trim()
  if (!text) return { note: '', location: '', seriesId: '' }

  const lines = text.split(/\r?\n/)
  let cursor = 0
  let location = ''
  let seriesId = ''

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

    break
  }

  const note = lines.slice(cursor).join('\n').trim()
  if (!location && !seriesId) return { note: text, location: '', seriesId: '' }
  return { note, location, seriesId }
}

function buildStoredDescription(note: string, location: string, seriesId?: string | null) {
  const meta: string[] = []
  if (location.trim()) meta.push(`@loc:${location.trim()}`)
  if (seriesId?.trim()) meta.push(`@series:${seriesId.trim()}`)

  const cleanNote = note.trim()
  if (!meta.length) return cleanNote || null
  if (!cleanNote) return meta.join('\n')
  return `${meta.join('\n')}\n\n${cleanNote}`
}

function buildSeriesId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `series-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

// Temp Seed events 
const fallbackEvents: CalEvent[] = [
  {
    id: 'seed-1',
    title: 'Algorytmy – wyklad',
    start: offsetDay(0, 10, 0),
    end: offsetDay(0, 12, 0),
    classNames: ['ev-class'],
    extendedProps: { type: 'class', location: 'Aula A1', description: 'Wyklad grupowy.' },
  },
  {
    id: 'seed-2',
    title: 'Dzien wydzialu',
    start: offsetDay(4),
    end: offsetDay(5),
    classNames: ['ev-faculty'],
    extendedProps: { type: 'faculty', description: 'Wydarzenie wydzialowe.' },
    allDay: true,
  },
]

const events = ref<CalEvent[]>([])

const { data: hierarchy } = await useAsyncData<{
  faculties: FacultyLink[]
  courses: CourseLink[]
  classes: ClassLink[]
}>(
  'calendar-hierarchy',
  async () => {
    const [facultiesResult, coursesResult, classesResult] = await Promise.all([
      supabase.from('faculties').select('id, university_id'),
      supabase.from('courses').select('id, faculty_id'),
      supabase.from('classes').select('id, course_id'),
    ])

    if (facultiesResult.error) throw facultiesResult.error
    if (coursesResult.error) throw coursesResult.error
    if (classesResult.error) throw classesResult.error

    return {
      faculties: facultiesResult.data ?? [],
      courses: coursesResult.data ?? [],
      classes: classesResult.data ?? [],
    }
  },
  {
    default: () => ({ faculties: [], courses: [], classes: [] }),
  },
)

const parentByGroupId = computed(() => {
  const map = new Map<string, string>()
  for (const faculty of hierarchy.value.faculties) map.set(faculty.id, faculty.university_id)
  for (const course of hierarchy.value.courses) map.set(course.id, course.faculty_id)
  for (const cls of hierarchy.value.classes) map.set(cls.id, cls.course_id)
  return map
})

const facultyIdSet = computed(() => new Set(hierarchy.value.faculties.map(faculty => faculty.id)))
const courseIdSet = computed(() => new Set(hierarchy.value.courses.map(course => course.id)))
const classIdSet = computed(() => new Set(hierarchy.value.classes.map(cls => cls.id)))
const universityIdSet = computed(() => new Set(hierarchy.value.faculties.map(faculty => faculty.university_id)))

function collectAncestorGroupIds(groupId: string) {
  const result = new Set<string>()
  let currentParent = parentByGroupId.value.get(groupId)

  while (currentParent) {
    if (result.has(currentParent)) break
    result.add(currentParent)
    currentParent = parentByGroupId.value.get(currentParent)
  }

  return result
}

const allRelevantGroupIds = computed(() => {
  const result = new Set<string>(userGroupIds.value)

  for (const groupId of userGroupIds.value) {
    const groupType = memberships.value.find(membership => membership.group_id === groupId)?.group?.type
    if (groupType === 'personal') continue

    for (const ancestorId of collectAncestorGroupIds(groupId)) {
      result.add(ancestorId)
    }
  }

  return Array.from(result)
})

const { data: dbEvents, refresh: refreshEvents } = await useAsyncData(
  'calendar-events',
  async () => {
    if (!allRelevantGroupIds.value.length) return []

    const { data, error } = await supabase
      .from('events')
      .select('id, title, description, starts_at, ends_at, created_at, group_id, uploaded_by')
      .in('group_id', allRelevantGroupIds.value)
      .order('starts_at', { ascending: true })

    if (error) throw error
    return data ?? []
  },
  {
    default: () => [],
    watch: [allRelevantGroupIds],
  },
)

function resolveEventType(groupId: string): CalEvent['extendedProps']['type'] {
  if (groupId === personalGroupId.value) return 'private'
  if (classIdSet.value.has(groupId)) return 'class'
  if (courseIdSet.value.has(groupId)) return 'course'
  if (facultyIdSet.value.has(groupId)) return 'faculty'
  if (universityIdSet.value.has(groupId)) return 'university'

  const groupType = memberships.value.find(membership => membership.group_id === groupId)?.group?.type
  if (groupType === 'class') return 'class'
  if (groupType === 'course') return 'course'
  if (groupType === 'faculty') return 'faculty'
  if (groupType === 'university') return 'university'
  return 'class'
}

const allGroups = computed<GroupOption[]>(() => {
  const seen = new Set<string>()
  const result: GroupOption[] = []

  for (const membership of memberships.value) {
    const groupType = membership.group?.type
    if (!groupType) continue
    if (seen.has(membership.group_id)) continue
    seen.add(membership.group_id)
    result.push({
      id: membership.group_id,
      name: membership.group?.name ?? membership.group_id,
      type: groupType,
      role: membership.role,
    })
  }

  return result
})

const selectableViewGroups = computed<GroupOption[]>(() => {
  return allGroups.value.filter(group => group.role === 'instructor' && group.type !== 'personal')
})

const visibleEvents = computed(() => {
  const ownPrivateEvents = events.value.filter(event =>
    event.extendedProps.type === 'private'
    && event.extendedProps.uploadedBy === currentUserId.value,
  )

  if (!selectedViewGroupId.value) return ownPrivateEvents

  const selectedGroup = allGroups.value.find(group => group.id === selectedViewGroupId.value)
  if (!selectedGroup) return ownPrivateEvents

  const scopeIds = new Set<string>([selectedViewGroupId.value])
  if (selectedGroup.type !== 'personal') {
    for (const ancestorId of collectAncestorGroupIds(selectedViewGroupId.value)) {
      scopeIds.add(ancestorId)
    }
  }

  const scopedEvents = events.value.filter((event) => {
    const groupId = event.extendedProps.groupId
    if (!groupId) return false
    return scopeIds.has(groupId)
  })

  const mergedById = new Map<string, CalEvent>()
  for (const event of scopedEvents) mergedById.set(event.id, event)
  for (const event of ownPrivateEvents) mergedById.set(event.id, event)
  return Array.from(mergedById.values())
})

function resolveTargetGroupIdForCreate() {
  if (selectedViewGroupId.value && allGroups.value.some(group => group.id === selectedViewGroupId.value)) {
    return selectedViewGroupId.value
  }
  return null
}

async function ensurePersonalGroupId() {
  if (personalGroupId.value) return personalGroupId.value
  if (!currentUserId.value) {
    throw new Error('Brak aktywnego użytkownika.')
  }

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({
      name: `Private - ${user.value?.email ?? 'user'}`,
      type: 'personal',
    })
    .select('id')
    .single()

  if (groupError) throw groupError

  if (!group?.id) {
    throw new Error('Nie udało się utworzyć grupy prywatnej.')
  }

  const { error: membershipError } = await supabase.from('user_memberships').insert({
    group_id: group.id,
    user_id: currentUserId.value,
    role: 'student',
  })

  if (membershipError) throw membershipError

  await Promise.all([
    refreshEvents(),
    refreshMemberships(),
  ])

  return group.id
}

watch(
  [dbEvents, memberships],
  () => {
    if (!dbEvents.value.length) {
      events.value = fallbackEvents
      return
    }

    events.value = dbEvents.value.map((eventRow) => {
      const eventType = resolveEventType(eventRow.group_id)
      const parsedDescription = parseStoredDescription(eventRow.description)
      const startsAt = eventRow.starts_at ?? eventRow.created_at
      const endsAt = eventRow.ends_at ?? eventRow.starts_at ?? eventRow.created_at
      const isAllDay = Boolean(
        startsAt
          && endsAt
          && (
            (isDateOnly(startsAt) && isDateOnly(endsAt))
            || (extractTime(startsAt) === '00:00:00' && extractTime(endsAt) === '00:00:00')
          ),
      )

      return {
        id: String(eventRow.id),
        title: eventRow.title,
        start: startsAt,
        end: endsAt,
        classNames: [`ev-${eventType}`],
        extendedProps: {
          type: eventType,
          description: parsedDescription.note || undefined,
          location: parsedDescription.location || undefined,
          seriesId: parsedDescription.seriesId || undefined,
          groupId: eventRow.group_id,
          uploadedBy: eventRow.uploaded_by,
        },
        allDay: isAllDay,
      }
    })
  },
  { immediate: true, deep: true },
)

const calendarEvents = computed(() =>
  visibleEvents.value.map((event) => {
    const isAllDayEvent = Boolean(event.allDay)
    const isOwner = !event.extendedProps.uploadedBy || event.extendedProps.uploadedBy === currentUserId.value
    const eventGroupId = event.extendedProps.groupId
    const hasInstructorAccess = Boolean(
      eventGroupId
      && memberships.value.some(membership => membership.group_id === eventGroupId && membership.role === 'instructor'),
    )
    const canEditThisEvent = currentRole.value === 'admin'
      || (event.extendedProps.type === 'private' && canEditPrivateEvents.value && isOwner)
      || (event.extendedProps.type !== 'private' && currentRole.value === 'instructor' && hasInstructorAccess)
    const classNames = isAllDayEvent ? [...event.classNames, 'ev-all-day'] : event.classNames

    return {
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      allDay: event.allDay,
      classNames,
      backgroundColor: typeConfig[event.extendedProps.type].bg,
      borderColor: typeConfig[event.extendedProps.type].border,
      editable: canEditThisEvent,
      startEditable: canEditThisEvent,
      durationEditable: canEditThisEvent,
      display: 'auto',
      extendedProps: {
        ...event.extendedProps,
        canEdit: canEditThisEvent,
      },
    }
  }),
)

const allDayTitlesByDate = computed<Record<string, string[]>>(() => {
  const result: Record<string, string[]> = {}

  for (const event of visibleEvents.value) {
    if (!event.allDay) continue

    const start = new Date(event.start.includes('T') ? event.start : `${event.start}T00:00:00`)
    const rawEnd = new Date(event.end.includes('T') ? event.end : `${event.end}T00:00:00`)
    const end = Number.isNaN(rawEnd.getTime()) ? new Date(start) : rawEnd

    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    const endExclusive = new Date(end.getFullYear(), end.getMonth(), end.getDate())

    if (endExclusive <= cursor) {
      const key = toDateKey(cursor)
      result[key] ||= []
      result[key].push(event.title)
      continue
    }

    while (cursor < endExclusive) {
      const key = toDateKey(cursor)
      result[key] ||= []
      result[key].push(event.title)
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  return result
})

// Event type config 
const typeConfig = {
  university: { label: 'Uczelnia', color: '#f87171', bg: 'rgba(248,113,113,0.14)', border: '#ef4444' },
  faculty:    { label: 'Wydział',  color: '#34d399', bg: 'rgba(16,185,129,0.14)', border: '#10b981' },
  course:     { label: 'Kierunek', color: '#60a5fa', bg: 'rgba(59,130,246,0.14)', border: '#3b82f6' },
  class:      { label: 'Grupa',    color: '#c084fc', bg: 'rgba(168,85,247,0.14)', border: '#a855f7' },
  private:    { label: 'Prywatne', color: '#fbbf24', bg: 'rgba(245,158,11,0.14)', border: '#f59e0b' },
}

function shiftDateTimeByMs(value: string | null | undefined, deltaMs: number) {
  if (!value) return value ?? null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Date(parsed.getTime() + deltaMs).toISOString()
}

async function updateSeriesTiming(
  seriesId: string,
  fromStart: string,
  currentEventId: number,
  deltaStartMs: number,
  deltaEndMs: number,
) {
  const { data: occurrences, error: readError } = await supabase
    .from('events')
    .select('id, starts_at, ends_at')
    .like('description', `%@series:${seriesId}%`)
    .order('starts_at', { ascending: true })

  if (readError) throw readError

  const anchorMs = new Date(fromStart).getTime()
  const rowsFromDb = (occurrences ?? []).filter((row) => {
    if (row.id === currentEventId) return true
    if (!row.starts_at) return false
    const startsAtMs = new Date(row.starts_at).getTime()
    if (Number.isNaN(startsAtMs) || Number.isNaN(anchorMs)) return false
    return startsAtMs >= anchorMs
  })

  const rows = rowsFromDb.length
    ? rowsFromDb
    : events.value
      .filter((event) => {
        if (event.extendedProps.seriesId !== seriesId) return false
        if (Number(event.id) === currentEventId) return true
        const startsAtMs = new Date(event.start).getTime()
        if (Number.isNaN(startsAtMs) || Number.isNaN(anchorMs)) return false
        return startsAtMs >= anchorMs
      })
      .map(event => ({
        id: Number(event.id),
        starts_at: event.start,
        ends_at: event.end,
      }))

  if (!rows.length) return 0

  let updated = 0
  for (const row of rows) {
    const shiftedStart = shiftDateTimeByMs(row.starts_at, deltaStartMs)
    const shiftedEnd = shiftDateTimeByMs(row.ends_at, deltaEndMs)

    const { data, error } = await supabase
      .from('events')
      .update({
        starts_at: shiftedStart,
        ends_at: shiftedEnd,
      })
      .eq('id', row.id)
      .select('id')

    if (error) throw error
    if (data?.length) updated += data.length
  }

  return updated
}

async function updateSingleEventTiming(eventId: number, start: string, end: string) {
  const { data, error } = await supabase
    .from('events')
    .update({
      starts_at: start,
      ends_at: end,
    })
    .eq('id', eventId)
    .select('id')

  if (error) throw error
  return data?.length ?? 0
}

async function askSeriesScope(prompt: string) {
  seriesScopePrompt.value = prompt
  showSeriesScopeModal.value = true

  return await new Promise<'single' | 'following' | 'cancel'>((resolve) => {
    resolveSeriesScopeChoice = resolve
  })
}

function resolveSeriesScope(choice: 'single' | 'following' | 'cancel') {
  showSeriesScopeModal.value = false
  if (resolveSeriesScopeChoice) {
    resolveSeriesScopeChoice(choice)
    resolveSeriesScopeChoice = null
  }
}

// FullCalendar options
const calOptions = computed<CalendarOptions>(() => ({
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: 'timeGridWeek',
  locale: 'pl',
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'timeGridWeek,dayGridMonth',
  },
  buttonText: { today: 'Dziś', week: 'Tydzień', month: 'Miesiąc' },
  slotMinTime: '08:00:00',
  slotMaxTime: '21:00:00',
  slotDuration: '00:30:00',
  slotLabelInterval: '01:00:00',
  allDaySlot: false,
  slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
  eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
  firstDay: 1,
  nowIndicator: true,
  selectable: true,
  selectMirror: true,
  editable: true,
  dayMaxEvents: true,
  dayMaxEventRows: 3,
  height: '100%',
  contentHeight: '100%',
  expandRows: true,
  stickyHeaderDates: true,
  events: calendarEvents.value,
  eventOverlap: true,
  eventDisplay: 'auto',
  eventOrder(a: unknown, b: unknown) {
    const evA = a as { allDay?: boolean; start?: Date; title?: string }
    const evB = b as { allDay?: boolean; start?: Date; title?: string }

    if (evA.allDay !== evB.allDay) return evA.allDay ? -1 : 1

    const aStart = evA.start ? Number(evA.start) : 0
    const bStart = evB.start ? Number(evB.start) : 0
    if (aStart !== bStart) return aStart - bStart

    return (evA.title ?? '').localeCompare(evB.title ?? '')
  },

  dayHeaderContent(arg) {
    const viewType = arg.view?.type ?? ''
    if (!viewType.startsWith('timeGrid')) {
      return { text: arg.text }
    }

    const key = toDateKey(arg.date)
    const titles = allDayTitlesByDate.value[key] ?? []
    const primaryTitle = titles[0] ?? ''
    const hiddenCount = Math.max(0, titles.length - 1)
    const strip = primaryTitle
      ? `<div class="fc-all-day-strip"><span class="fc-all-day-trapezoid" title="${escapeHtml(primaryTitle)}">${escapeHtml(primaryTitle)}${hiddenCount > 0 ? ` +${hiddenCount}` : ''}</span></div>`
      : ''

    return {
      html: `<div class="fc-day-header-wrap"><span class="fc-day-header-label">${escapeHtml(arg.text)}</span>${strip}</div>`,
    }
  },

  select(info: DateSelectArg) {
    if (membershipsPending.value) return

    addSlot.value = { start: info.startStr, end: info.endStr, allDay: info.allDay }
    newEvent.value = { title: '', location: '', description: '' }
    createAsPrivate.value = false
    addError.value = null
    repeatWeekly.value = false
    repeatWeeks.value = 2
    showAddModal.value = true
  },

  eventClick(info: EventClickArg) {
    eventActionError.value = null
    isEditingEvent.value = false
    selectedEvent.value = {
      id: info.event.id,
      title: info.event.title,
      start: info.event.startStr,
      end: info.event.endStr,
      classNames: info.event.classNames,
      extendedProps: info.event.extendedProps as CalEvent['extendedProps'],
      allDay: info.event.allDay,
    }
    editEvent.value = {
      title: info.event.title,
      location: (info.event.extendedProps?.location as string | undefined) ?? '',
      description: (info.event.extendedProps?.description as string | undefined) ?? '',
    }
    applyEditToFollowing.value = false
    showEventModal.value = true
  },

  async eventDrop(info: EventDropArg) {
    const idx = events.value.findIndex(e => e.id === info.event.id)
    const canMoveEvent = Boolean(info.event.extendedProps?.canEdit)

    if (!canMoveEvent) {
      toast.add({
        title: 'Brak uprawnień',
        description: 'Nie masz uprawnień do edycji tego wydarzenia.',
        color: 'warning',
      })
      info.revert()
      return
    }

    const previousStart = idx !== -1 ? events.value[idx]?.start : null
    const previousEnd = idx !== -1 ? events.value[idx]?.end : null

    if (idx !== -1) {
      const targetEvent = events.value[idx]
      if (targetEvent) {
        targetEvent.start = info.event.startStr
        targetEvent.end = info.event.endStr
      }
    }

    const eventId = Number(info.event.id)
    if (!Number.isFinite(eventId)) return

    const seriesId = (info.event.extendedProps?.seriesId as string | undefined) ?? ''
    let mode: 'single' | 'following' | 'cancel' = 'single'
    if (seriesId) {
      mode = await askSeriesScope('To wydarzenie należy do serii. Jak zastosować przesunięcie?')
    }

    if (mode === 'cancel') {
      info.revert()
      return
    }

    if (mode === 'following' && previousStart && previousEnd) {
      const startDeltaMs = new Date(info.event.startStr).getTime() - new Date(previousStart).getTime()
      const endDeltaMs = new Date(info.event.endStr).getTime() - new Date(previousEnd).getTime()

      try {
        const affected = await updateSeriesTiming(seriesId, previousStart, eventId, startDeltaMs, endDeltaMs)
        if (!affected) {
          const single = await updateSingleEventTiming(eventId, info.event.startStr, info.event.endStr)
          if (!single) {
            info.revert()
            toast.add({
              title: 'Brak uprawnień',
              description: 'Nie udało się zapisać zmian dla tego wydarzenia.',
              color: 'warning',
            })
            return
          }
          await refreshEvents()
          toast.add({
            title: 'Zaktualizowano wydarzenie',
            description: 'Nie znaleziono kolejnych wystąpień serii, zaktualizowano tylko to wydarzenie.',
            color: 'warning',
          })
          return
        }

        await refreshEvents()
        toast.add({
          title: 'Zaktualizowano serię',
          description: `Przesunięto ${affected} wydarzeń w serii.`,
          color: 'success',
        })
        return
      } catch (error) {
        info.revert()
        toast.add({
          title: 'Nie udało się przesunąć serii',
          description: error instanceof Error ? error.message : 'Wystąpił błąd podczas zapisu serii.',
          color: 'error',
        })
        return
      }
    }

    const { data, error } = await supabase
      .from('events')
      .update({
        starts_at: info.event.startStr,
        ends_at: info.event.endStr,
      })
      .eq('id', eventId)
      .select('id')

    if (error) {
      info.revert()
      toast.add({
        title: 'Nie udało się przesunąć wydarzenia',
        description: error.message,
        color: 'error',
      })
      return
    }

    if (!data?.length) {
      info.revert()
      toast.add({
        title: 'Brak uprawnień',
        description: 'Nie masz uprawnień do edycji tego wydarzenia.',
        color: 'warning',
      })
      return
    }

    await refreshEvents()
  },

  async eventResize(info: EventMutationArg) {
    const idx = events.value.findIndex(e => e.id === info.event.id)
    const canResizeEvent = Boolean(info.event.extendedProps?.canEdit)

    if (!canResizeEvent) {
      toast.add({
        title: 'Brak uprawnień',
        description: 'Nie możesz zmieniać długości tego wydarzenia.',
        color: 'warning',
      })
      info.revert()
      return
    }

    const previousStart = idx !== -1 ? events.value[idx]?.start : null
    const previousEnd = idx !== -1 ? events.value[idx]?.end : null

    if (idx !== -1) {
      const targetEvent = events.value[idx]
      if (targetEvent) {
        targetEvent.start = info.event.startStr
        targetEvent.end = info.event.endStr
      }
    }

    const eventId = Number(info.event.id)
    if (!Number.isFinite(eventId)) return

    const seriesId = (info.event.extendedProps?.seriesId as string | undefined) ?? ''
    let mode: 'single' | 'following' | 'cancel' = 'single'
    if (seriesId) {
      mode = await askSeriesScope('To wydarzenie należy do serii. Jak zastosować zmianę długości?')
    }

    if (mode === 'cancel') {
      info.revert()
      return
    }

    if (mode === 'following' && previousStart && previousEnd) {
      const startDeltaMs = new Date(info.event.startStr).getTime() - new Date(previousStart).getTime()
      const endDeltaMs = new Date(info.event.endStr).getTime() - new Date(previousEnd).getTime()

      try {
        const affected = await updateSeriesTiming(seriesId, previousStart, eventId, startDeltaMs, endDeltaMs)
        if (!affected) {
          const single = await updateSingleEventTiming(eventId, info.event.startStr, info.event.endStr)
          if (!single) {
            info.revert()
            toast.add({
              title: 'Brak uprawnień',
              description: 'Nie udało się zapisać zmian dla tego wydarzenia.',
              color: 'warning',
            })
            return
          }
          await refreshEvents()
          toast.add({
            title: 'Zaktualizowano wydarzenie',
            description: 'Nie znaleziono kolejnych wystąpień serii, zaktualizowano tylko to wydarzenie.',
            color: 'warning',
          })
          return
        }

        await refreshEvents()
        toast.add({
          title: 'Zaktualizowano serię',
          description: `Zmieniono czas trwania dla ${affected} wydarzeń w serii.`,
          color: 'success',
        })
        return
      } catch (error) {
        info.revert()
        toast.add({
          title: 'Nie udało się zaktualizować serii',
          description: error instanceof Error ? error.message : 'Wystąpił błąd podczas zapisu serii.',
          color: 'error',
        })
        return
      }
    }

    const { data, error } = await supabase
      .from('events')
      .update({
        starts_at: info.event.startStr,
        ends_at: info.event.endStr,
      })
      .eq('id', eventId)
      .select('id')

    if (error) {
      info.revert()
      toast.add({
        title: 'Nie udało się zmienić czasu trwania',
        description: error.message,
        color: 'error',
      })
      return
    }

    if (!data?.length) {
      info.revert()
      toast.add({
        title: 'Brak uprawnień',
        description: 'Nie masz uprawnień do edycji tego wydarzenia.',
        color: 'warning',
      })
      return
    }

    await refreshEvents()
  },

  eventContent(arg) {
    const type = arg.event.extendedProps?.type as keyof typeof typeConfig
    const loc = arg.event.extendedProps?.location
    return {
      html: `
        <div class="fc-event-inner fc-event-inner--${type || 'private'}">
          <span class="fc-event-title">${arg.event.title}</span>
          ${loc ? `<span class="fc-event-loc">${loc}</span>` : ''}
        </div>`,
    }
  },
}))

// Actions
async function confirmAdd() {
  if (!newEvent.value.title.trim() || !addSlot.value) return
  if (isCreating.value) return

  addError.value = null
  isCreating.value = true

  try {
    let targetGroupId: string | null = null

    if (createAsPrivate.value) {
      targetGroupId = await ensurePersonalGroupId()
    } else {
      targetGroupId = resolveTargetGroupIdForCreate()
    }

    if (!targetGroupId) {
      addError.value = 'Wybierz konkretną grupę w górnym selekcie kalendarza.'
      return
    }

    const baseStart = normalizeDbDateTime(addSlot.value.start)
    const baseEnd = normalizeDbDateTime(addSlot.value.end)
    const totalOccurrences = repeatWeekly.value ? Math.min(Math.max(repeatWeeks.value, 1), semesterWeekLimit) : 1
    const seriesId = totalOccurrences > 1 ? buildSeriesId() : null

    const rows = Array.from({ length: totalOccurrences }, (_, index) => {
      const dayOffset = index * 7
      return {
        title: newEvent.value.title,
        description: buildStoredDescription(newEvent.value.description, newEvent.value.location, seriesId),
        starts_at: addDaysKeepingTime(baseStart, dayOffset),
        ends_at: addDaysKeepingTime(baseEnd, dayOffset),
        group_id: targetGroupId,
        uploaded_by: currentUserId.value,
      }
    })

    const { error } = await supabase
      .from('events')
      .insert(rows)

    if (error) throw error

    await refreshEvents()
    showAddModal.value = false
  } catch (error) {
    addError.value = error instanceof Error ? error.message : 'Nie udało się zapisać wydarzenia.'
  } finally {
    isCreating.value = false
  }
}

async function saveEventEdits() {
  if (!selectedEvent.value) return
  if (!editEvent.value.title.trim()) {
    eventActionError.value = 'Tytuł jest wymagany.'
    return
  }
  if (!canDeleteEvent(selectedEvent.value)) {
    eventActionError.value = 'Nie możesz edytować tego wydarzenia.'
    return
  }

  const eventId = Number(selectedEvent.value.id)
  if (!Number.isFinite(eventId)) return

  isSavingEdit.value = true
  eventActionError.value = null

  const currentSeriesId = selectedEvent.value.extendedProps.seriesId ?? ''
  if (applyEditToFollowing.value && !currentSeriesId) {
    eventActionError.value = 'To wydarzenie nie należy do serii powtarzalnej.'
    isSavingEdit.value = false
    return
  }

  const updatePayload = {
    title: editEvent.value.title,
    description: buildStoredDescription(editEvent.value.description, editEvent.value.location, currentSeriesId || null),
    group_id: selectedEvent.value.extendedProps.groupId || undefined,
  }

  let data: { id: number }[] | null = null
  let error: Error | null = null

  if (applyEditToFollowing.value && currentSeriesId) {
    const result = await supabase
      .from('events')
      .update({
        title: updatePayload.title,
        description: updatePayload.description,
      })
      .like('description', `%@series:${currentSeriesId}%`)
      .gte('starts_at', normalizeDbDateTime(selectedEvent.value.start))
      .select('id')

    data = result.data
    error = result.error
  } else {
    const result = await supabase
      .from('events')
      .update(updatePayload)
      .eq('id', eventId)
      .select('id')

    data = result.data
    error = result.error
  }

  if (error) {
    eventActionError.value = error.message
    isSavingEdit.value = false
    return
  }

  if (!data?.length) {
    eventActionError.value = 'Nie udało się zapisać zmian (brak uprawnień).'
    isSavingEdit.value = false
    return
  }

  await refreshEvents()
  isEditingEvent.value = false

  selectedEvent.value = {
    ...selectedEvent.value,
    title: editEvent.value.title,
    extendedProps: {
      ...selectedEvent.value.extendedProps,
      location: editEvent.value.location || undefined,
      description: editEvent.value.description || undefined,
      groupId: selectedEvent.value.extendedProps.groupId,
    },
  }

  isSavingEdit.value = false
}

async function deleteEvent() {
  if (!selectedEvent.value) return
  eventActionError.value = null

  if (!canDeleteEvent(selectedEvent.value)) {
    eventActionError.value = 'Nie możesz usunąć tego wydarzenia.'
    return
  }

  const eventId = Number(selectedEvent.value.id)
  if (!Number.isFinite(eventId)) {
    events.value = events.value.filter(e => e.id !== selectedEvent.value!.id)
    showEventModal.value = false
    return
  }

  const query = supabase
    .from('events')
    .delete()
    .eq('id', eventId)

  const { data, error } = await query.select('id')

  if (error) {
    eventActionError.value = error.message
    return
  }

  if (!data?.length) {
    const { data: probeData, error: probeError } = await supabase
      .from('events')
      .select('id, uploaded_by, group_id, title')
      .eq('id', eventId)
      .maybeSingle()

    if (probeError) {
      eventActionError.value = `Nie udało się usunąć wydarzenia. ${probeError.message}`
      return
    }

    if (!probeData) {
      eventActionError.value = 'Nie udało się usunąć wydarzenia. Rekord nie istnieje albo nie masz do niego dostępu.'
      return
    }

    if (probeData.uploaded_by === currentUserId.value) {
      eventActionError.value = 'Nie udało się usunąć wydarzenia. Polityka RLS w Supabase blokuje DELETE dla tego użytkownika.'
      return
    }

    const ownerInfo = `owner=${probeData.uploaded_by ?? 'null'}, user=${currentUserId.value || 'null'}`
    eventActionError.value = `Nie udało się usunąć wydarzenia. ${ownerInfo}`
    return
  }

  await refreshEvents()
  showEventModal.value = false
}

function formatDate(str: string) {
  if (!str) return ''
  const d = new Date(str)
  return d.toLocaleString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function canDeleteEvent(event: CalEvent): boolean {
  if (currentRole.value === 'admin') return true

  const isOwner = event.extendedProps.uploadedBy === currentUserId.value
  const eventGroupId = event.extendedProps.groupId
  const hasInstructorAccess = Boolean(
    eventGroupId
    && memberships.value.some(membership => membership.group_id === eventGroupId && membership.role === 'instructor'),
  )

  if (event.extendedProps.type !== 'private' && currentRole.value === 'instructor' && hasInstructorAccess) {
    return true
  }

  if (!isOwner) return false

  if (currentRole.value === 'student') return event.extendedProps.type === 'private'
  if (currentRole.value === 'instructor') return true

  return false
}

const canDeleteSelectedEvent = computed(() => {
  if (!selectedEvent.value) return false
  return canDeleteEvent(selectedEvent.value)
})

watch(selectableViewGroups, () => {
  if (!selectableViewGroups.value.length) {
    selectedViewGroupId.value = null
    return
  }

  if (!selectedViewGroupId.value || !selectableViewGroups.value.some(group => group.id === selectedViewGroupId.value)) {
    selectedViewGroupId.value = selectableViewGroups.value[0]?.id ?? null
  }
}, { immediate: true })

watch([currentUserId, membershipsPending, memberships], async () => {
  if (!currentUserId.value || membershipsPending.value || ensuringPersonalGroup.value) return
  if (memberships.value.some(membership => membership.group?.type === 'personal')) return

  ensuringPersonalGroup.value = true
  try {
    await ensurePersonalGroupId()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nie udało się utworzyć prywatnej grupy.'
    toast.add({
      title: 'Błąd grupy prywatnej',
      description: message,
      color: 'error',
    })
  } finally {
    ensuringPersonalGroup.value = false
  }
}, { immediate: true, deep: true })

watch(showSeriesScopeModal, (open) => {
  if (!open && resolveSeriesScopeChoice) {
    resolveSeriesScopeChoice('cancel')
    resolveSeriesScopeChoice = null
  }
})
</script>

<template>
  <div class="cal-root">

    <!-- Legend -->
    <div class="legend-row">
      <div class="legend">
        <div v-for="(cfg, key) in typeConfig" :key="key" class="legend-item">
          <span class="legend-dot" :class="`legend-dot--${key}`" />
          <span>{{ cfg.label }}</span>
        </div>
      </div>

      <div class="group-context">
        <label for="calendar-group-context">Grupa</label>
        <select id="calendar-group-context" v-model="selectedViewGroupId">
          <option v-for="group in selectableViewGroups" :key="group.id" :value="group.id">
            {{ group.name }}
          </option>
        </select>
      </div>
    </div>

    <ClientOnly>
      <div class="cal-wrap">
        <FullCalendar ref="calendarRef" :options="calOptions" />
      </div>
    </ClientOnly>

    <!-- Event detail modal -->
    <UModal v-model:open="showEventModal" :ui="modalUi">
      <template #content>
        <div v-if="selectedEvent" class="modal">
          <div class="modal-stripe" :class="`modal-stripe--${selectedEvent.extendedProps.type}`" />
          <button class="modal-close" @click="showEventModal = false">✕</button>

          <div class="modal-type-badge" :class="`modal-type-badge--${selectedEvent.extendedProps.type}`">
            {{ typeConfig[selectedEvent.extendedProps.type]?.label }}
          </div>

          <template v-if="!isEditingEvent">
            <h2 class="modal-title">{{ selectedEvent.title }}</h2>

            <div class="modal-meta">
              <div class="meta-row">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5" /><path d="M8 4.5v3.75l2.5 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
                <span>{{ formatDate(selectedEvent.start) }}</span>
              </div>
              <div v-if="selectedEvent.extendedProps.location" class="meta-row">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1.5C5.515 1.5 3.5 3.515 3.5 6c0 3.75 4.5 8.5 4.5 8.5S12.5 9.75 12.5 6c0-2.485-2.015-4.5-4.5-4.5z" stroke="currentColor" stroke-width="1.5" /><circle cx="8" cy="6" r="1.5" stroke="currentColor" stroke-width="1.3" /></svg>
                <span>{{ selectedEvent.extendedProps.location }}</span>
              </div>
              <p v-if="selectedEvent.extendedProps.description" class="meta-desc">{{ selectedEvent.extendedProps.description }}</p>
            </div>
          </template>

          <template v-else>
            <h2 class="modal-title">Edycja wydarzenia</h2>
            <div class="form">
              <label>Tytuł *</label>
              <input v-model="editEvent.title" placeholder="Tytuł wydarzenia">

              <label>Notatka</label>
              <textarea v-model="editEvent.description" placeholder="Opis wydarzenia" rows="3" />

              <label>Lokalizacja</label>
              <input v-model="editEvent.location" placeholder="np. Sala 204">

              <label v-if="selectedEvent?.extendedProps.seriesId" class="repeat-toggle">
                <input v-model="applyEditToFollowing" type="checkbox">
                <span>Zastosuj do tego i kolejnych wystąpień serii</span>
              </label>
            </div>
          </template>

          <p v-if="eventActionError" class="modal-error">{{ eventActionError }}</p>

          <div class="modal-actions">
            <button class="btn-delete" :disabled="!canDeleteSelectedEvent" @click="deleteEvent">Usuń event</button>
            <button class="btn-close" @click="isEditingEvent = !isEditingEvent">
              {{ isEditingEvent ? 'Podgląd' : 'Edytuj' }}
            </button>
            <button v-if="isEditingEvent" class="btn-confirm" :disabled="isSavingEdit" @click="saveEventEdits">
              {{ isSavingEdit ? 'Zapisywanie…' : 'Zapisz zmiany' }}
            </button>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Add event modal -->
    <UModal v-model:open="showAddModal" :ui="modalUi">
      <template #content>
        <div class="modal">
          <div class="modal-stripe modal-stripe--add" />
          <button class="modal-close" @click="showAddModal = false">✕</button>

          <h2 class="modal-title modal-title--add">Nowy event</h2>
          <p v-if="addSlot" class="modal-sub">{{ formatDate(addSlot.start) }}</p>

          <p v-if="addError" class="modal-error">{{ addError }}</p>

          <div class="form">
            <label>Tytuł *</label>
            <input v-model="newEvent.title" placeholder="np. Wykład: Algorytmy" @keyup.enter="confirmAdd">

            <label>Lokalizacja</label>
            <input v-model="newEvent.location" placeholder="np. Sala 204">

            <label>Notatka</label>
            <textarea v-model="newEvent.description" placeholder="Opcjonalny opis…" rows="3" />

            <label class="repeat-toggle">
              <input v-model="createAsPrivate" type="checkbox">
              <span>Prywatne (widoczne tylko dla mnie)</span>
            </label>

            <label class="repeat-toggle">
              <input v-model="repeatWeekly" type="checkbox">
              <span>Powtarzaj co tydzień</span>
            </label>

            <template v-if="repeatWeekly">
              <label>Ile tygodni (max {{ semesterWeekLimit }})</label>
              <input v-model.number="repeatWeeks" type="number" min="1" :max="semesterWeekLimit">
            </template>
          </div>

          <div class="modal-actions">
            <button class="btn-cancel" @click="showAddModal = false">Anuluj</button>
            <button class="btn-confirm" :disabled="!newEvent.title.trim() || isCreating" @click="confirmAdd">
              {{ isCreating ? 'Zapisywanie…' : 'Dodaj event' }}
            </button>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Series scope modal -->
    <UModal v-model:open="showSeriesScopeModal" :ui="modalUi">
      <template #content>
        <div class="modal">
          <div class="modal-stripe modal-stripe--course" />
          <button class="modal-close" @click="resolveSeriesScope('cancel')">✕</button>

          <h2 class="modal-title">Aktualizacja serii</h2>
          <p class="modal-permission">{{ seriesScopePrompt }}</p>

          <div class="modal-actions">
            <button class="btn-cancel" @click="resolveSeriesScope('single')">Tylko to wydarzenie</button>
            <button class="btn-confirm" @click="resolveSeriesScope('following')">To i kolejne tygodnie</button>
            <button class="btn-close" @click="resolveSeriesScope('cancel')">Anuluj</button>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped src="~/assets/css/event-calendar.css"></style>