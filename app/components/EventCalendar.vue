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
    type: 'group' | 'faculty' | 'private' | 'course'
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

type MembershipRole = Database['public']['Enums']['membership_role']
type EventType = CalEvent['extendedProps']['type']

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

const instructorGroupId = computed(() => memberships.value.find(membership => membership.role === 'instructor')?.group_id ?? null)
const personalGroupId = computed(() => memberships.value.find(membership => membership.group?.type === 'personal')?.group_id ?? null)
const userGroupIds = computed(() => memberships.value.map(membership => membership.group_id))

const availableEventTypes = computed<EventType[]>(() => {
  if (currentRole.value === 'admin') return ['group', 'faculty', 'course', 'private']
  if (currentRole.value === 'instructor') return ['group', 'private']
  return ['private']
})

const lockedEventType = computed<EventType | null>(() => availableEventTypes.value[0] ?? null)

const canEditPrivateEvents = computed(() =>
  currentRole.value === 'admin' || currentRole.value === 'student' || currentRole.value === 'instructor',
)
const canEditGroupEvents = computed(() => currentRole.value === 'admin' || currentRole.value === 'instructor')
const isCreating = ref(false)
const addError = ref<string | null>(null)

const selectedEvent = ref<CalEvent | null>(null)
const eventActionError = ref<string | null>(null)
const showEventModal = ref(false)
const showAddModal = ref(false)
const addSlot = ref<{ start: string; end: string } | null>(null)

const newEvent = ref({ title: '', location: '', description: '', type: 'private' as CalEvent['extendedProps']['type'] })

