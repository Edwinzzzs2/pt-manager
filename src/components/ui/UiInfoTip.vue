<template>
  <el-popover
    v-model:visible="visible"
    trigger="manual"
    placement="top"
    :width="220"
    :show-arrow="true"
    popper-class="ui-info-tip-popper"
  >
    <div class="ui-info-tip__content">{{ text }}</div>
    <template #reference>
      <button
        type="button"
        class="ui-info-tip"
        :aria-label="ariaLabel"
        @mouseenter="visible = true"
        @mouseleave="visible = false"
        @focus="visible = true"
        @blur="visible = false"
        @click="visible = !visible"
      >
        ?
      </button>
    </template>
  </el-popover>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

defineProps<{
  text: string
  ariaLabel: string
}>()

const visible = ref(false)

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') visible.value = false
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.ui-info-tip {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid var(--gray-300);
  background: var(--gray-50);
  color: var(--gray-600);
  font-size: 11px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
  cursor: pointer;
  transition: all 150ms ease;
}

.ui-info-tip:hover,
.ui-info-tip:focus-visible {
  color: #fff;
  background: var(--primary-600);
  border-color: var(--primary-600);
  outline: none;
}

.ui-info-tip__content {
  font-size: 12px;
  color: var(--text-primary);
  line-height: 1.45;
}
</style>

