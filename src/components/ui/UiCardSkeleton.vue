<template>
  <div class="ui-card-skeleton">
    <el-skeleton :rows="rows" animated />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  rows?: number
}>()
</script>

<style scoped>
.ui-card-skeleton {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: var(--space-4);
}
</style>

