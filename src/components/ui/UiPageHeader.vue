<template>
  <div class="ui-page-header">
    <div class="ui-page-header__left">
      <h1 class="ui-page-header__title">{{ title }}</h1>
      <div v-if="subtitle" class="ui-page-header__subtitle">{{ subtitle }}</div>
    </div>
    <div v-if="$slots.right" class="ui-page-header__right">
      <slot name="right" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<style scoped>
.ui-page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.ui-page-header__title {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.ui-page-header__subtitle {
  margin-top: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.ui-page-header__right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
</style>

