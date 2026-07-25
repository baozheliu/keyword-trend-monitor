<script setup>
/** Subscription icon: auto letter, emoji, or locally uploaded image. */
defineProps({
  icon: { type: Object, required: true },
  image: { type: String, default: null },
  size: { type: Number, default: 40 },
})
</script>

<template>
  <span
    class="sub-icon"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${size * 0.48}px` }"
  >
    <img v-if="icon.kind === 'image' && image" :src="image" alt="" />
    <span v-else-if="icon.kind === 'emoji'" class="emoji">{{ icon.value }}</span>
    <svg v-else-if="icon.kind === 'image'" class="placeholder" viewBox="0 0 24 24" width="45%" height="45%" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="2" />
      <circle cx="9" cy="9" r="2" fill="currentColor" />
      <path d="M5 17l4-4 3 3 4-5 3 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
    </svg>
    <span v-else class="letter">{{ [...icon.value][0] }}</span>
  </span>
</template>

<style scoped>
/* Neutral glass tile — no brand color behind letters or emoji. */
.sub-icon {
  display: inline-grid;
  place-items: center;
  border-radius: 12px;
  overflow: hidden;
  background: var(--glass-fill-strong);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.45),
    inset 0 0 0 1px color-mix(in srgb, var(--text) 8%, transparent),
    0 2px 6px -3px rgba(20, 30, 60, 0.35);
  flex: none;
}
.sub-icon img { width: 100%; height: 100%; object-fit: cover; }
.letter {
  color: var(--text);
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.25);
}
.emoji { text-shadow: none; }
.placeholder { color: var(--text-tertiary); }
</style>
