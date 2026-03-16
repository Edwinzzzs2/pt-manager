<template>
  <div class="settings-page">
    <UiPageHeader title="设置" subtitle="任务配置与浏览器环境维护" />

    <transition name="ui-fade-slide" mode="out-in">
      <div v-if="loading" key="loading">
        <el-row :gutter="16">
          <el-col :xs="24" :lg="24"><UiCardSkeleton :rows="3" /></el-col>
          <el-col :xs="24" :lg="16"><UiCardSkeleton :rows="5" /></el-col>
          <el-col :xs="24" :lg="8"><UiCardSkeleton :rows="4" /></el-col>
        </el-row>
      </div>

      <div v-else key="content">
        <el-row :gutter="16">
          <el-col :xs="24" :lg="24">
            <UiCard compact hover>
              <div class="cache-actions">
                <el-tooltip content="清除后需重新登录，建议仅在登录异常时执行。" placement="top">
                  <span class="hover-title">浏览器缓存</span>
                </el-tooltip>
                <el-button type="danger" plain :disabled="busy" @click="clearBrowserData">清除缓存与 Cookie</el-button>
              </div>
            </UiCard>
          </el-col>

          <el-col :xs="24" :lg="16">
            <UiCard title="任务配置" compact hover>
              <el-form label-position="left" label-width="110px" class="form-modern">
                <el-form-item>
                  <template #label>
                    <el-tooltip content="采用 Cron 格式，建议每天固定时间执行。" placement="top">
                      <span class="label-with-tip">定时表达式</span>
                    </el-tooltip>
                  </template>
                  <el-input v-model="cron" placeholder="0 9 * * *" />
                </el-form-item>

                <el-form-item>
                  <template #label>
                    <el-tooltip content="建议 3-10 分钟，确保站点 Cookie 刷新。" placement="top">
                      <span class="label-with-tip">窗口打开时间</span>
                    </el-tooltip>
                  </template>
                  <div class="inline">
                    <el-input-number v-model="duration" :min="1" :max="60" />
                    <span class="unit">分钟</span>
                  </div>
                </el-form-item>

                <el-form-item>
                  <template #label>
                    <el-tooltip content="开启后系统启动时自动启动应用。" placement="top">
                      <span class="label-with-tip">开机自启</span>
                    </el-tooltip>
                  </template>
                  <el-switch v-model="autoLaunch" :disabled="busy" @change="saveSettings" />
                </el-form-item>
              </el-form>
            </UiCard>
          </el-col>

          <el-col :xs="24" :lg="8">
            <UiCard title="快捷操作" compact hover>
              <div class="quick-actions">
                <el-button type="primary" class="btn-block" :loading="running" @click="runNow">立即执行任务</el-button>
                <el-button class="btn-block" :loading="saving" @click="saveSettings">保存全部设置</el-button>
              </div>
            </UiCard>
          </el-col>
        </el-row>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import UiPageHeader from '../components/ui/UiPageHeader.vue'
import UiCard from '../components/ui/UiCard.vue'
import UiCardSkeleton from '../components/ui/UiCardSkeleton.vue'

const cron = ref('')
const duration = ref(5)
const autoLaunch = ref(false)
const store = ref<any>({})
const loading = ref(true)
const saving = ref(false)
const running = ref(false)
const busy = ref(false)

onMounted(async () => {
  try {
    store.value = await (window as any).ipcRenderer.invoke('get-store')
    cron.value = store.value.cron
    duration.value = store.value.duration || 5
    autoLaunch.value = !!store.value.autoLaunch
  } finally {
    loading.value = false
  }
})

const saveSettings = async () => {
  saving.value = true
  busy.value = true
  try {
    store.value.cron = cron.value
    store.value.duration = duration.value
    store.value.autoLaunch = autoLaunch.value
    await (window as any).ipcRenderer.invoke('save-store', JSON.parse(JSON.stringify(store.value)))
    ElMessage.success('设置已保存')
  } finally {
    saving.value = false
    busy.value = false
  }
}

const runNow = async () => {
  running.value = true
  busy.value = true
  try {
    await (window as any).ipcRenderer.invoke('run-task')
    ElMessage.success('任务已开始')
  } finally {
    running.value = false
    busy.value = false
  }
}

const clearBrowserData = async () => {
  try {
    await ElMessageBox.confirm(
      '将清空内置浏览器的 Cookie 与缓存，可能需要重新登录站点。是否继续？',
      '清除缓存',
      { type: 'warning', confirmButtonText: '确定', cancelButtonText: '取消' }
    )
    busy.value = true
    const ok = await (window as any).ipcRenderer.invoke('clear-browser-data')
    if (ok) ElMessage.success('已清除缓存与 Cookie')
    else ElMessage.error('清除失败，请查看日志')
  } catch {
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.settings-page {
  max-width: 980px;
  margin: 0;
  padding: 6px 8px 8px;
}

.settings-page :deep(.ui-page-header) {
  margin-bottom: var(--space-2);
}

.settings-page :deep(.ui-page-header__title) {
  font-size: 22px;
}

.settings-page :deep(.ui-page-header__subtitle) {
  margin-top: 4px;
}

.cache-actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--space-2);
}

.hover-title {
  font-size: var(--text-md);
  color: var(--text-primary);
  font-weight: 600;
  cursor: help;
  white-space: nowrap;
}

.form-modern :deep(.el-form-item) {
  margin-bottom: var(--space-2);
}

.form-modern :deep(.el-form-item__label) {
  font-weight: 600;
  color: var(--text-primary);
  padding-right: var(--space-2);
}

.label-with-tip {
  display: inline-flex;
  align-items: center;
  cursor: help;
  white-space: nowrap;
}

.form-modern :deep(.el-form-item__content) {
  min-width: 0;
}

.form-modern :deep(.el-input),
.form-modern :deep(.el-input-number) {
  width: 100%;
}

.inline {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: var(--space-2);
}

.unit {
  display: inline-block;
  white-space: nowrap;
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.quick-actions {
  display: flex;
  flex-direction: row;
  gap: var(--space-2);
}

.btn-block {
  flex: 1 1 0;
  width: auto;
}

@media (max-width: 767.98px) {
  .cache-actions {
    justify-content: flex-start;
  }

  .form-modern :deep(.el-form-item__label) {
    text-align: left;
  }

  .quick-actions {
    flex-direction: column;
  }
}
</style>
