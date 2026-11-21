<template>
  <article class="ticket" :class="{ cancelled: !!event.cancelled_at }">
    <header class="band">
      <div class="frame" aria-hidden="true"></div>
      <TfekStamp class="logo" />
      <div class="lbl number">N° {{ event.slug.toUpperCase() }}</div>
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
import TfekStamp from './TfekStamp.vue'
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
  background-color: var(--t-band);
  /* Fines rayures verticales, à peine visibles */
  background-image: repeating-linear-gradient(
    90deg,
    color-mix(in srgb, var(--t-band-text) 4%, transparent) 0 1px,
    transparent 1px 7px
  );
  color: var(--t-band-text);
  padding: 26px 24px 24px;
}
/* Liseré intérieur, comme un carton gravé */
.frame {
  position: absolute;
  inset: 10px;
  border-radius: 9px;
  border: 1px solid color-mix(in srgb, var(--t-band-text) 22%, transparent);
  pointer-events: none;
}
.logo {
  position: absolute;
  right: 22px;
  top: 20px;
  width: 90px;
  height: 90px;
  transform: rotate(-12deg);
  color: var(--t-stamp);
}
.number {
  position: relative;
  color: var(--t-stamp);
  letter-spacing: 0.14em;
}
.title {
  position: relative;
  /* Sous le tampon : le titre garde toute la largeur */
  margin: 72px 0 0;
  font-size: clamp(1.7rem, 7.4vw, 2.4rem);
  line-height: 1.06;
  letter-spacing: -0.05em;
  /* Coupe seulement les mots trop longs pour la ligne, sans tiret automatique */
  overflow-wrap: break-word;
}
.cancelled .title {
  text-decoration: line-through;
  text-decoration-thickness: 2px;
}
.stamp {
  position: absolute;
  right: 18px;
  bottom: 18px;
  transform: rotate(-8deg);
  border: 1.5px solid var(--t-stamp);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--t-stamp);
  background: var(--t-band);
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
  border-top: 1.5px dashed var(--tfek-paper-line);
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
