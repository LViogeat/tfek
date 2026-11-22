<template>
  <div class="guests">
    <template v-for="group in groups" :key="group.status">
      <div v-if="group.guests.length" class="group">
        <h3 class="lbl group-title">{{ group.label }} · {{ group.total }}</h3>
        <ul>
          <li v-for="g in group.guests" :key="g.display_name + g.updated_at">
            <span class="avatar mono" :class="group.status">{{ initials(g.display_name) }}</span>
            <span class="name">
              {{ g.display_name }}<span v-if="g.is_me" class="muted"> (toi)</span>
              <span v-if="g.plus_ones" class="muted"> +{{ g.plus_ones }}</span>
              <span v-if="g.is_friend" class="lbl friend-tag">ami</span>
            </span>
          </li>
        </ul>
      </div>
    </template>
    <!-- Organisateur : prénoms de sa liste qui n'ont pas encore répondu -->
    <div v-if="pending?.length" class="group">
      <h3 class="lbl group-title">Pas encore répondu · {{ pending.length }}</h3>
      <ul>
        <li v-for="i in pending" :key="i.id">
          <span class="avatar mono pending">{{ initials(i.display_name) }}</span>
          <span class="name grow">{{ i.display_name }}</span>
          <ion-button fill="clear" color="medium" size="small" :aria-label="`Retirer ${i.display_name}`" @click="emit('remove', i)">
            <ion-icon slot="icon-only" :icon="closeOutline" />
          </ion-button>
        </li>
      </ul>
    </div>
    <p v-if="guests.length === 0 && !pending?.length" class="muted empty">Personne n’a encore répondu.</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IonButton, IonIcon } from '@ionic/vue'
import { closeOutline } from 'ionicons/icons'
import type { Guest, Invitee, RsvpStatus } from '@/lib/events'

const props = defineProps<{ guests: Guest[]; pending?: Invitee[] }>()
const emit = defineEmits<{ remove: [invitee: Invitee] }>()

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
.guests {
  padding: 0 16px;
}
.group + .group {
  margin-top: 20px;
}
.group-title {
  margin: 0 0 6px;
  color: var(--tfek-muted);
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--tfek-line);
}
.avatar {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  background: var(--tfek-surface);
  color: var(--tfek-text);
  border: 1px solid var(--tfek-line);
}
.avatar.going {
  background: var(--t-accent);
  border-color: var(--t-accent);
  color: var(--t-on-accent);
}
.avatar.maybe {
  background: transparent;
  border-color: var(--t-accent);
  color: var(--t-accent);
}
.avatar.pending {
  background: transparent;
  border-style: dashed;
  color: var(--tfek-muted);
}
.name {
  font-size: 16px;
}
.friend-tag {
  margin-left: 8px;
  padding: 2px 6px;
  border: 1px solid var(--t-accent);
  border-radius: 5px;
  color: var(--t-accent);
  font-size: 10px;
  vertical-align: 2px;
}
.grow {
  flex: 1;
  min-width: 0;
}
.empty {
  margin: 0;
}
</style>
