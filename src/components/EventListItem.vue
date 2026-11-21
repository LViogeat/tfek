<template>
  <ion-item :router-link="`/e/${event.slug}`" detail>
    <div slot="start" class="date-badge mono" :class="{ past: isPast }" :style="{ background: theme.band, color: theme.stamp, borderColor: theme.stamp }">
      <span class="day">{{ day }}</span>
      <span class="month">{{ month }}</span>
    </div>
    <ion-label>
      <h2 class="disp" :class="{ cancelled: event.cancelled_at }">{{ event.title }}</h2>
      <p>{{ formatShortDate(event.starts_at) }}<template v-if="event.location"> · {{ event.location }}</template></p>
    </ion-label>
    <RsvpBadge v-if="status" slot="end" :status="status" />
    <ion-badge v-else-if="event.cancelled_at" slot="end" color="medium">Annulé</ion-badge>
  </ion-item>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IonItem, IonLabel, IonBadge } from '@ionic/vue'
import RsvpBadge from './RsvpBadge.vue'
import { formatShortDate } from '@/lib/format'
import type { EventRow, RsvpStatus } from '@/lib/events'
import { getTheme } from '@/lib/themes'

const props = defineProps<{ event: EventRow; status?: RsvpStatus }>()

const date = computed(() => new Date(props.event.starts_at))
const day = computed(() => date.value.getDate())
const month = computed(() => date.value.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''))
const isPast = computed(() => date.value.getTime() < Date.now())
const theme = computed(() => getTheme(props.event.theme))
</script>

<style scoped>
.date-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 9px;
  border: 1px solid;
  line-height: 1;
}
.date-badge.past {
  opacity: 0.5;
}
.day {
  font-size: 1.2rem;
  font-weight: 700;
}
h2 {
  font-size: 1.05rem;
}
.month {
  font-size: 0.7rem;
  text-transform: uppercase;
}
.cancelled {
  text-decoration: line-through;
}
</style>
