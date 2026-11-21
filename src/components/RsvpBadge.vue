<template>
  <ion-badge class="mono" :color="meta.color">{{ meta.label }}</ion-badge>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IonBadge } from '@ionic/vue'
import type { RsvpStatus } from '@/lib/events'

const props = defineProps<{ status: RsvpStatus }>()

const META: Record<RsvpStatus, { label: string; color: string }> = {
  going: { label: 'Je viens', color: 'success' },
  maybe: { label: 'Peut-être', color: 'warning' },
  declined: { label: 'Absent', color: 'medium' },
}

const meta = computed(() => META[props.status])
</script>

<style scoped>
ion-badge {
  --padding-start: 8px;
  --padding-end: 8px;
  --padding-top: 5px;
  --padding-bottom: 5px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
</style>
