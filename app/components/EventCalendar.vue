<script setup lang="ts">
import { ref, computed } from 'vue'
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
  }
  allDay?: boolean
}

type MembershipRole = Database['public']['Enums']['membership_role']
type EventType = CalEvent['extendedProps']['type']

// State 
const supabase = useSupabaseClient<Database>()
const user = useSupabaseUser()
const calendarRef = ref<InstanceType<typeof FullCalendar> | null>(null)

const currentUserId = computed(() => user.value?.id ?? (user.value as { sub?: string } | null)?.sub ?? '')

const { data: memberships, pending: membershipsPending } = await useAsyncData(
  'calendar-memberships',
  async () => {
    if (!currentUserId.value) return []

    const { data, error } = await supabase
      .from('user_memberships')
      .select('id, group_id, role, user_id')
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

const availableEventTypes = computed<EventType[]>(() => {
  if (currentRole.value === 'admin') return ['group', 'faculty', 'course', 'private']
  if (currentRole.value === 'instructor') return ['group']
  return ['private']
})

const lockedEventType = computed<EventType | null>(() => availableEventTypes.value[0] ?? null)

const canEditPrivateEvents = computed(() => currentRole.value === 'admin' || currentRole.value === 'student')
const canEditGroupEvents = computed(() => currentRole.value === 'admin' || currentRole.value === 'instructor')

const selectedEvent = ref<CalEvent | null>(null)
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
const events = ref<CalEvent[]>([
  {
    id: '1',
    title: 'Algorytmy – wykład',
    start: offsetDay(0, 10, 0),
    end: offsetDay(0, 12, 0),
    classNames: ['ev-group'],
    extendedProps: { type: 'group', location: 'Aula A1', description: 'Wykład z algorytmów i złożoności obliczeniowej dla całej grupy.' },
  },
  {
    id: '2',
    title: 'Bazy danych – lab',
    start: offsetDay(1, 14, 0),
    end: offsetDay(1, 16, 0),
    classNames: ['ev-group'],
    extendedProps: { type: 'group', location: 'Sala 204', description: 'Laboratoria: zapytania SQL, indeksy, transakcje.' },
  },
  {
    id: '3',
    title: 'Dzień wydziału',
    start: offsetDay(4),
    end: offsetDay(5),
    classNames: ['ev-faculty'],
    extendedProps: { type: 'faculty', description: 'Dzień otwarty Wydziału Informatyki.' },
    allDay: true,
  },
  {
    id: '4',
    title: 'Notatka: projekt grupowy',
    start: offsetDay(0, 15, 0),
    end: offsetDay(0, 20, 30),
    classNames: ['ev-private'],
    extendedProps: { type: 'private', description: 'Przygotować slajdy na spotkanie z promotorem.' },
  },
  {
    id: '5',
    title: 'Sieci komputerowe',
    start: offsetDay(2, 9, 0),
    end: offsetDay(2, 11, 0),
    classNames: ['ev-course'],
    extendedProps: { type: 'course', location: 'Sala 301', description: 'Protokoły TCP/IP, routowanie, VLAN.' },
  },
  {
    id: '6',
    title: 'Konsultacje – dr Kowalski',
    start: offsetDay(3, 13, 0),
    end: offsetDay(3, 14, 0),
    classNames: ['ev-private'],
    extendedProps: { type: 'private', location: 'Gabinet 112' },
  },
])

const calendarEvents = computed(() =>
  events.value.map((event) => {
    const isAllDayBackground = Boolean(event.allDay)
    const canEditThisEvent = event.extendedProps.type === 'private'
      ? canEditPrivateEvents.value
      : canEditGroupEvents.value || currentRole.value === 'admin'

    return {
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      allDay: event.allDay,
      classNames: event.classNames,
      backgroundColor: typeConfig[event.extendedProps.type].bg,
      borderColor: typeConfig[event.extendedProps.type].border,
      editable: canEditThisEvent,
      startEditable: canEditThisEvent,
      durationEditable: canEditThisEvent,
      display: isAllDayBackground ? 'background' : 'auto',
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
  height: '100%',
  contentHeight: '100%',
  expandRows: true,
  stickyHeaderDates: true,
  events: calendarEvents.value,
  eventOverlap: true,
  eventDisplay: 'auto',
  eventOrder: 'start,-duration,allDay,title',

  select(info: DateSelectArg) {
    if (membershipsPending.value) return

    addSlot.value = { start: info.startStr, end: info.endStr }
    const defaultType = currentRole.value === 'admin'
      ? 'private'
      : currentRole.value === 'instructor'
        ? 'group'
        : 'private'

    newEvent.value = { title: '', location: '', description: '', type: defaultType }
    showAddModal.value = true
  },

  eventClick(info: EventClickArg) {
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

  eventDrop(info: EventDropArg) {
    const idx = events.value.findIndex(e => e.id === info.event.id)
    const eventType = info.event.extendedProps?.type as EventType | undefined
    const canMoveEvent = eventType === 'private'
      ? canEditPrivateEvents.value
      : canEditGroupEvents.value || currentRole.value === 'admin'

    if (!canMoveEvent) {
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
  },

  eventContent(arg) {
    const type = arg.event.extendedProps?.type as keyof typeof typeConfig
    const cfg = typeConfig[type] || typeConfig.private
    const loc = arg.event.extendedProps?.location
    return {
      html: `
        <div class="fc-event-inner" style="border-left-color:${cfg.border}">
          <span class="fc-event-title">${arg.event.title}</span>
          ${loc ? `<span class="fc-event-loc">${loc}</span>` : ''}
        </div>`,
    }
  },
}))

// Actions
function confirmAdd() {
  if (!newEvent.value.title.trim() || !addSlot.value) return

  const resolvedType: EventType = currentRole.value === 'admin'
    ? newEvent.value.type
    : currentRole.value === 'instructor'
      ? 'group'
      : 'private'

  if (!availableEventTypes.value.includes(resolvedType)) return

  const id = Date.now().toString()
  events.value.push({
    id,
    title: newEvent.value.title,
    start: addSlot.value.start,
    end: addSlot.value.end,
    classNames: [`ev-${resolvedType}`],
    extendedProps: {
      type: resolvedType,
      location: newEvent.value.location || undefined,
      description: newEvent.value.description || undefined,
      groupId: currentRole.value === 'instructor' ? instructorGroupId.value : null,
    },
    allDay: false,
  })
  const api = calendarRef.value?.getApi()
  api?.addEvent({
    id,
    title: newEvent.value.title,
    start: addSlot.value.start,
    end: addSlot.value.end,
    classNames: [`ev-${resolvedType}`],
    extendedProps: {
      type: resolvedType,
      location: newEvent.value.location || undefined,
      description: newEvent.value.description || undefined,
      groupId: currentRole.value === 'instructor' ? instructorGroupId.value : null,
    },
  })
  showAddModal.value = false
}

function deleteEvent() {
  if (!selectedEvent.value) return
  const api = calendarRef.value?.getApi()
  api?.getEventById(selectedEvent.value.id)?.remove()
  events.value = events.value.filter(e => e.id !== selectedEvent.value!.id)
  showEventModal.value = false
}

function formatDate(str: string) {
  if (!str) return ''
  const d = new Date(str)
  return d.toLocaleString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="cal-root">

    <!-- Legend -->
    <div class="legend">
      <div v-for="(cfg, key) in typeConfig" :key="key" class="legend-item">
        <span class="legend-dot" :style="{ background: cfg.color }" />
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
            <div class="modal-stripe" :style="{ background: typeConfig[selectedEvent.extendedProps.type]?.border }" />
            <button class="modal-close" @click="showEventModal = false">✕</button>

            <div
              class="modal-type-badge"
              :style="{
                background: typeConfig[selectedEvent.extendedProps.type]?.bg,
                color: typeConfig[selectedEvent.extendedProps.type]?.color,
              }"
            >
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

            <div class="modal-actions">
              <button class="btn-delete" @click="deleteEvent">Usuń event</button>
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
            <div class="modal-stripe" style="background: #60a5fa" />
            <button class="modal-close" @click="showAddModal = false">✕</button>

            <h2 class="modal-title" style="margin-top: 0.5rem">Nowy event</h2>
            <p v-if="addSlot" class="modal-sub">{{ formatDate(addSlot.start) }}</p>

            <div class="modal-permission">
              <span v-if="currentRole === 'student'">Dodajesz tylko prywatne wydarzenie.</span>
              <span v-else-if="currentRole === 'instructor'">Dodajesz wydarzenie tylko dla swojej grupy.</span>
              <span v-else>Jako admin możesz wybrać dowolny typ wydarzenia.</span>
            </div>

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
                    :class="{ active: newEvent.type === key }"
                    :style="newEvent.type === key ? { background: typeConfig[key].bg, borderColor: typeConfig[key].border, color: typeConfig[key].color } : {}"
                    @click="newEvent.type = key"
                  >
                    <span class="type-dot" :style="{ background: typeConfig[key].color }" />
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
              <button class="btn-confirm" :disabled="!newEvent.title.trim()" @click="confirmAdd">Dodaj event</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped src="~/assets/css/event-calendar.css"></style>