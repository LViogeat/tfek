<template>
  <div>
    <template v-for="group in groups" :key="group.status">
      <ion-list v-if="group.guests.length" inset>
        <ion-list-header class="group-header">
          <ion-label>{{ group.label }} · {{ group.total }}</ion-label>
        </ion-list-header>
        <ion-item v-for="g in group.guests" :key="g.display_name + g.updated_at">
          <div slot="start" class="avatar" :class="group.status">{{ initials(g.display_name) }}</div>
          <ion-label>
            {{ g.display_name }}<span v-if="g.is_me" class="muted"> (toi)</span>
            <span v-if="g.plus_ones" class="muted"> +{{ g.plus_ones }}</span>
          </ion-label>
        </ion-item>
      </ion-list>
    </template>
    <p v-if="guests.length === 0" class="muted ion-padding-horizontal">Personne n’a encore répondu.</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IonList, IonListHeader, IonItem, IonLabel } from '@ionic/vue'
import type { Guest, RsvpStatus } from '@/lib/events'

const props = defineProps<{ guests: Guest[] }>()

const LABELS: Record<RsvpStatus, string> = { going: 'Viennent', maybe: 'Peut-être', declined: 'Ne viennent pas' }

const groups = computed(() =>
  (['going', 'maybe', 'declined'] as RsvpStatus[]).map((status) => {
    const guests = props.guests.filter((g) => g.status === status)
    const total = status === 'declined' ? guests.length : guests.reduce((n, g) => n + 1 + g.plus_ones, 0)
    return { status, label: LABELS[status], guests, total }
  }),
)

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}
</script>

<style scoped>
.group-header {
  font-size: 0.95rem;
  font-weight: 600;
  min-height: 36px;
}
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 600;
  color: #fff;
  background: var(--ion-color-medium);
}
.avatar.going {
  background: var(--ion-color-success);
}
.avatar.maybe {
  background: var(--ion-color-warning);
}
</style>
