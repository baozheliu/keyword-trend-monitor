<script setup>
/**
 * Liquid-glass surface: hosts the sheen sweep and the pointer-following
 * glow, and feeds the pointer position into CSS variables.
 */
import { ref } from 'vue'

defineProps({
  card: { type: Boolean, default: false },
  interactive: { type: Boolean, default: false },
})

const el = ref(null)
const hovered = ref(false)

function onMove(event) {
  const node = el.value
  if (!node) return
  const rect = node.getBoundingClientRect()
  node.style.setProperty('--mx', `${event.clientX - rect.left}px`)
  node.style.setProperty('--my', `${event.clientY - rect.top}px`)
  hovered.value = true
}

function onLeave() {
  hovered.value = false
}
</script>

<template>
  <section
    ref="el"
    class="glass"
    :class="{ 'glass-card': card, 'glass-interactive': interactive, 'is-hovered': hovered }"
    @pointermove="onMove"
    @pointerleave="onLeave"
  >
    <span class="kw-sheen" aria-hidden="true" />
    <span class="kw-glow" aria-hidden="true" />
    <div class="glass-content">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.glass-content {
  position: relative;
  z-index: 1;
}
</style>