// Helpers 
function pad(n: number) { return n.toString().padStart(2, '0') }
function offsetDay(offset: number, hour = 0, min = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:${pad(min)}:00`
}

// Temp Seed events 
const fallbackEvents: CalEvent[] = [
  {
    id: 'seed-1',
    title: 'Algorytmy – wyklad',
    start: offsetDay(0, 10, 0),
    end: offsetDay(0, 12, 0),
    classNames: ['ev-group'],
    extendedProps: { type: 'group', location: 'Aula A1', description: 'Wyklad grupowy.' },
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

const { data: dbEvents, refresh: refreshEvents } = await useAsyncData(
  'calendar-events',
  async () => {
    if (!userGroupIds.value.length) return []

    const { data, error } = await supabase
      .from('events')
      .select('id, title, description, starts_at, ends_at, created_at, group_id, uploaded_by')
      .in('group_id', userGroupIds.value)
      .order('starts_at', { ascending: true })

    if (error) throw error
    return data ?? []
  },
  {
    default: () => [],
    watch: [userGroupIds],
  },
)

function resolveEventType(groupId: string): EventType {
  if (groupId === personalGroupId.value) return 'private'
  if (memberships.value.some(membership => membership.group_id === groupId && membership.role === 'instructor')) return 'group'

  const groupType = memberships.value.find(membership => membership.group_id === groupId)?.group?.type
  if (groupType === 'faculty') return 'faculty'
  if (groupType === 'course' || groupType === 'university') return 'course'
  return 'group'
}

function resolveGroupIdForType(type: EventType, preferredInstructorGroupId?: string | null): string | null {
  if (type === 'private') {
    return personalGroupId.value ?? null
  }

  if (type === 'group') {
    return preferredInstructorGroupId ?? instructorGroupId.value ?? null
  }

  const matchByGroupType = memberships.value.find((membership) => {
    if (!membership.group?.type) return false
    if (type === 'faculty') return membership.group.type === 'faculty'
    if (type === 'course') return membership.group.type === 'course' || membership.group.type === 'university'
    return false
  })

  return matchByGroupType?.group_id ?? userGroupIds.value[0] ?? null
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
      const startsAt = eventRow.starts_at ?? eventRow.created_at
      const endsAt = eventRow.ends_at ?? eventRow.starts_at ?? eventRow.created_at
      const isAllDay = Boolean(startsAt && endsAt && startsAt.slice(11, 19) === '00:00:00' && endsAt.slice(11, 19) === '00:00:00')

      return {
        id: String(eventRow.id),
        title: eventRow.title,
        start: startsAt,
        end: endsAt,
        classNames: [`ev-${eventType}`],
        extendedProps: {
          type: eventType,
          description: eventRow.description ?? undefined,
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
  events.value.map((event) => {
    const isAllDayEvent = Boolean(event.allDay)
    const isOwner = !event.extendedProps.uploadedBy || event.extendedProps.uploadedBy === currentUserId.value
    const canEditByRole = event.extendedProps.type === 'private'
      ? canEditPrivateEvents.value
      : canEditGroupEvents.value || currentRole.value === 'admin'
    const canEditThisEvent = currentRole.value === 'admin' || (canEditByRole && isOwner)
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

// Event type config 
const typeConfig = {
  group:   { label: 'Plan grupy',    color: '#60a5fa', bg: 'rgba(59,130,246,0.15)', border: '#3b82f6' },
  faculty: { label: 'Wydział',       color: '#34d399', bg: 'rgba(16,185,129,0.15)', border: '#10b981' },
  private: { label: 'Prywatny',      color: '#fbbf24', bg: 'rgba(245,158,11,0.15)', border: '#f59e0b' },
  course:  { label: 'Kurs / uczelnia', color: '#c084fc', bg: 'rgba(168,85,247,0.15)', border: '#a855f7' },
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
  eventOrder(a: any, b: any) {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1

    const aStart = a.start ? Number(a.start) : 0
    const bStart = b.start ? Number(b.start) : 0
    if (aStart !== bStart) return aStart - bStart

    return a.title.localeCompare(b.title)
  },

  select(info: DateSelectArg) {
    if (membershipsPending.value) return

    addSlot.value = { start: info.startStr, end: info.endStr }
    const defaultType = currentRole.value === 'admin'
      ? 'private'
      : currentRole.value === 'instructor'
        ? 'private'
        : 'private'

    newEvent.value = { title: '', location: '', description: '', type: defaultType }
    showAddModal.value = true
  },

  eventClick(info: EventClickArg) {
    eventActionError.value = null
    selectedEvent.value = {
      id: info.event.id,
      title: info.event.title,
      start: info.event.startStr,
      end: info.event.endStr,
      classNames: info.event.classNames,
      extendedProps: info.event.extendedProps as CalEvent['extendedProps'],
      allDay: info.event.allDay,
    }
    showEventModal.value = true
  },

  async eventDrop(info: EventDropArg) {
    const idx = events.value.findIndex(e => e.id === info.event.id)
    const canMoveEvent = Boolean(info.event.extendedProps?.canEdit)

    if (!canMoveEvent) {
      toast.add({
        title: 'Brak uprawnień',
        description: 'Możesz przesuwać tylko własne wydarzenia.',
        color: 'warning',
      })
      info.revert()
      return
    }

    if (idx !== -1) {
      const targetEvent = events.value[idx]
      if (targetEvent) {
        targetEvent.start = info.event.startStr
        targetEvent.end = info.event.endStr
      }
    }

    const eventId = Number(info.event.id)
    if (!Number.isFinite(eventId)) return

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

  const resolvedType: EventType = currentRole.value === 'admin'
    ? newEvent.value.type
    : currentRole.value === 'instructor'
      ? newEvent.value.type
      : 'private'

  if (!availableEventTypes.value.includes(resolvedType)) return

  addError.value = null
  isCreating.value = true

  try {
    if (resolvedType === 'group' && currentRole.value === 'instructor' && !instructorGroupId.value) {
      addError.value = 'Brak grup instruktora do przypisania wydarzenia.'
      return
    }

    const targetGroupId =
      resolvedType === 'private'
        ? await ensurePersonalGroupId()
        : resolveGroupIdForType(
            resolvedType,
            currentRole.value === 'instructor' ? instructorGroupId.value : null,
          )

    if (!targetGroupId) {
      addError.value = 'Nie udało się ustalić grupy docelowej dla tego wydarzenia.'
      return
    }

    const { error } = await supabase
      .from('events')
      .insert({
        title: newEvent.value.title,
        description: newEvent.value.description || null,
        starts_at: addSlot.value.start,
        ends_at: addSlot.value.end,
        group_id: targetGroupId,
        uploaded_by: currentUserId.value,
      })

    if (error) throw error

    await refreshEvents()
    showAddModal.value = false
  } catch (error) {
    addError.value = error instanceof Error ? error.message : 'Nie udało się zapisać wydarzenia.'
  } finally {
    isCreating.value = false
  }
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
  if (!isOwner) return false

  if (currentRole.value === 'student') return event.extendedProps.type === 'private'
  if (currentRole.value === 'instructor') return event.extendedProps.type === 'private' || event.extendedProps.type === 'group'

  return false
}

const canDeleteSelectedEvent = computed(() => {
  if (!selectedEvent.value) return false
  return canDeleteEvent(selectedEvent.value)
})
</script>

<template>
  <div class="cal-root">

    <!-- Legend -->
    <div class="legend">
      <div v-for="(cfg, key) in typeConfig" :key="key" class="legend-item">
        <span class="legend-dot" :class="`legend-dot--${key}`" />
        <span>{{ cfg.label }}</span>
      </div>
    </div>

    <ClientOnly>
      <div class="cal-wrap">
        <FullCalendar ref="calendarRef" :options="calOptions" />
      </div>
    </ClientOnly>

    <!-- Event detail modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showEventModal" class="overlay" @click.self="showEventModal = false">
          <div v-if="selectedEvent" class="modal">
            <div class="modal-stripe" :class="`modal-stripe--${selectedEvent.extendedProps.type}`" />
            <button class="modal-close" @click="showEventModal = false">✕</button>

            <div class="modal-type-badge" :class="`modal-type-badge--${selectedEvent.extendedProps.type}`">
              {{ typeConfig[selectedEvent.extendedProps.type]?.label }}
            </div>

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

            <p v-if="eventActionError" class="modal-error">{{ eventActionError }}</p>

            <div class="modal-actions">
              <button class="btn-delete" :disabled="!canDeleteSelectedEvent" @click="deleteEvent">Usuń event</button>
              <button class="btn-close" @click="showEventModal = false">Zamknij</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Add event modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showAddModal" class="overlay" @click.self="showAddModal = false">
          <div class="modal">
            <div class="modal-stripe modal-stripe--add" />
            <button class="modal-close" @click="showAddModal = false">✕</button>

            <h2 class="modal-title modal-title--add">Nowy event</h2>
            <p v-if="addSlot" class="modal-sub">{{ formatDate(addSlot.start) }}</p>

            <div class="modal-permission">
              <span v-if="currentRole === 'student'">Dodajesz tylko prywatne wydarzenie.</span>
              <span v-else-if="currentRole === 'instructor'">Możesz dodać prywatną notatkę albo wydarzenie dla swojej grupy.</span>
              <span v-else>Jako admin możesz wybrać dowolny typ wydarzenia.</span>
            </div>

            <p v-if="addError" class="modal-error">{{ addError }}</p>

            <div class="form">
              <label>Tytuł *</label>
              <input v-model="newEvent.title" placeholder="np. Wykład: Algorytmy" @keyup.enter="confirmAdd">

              <label>Lokalizacja</label>
              <input v-model="newEvent.location" placeholder="np. Sala 204">

              <label>Notatka</label>
              <textarea v-model="newEvent.description" placeholder="Opcjonalny opis…" rows="3" />

              <template v-if="availableEventTypes.length > 1">
                <label>Typ</label>
                <div class="type-picker">
                  <button
                    v-for="key in availableEventTypes"
                    :key="key"
                    class="type-opt"
                    :class="[
                      { active: newEvent.type === key },
                      `type-opt--${key}`,
                    ]"
                    @click="newEvent.type = key"
                  >
                    <span class="type-dot" :class="`type-dot--${key}`" />
                    {{ typeConfig[key].label }}
                  </button>
                </div>
              </template>

              <div v-else class="locked-type">
                <label>Typ</label>
                <div class="locked-type__value">
                  {{ lockedEventType ? typeConfig[lockedEventType].label : 'Prywatny' }}
                </div>
              </div>
            </div>

            <div class="modal-actions">
              <button class="btn-cancel" @click="showAddModal = false">Anuluj</button>
              <button class="btn-confirm" :disabled="!newEvent.title.trim() || isCreating" @click="confirmAdd">
                {{ isCreating ? 'Zapisywanie…' : 'Dodaj event' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped src="~/assets/css/event-calendar.css"></style>