<script setup>
/**
 * SVG displacement filter behind the "true refraction" glass layer.
 * The turbulence field drifts slowly (20s loop) so content behind the
 * glass bends organically. Referenced via backdrop-filter: url(#kw-lens).
 */
import { onMounted, onUnmounted, ref } from 'vue'

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const animate = ref(!reducedMotion.matches)

function onChange(event) {
  animate.value = !event.matches
}

onMounted(() => reducedMotion.addEventListener('change', onChange))
onUnmounted(() => reducedMotion.removeEventListener('change', onChange))
</script>

<template>
  <svg class="kw-lens-defs" aria-hidden="true" focusable="false">
    <filter id="kw-lens" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="2" seed="7" result="noise">
        <animate
          v-if="animate"
          attributeName="baseFrequency"
          dur="20s"
          values="0.012 0.02;0.016 0.024;0.012 0.02"
          repeatCount="indefinite"
        />
      </feTurbulence>
      <feGaussianBlur in="noise" stdDeviation="1.2" result="soft" />
      <feDisplacementMap in="SourceGraphic" in2="soft" scale="14" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </svg>
</template>

<style scoped>
.kw-lens-defs {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}
</style>
