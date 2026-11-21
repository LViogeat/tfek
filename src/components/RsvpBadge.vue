<template>
  <ion-badge :color="meta.color">{{ meta.label }}</ion-badge>
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
