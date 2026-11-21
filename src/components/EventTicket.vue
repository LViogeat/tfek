<template>
  <article class="ticket" :class="{ cancelled: !!event.cancelled_at }">
    <header class="band">
      <svg class="rings" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="46" />
        <circle cx="50" cy="50" r="32" />
        <circle cx="50" cy="50" r="18" />
      </svg>
      <div class="lbl">N° {{ event.slug.toUpperCase() }}</div>
      <h1 class="disp title">{{ event.title }}</h1>
      <div v-if="event.cancelled_at" class="stamp mono">Annulé</div>
    </header>

    <div class="fields">
      <template v-if="time">
        <div>
          <div class="lbl key">Date</div>
          <div class="mono value">{{ date }}</div>
        </div>
        <div>
          <div class="lbl key">Heure</div>
          <div class="mono value">{{ time }}</div>
        </div>
      </template>
      <div v-else class="wide">
        <div class="lbl key">Dates</div>
        <div class="value text">{{ formatEventDate(event.starts_at, event.ends_at) }}</div>
      </div>
      <div v-if="event.location" class="wide">
        <div class="lbl key">Lieu</div>
        <div class="value text">{{ event.location }}</div>
      </div>
      <div class="wide">
        <div class="lbl key">Organisé par</div>
        <div class="value text">{{ event.organizer_name }}</div>
      </div>
    </div>

    <div class="perforation" aria-hidden="true"></div>

    <div class="actions">
      <button type="button" class="action" @click="emit('calendar')">
        <ion-icon :icon="calendarOutline" aria-hidden="true" />
        Ajouter à l’agenda
      </button>
      <a v-if="event.location" class="action" :href="mapsUrl(event.location)" target="_blank" rel="noopener">
        <ion-icon :icon="mapOutline" aria-hidden="true" />
        Voir la carte
      </a>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IonIcon } from '@ionic/vue'
import { calendarOutline, mapOutline } from 'ionicons/icons'
import type { EventDetails } from '@/lib/events'
import { formatEventDate, mapsUrl, ticketDate, ticketTime } from '@/lib/format'

const props = defineProps<{ event: EventDetails }>()
const emit = defineEmits<{ calendar: [] }>()

const date = computed(() => ticketDate(props.event.starts_at))
const time = computed(() => ticketTime(props.event.starts_at, props.event.ends_at))
</script>

<style scoped>
.ticket {
  background: var(--tfek-paper);
  color: var(--tfek-ink);
  border-radius: 18px;
  overflow: hidden;
}
.band {
  position: relative;
  overflow: hidden;
  background: var(--t-accent);
  color: var(--tfek-ink);
  padding: 22px 20px 20px;
}
.title {
  position: relative;
  margin: 28px 0 0;
  padding-right: 40px;
  font-size: clamp(1.75rem, 7.6vw, 2.5rem);
  line-height: 1.05;
  letter-spacing: -0.05em;
  overflow-wrap: break-word;
  hyphens: auto;
}
.cancelled .title {
  text-decoration: line-through;
  text-decoration-thickness: 3px;
}
.rings {
  position: absolute;
  right: -36px;
  top: -36px;
  width: 150px;
  height: 150px;
  fill: none;
  stroke: var(--tfek-ink);
  stroke-width: 2;
  opacity: 0.9;
}
.stamp {
  position: absolute;
  right: 18px;
  bottom: 18px;
  transform: rotate(-8deg);
  border: 2.5px solid var(--tfek-ink);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: var(--t-accent);
}
.fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  padding: 18px 20px;
}
.wide {
  grid-column: span 2;
}
.key {
  color: var(--tfek-paper-muted);
}
.value {
  margin-top: 4px;
  font-size: 17px;
  font-weight: 700;
}
.value.text {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.35;
}
.perforation {
  position: relative;
  border-top: 2px dashed var(--tfek-paper-line);
  margin: 0 20px;
}
.perforation::before,
.perforation::after {
  content: '';
  position: absolute;
  top: -15px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--t-bg);
}
.perforation::before {
  left: -35px;
}
.perforation::after {
  right: -35px;
}
.actions {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px 8px;
}
.action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 8px;
  white-space: nowrap;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--tfek-ink);
  font: 600 13px/1 var(--ion-font-family);
  text-decoration: none;
  cursor: pointer;
}
.action:hover,
.action:focus-visible {
  background: rgba(20, 20, 20, 0.06);
}
.action ion-icon {
  font-size: 18px;
}
</style>
