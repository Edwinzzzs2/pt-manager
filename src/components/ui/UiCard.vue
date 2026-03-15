<template>
  <section class="ui-card" :class="{ hover: hover }">
    <header v-if="title || subtitle || $slots.actions" class="ui-card__header">
      <div class="ui-card__title">
        <div v-if="title" class="ui-card__titleText">{{ title }}</div>
        <div v-if="subtitle" class="ui-card__subtitle">{{ subtitle }}</div>
      </div>
      <div v-if="$slots.actions" class="ui-card__actions">
        <slot name="actions" />
      </div>
    </header>
    <div class="ui-card__body" :class="{ compact: compact }">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title?: string
  subtitle?: string
  hover?: boolean
  compact?: boolean
}>()
</script>

<style scoped>
.ui-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
}

.ui-card.hover:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.ui-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-4) 0;
}

.ui-card__titleText {
  font-size: var(--text-lg);
  line-height: 1.25;
  font-weight: 700;
  color: var(--text-primary);
}

.ui-card__subtitle {
  margin-top: var(--space-1);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.ui-card__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.ui-card__body {
  padding: var(--space-4);
}

.ui-card__body.compact {
  padding: var(--space-3) var(--space-4);
}
</style>

