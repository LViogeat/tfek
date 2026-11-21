<template>
  <!-- Tampon rond « INVITATION · TFEK », couleur héritée (currentColor) -->
  <svg class="tfek-stamp" viewBox="0 0 100 100" aria-hidden="true">
    <defs>
      <path :id="pathId" d="M50,50 m-36,0 a36,36 0 1,1 72,0 a36,36 0 1,1 -72,0" />
    </defs>
    <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" stroke-width="1.6" />
    <circle cx="50" cy="50" r="43.5" fill="none" stroke="currentColor" stroke-width="0.8" />
    <circle cx="50" cy="50" r="26" fill="none" stroke="currentColor" stroke-width="1" />
    <text font-size="8.4" font-weight="700" fill="currentColor">
      <!-- textLength : le texte fait exactement le tour du cercle (2π × 36 ≈ 226) -->
      <textPath :href="`#${pathId}`" textLength="222" lengthAdjust="spacing">INVITATION · TFEK · INVITATION · TFEK ·</textPath>
    </text>
    <text x="50" y="55" text-anchor="middle" font-size="14" font-weight="800" fill="currentColor">tfek</text>
  </svg>
</template>

<script setup lang="ts">
// Identifiant unique : plusieurs tampons peuvent coexister dans le DOM (pages gardées en cache par Ionic)
const pathId = `tfek-stamp-${Math.random().toString(36).slice(2, 9)}`
</script>

<style scoped>
.tfek-stamp {
  font-family: var(--tfek-font-mono);
}
</style>
