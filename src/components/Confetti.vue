<template>
  <div class="confetti" aria-hidden="true">
    <span v-for="p in pieces" :key="p.i" :style="p.style" />
  </div>
</template>

<script setup lang="ts">
// Petite explosion de confettis jouée une seule fois (désactivée si l'utilisateur réduit les animations)
const COLORS = ['var(--t-accent)', 'var(--tfek-paper)', 'var(--t-accent)', 'rgba(241, 237, 228, 0.55)']

const pieces = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * Math.PI - Math.PI // demi-cercle vers le haut
  const dist = 70 + ((i * 37) % 60)
  return {
    i,
    style: {
      '--x': `${Math.cos(angle) * dist * 1.6}px`,
      '--y': `${Math.sin(angle) * dist}px`,
      '--r': `${(i * 67) % 360}deg`,
      background: COLORS[i % COLORS.length],
      animationDelay: `${(i % 4) * 30}ms`,
    },
  }
})
</script>

<style scoped>
.confetti {
  position: absolute;
  left: 50%;
  top: 60px;
  width: 0;
  height: 0;
  pointer-events: none;
  z-index: 5;
}
.confetti span {
  position: absolute;
  width: 8px;
  height: 14px;
  border-radius: 2px;
  opacity: 0;
  animation: burst 1.3s cubic-bezier(0.2, 0.7, 0.3, 1) forwards;
}
@keyframes burst {
  0% {
    opacity: 1;
    transform: translate(0, 0) rotate(0deg);
  }
  70% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(var(--x), calc(var(--y) + 60px)) rotate(var(--r));
  }
}
@media (prefers-reduced-motion: reduce) {
  .confetti {
    display: none;
  }
}
</style>
