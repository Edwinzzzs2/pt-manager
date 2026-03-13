<template>
  <div class="settings-container">
    <h2>设置</h2>
    <el-form label-width="120px">
      <el-form-item label="定时表达式">
        <el-input v-model="cron" placeholder="0 9 * * *" />
        <div class="help-text">
          示例：每天上午 9 点：0 9 * * *
        </div>
      </el-form-item>
      
      <el-form-item label="窗口打开时间">
        <el-input-number v-model="duration" :min="1" :max="60" />
        <span class="unit-text">分钟</span>
        <div class="help-text">
          定时任务执行时，窗口保持打开的时长（建议 3-10 分钟以确保 Cookie 刷新）
        </div>
      </el-form-item>

      <el-form-item label="开机自启">
        <el-switch v-model="autoLaunch" @change="saveSettings" />
      </el-form-item>
      
      <el-divider />

      <el-form-item>
        <el-button type="primary" @click="runNow">立即执行任务</el-button>
        <el-button @click="saveSettings">保存全部设置</el-button>
      </el-form-item>

      <el-divider />

      <el-form-item label="浏览器缓存">
        <el-button type="danger" plain @click="clearBrowserData">一键清除缓存与 Cookie</el-button>
        <div class="help-text">清除后需要重新登录站点，建议在无法登录或验证码异常时使用</div>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const cron = ref('')
const duration = ref(5)
const autoLaunch = ref(false)
const store = ref<any>({})

onMounted(async () => {
  store.value = await (window as any).ipcRenderer.invoke('get-store')
  cron.value = store.value.cron
  duration.value = store.value.duration || 5
  autoLaunch.value = !!store.value.autoLaunch
})

const saveSettings = async () => {
  store.value.cron = cron.value
  store.value.duration = duration.value
  store.value.autoLaunch = autoLaunch.value
  await (window as any).ipcRenderer.invoke('save-store', JSON.parse(JSON.stringify(store.value)))
  ElMessage.success('设置已保存')
}

const runNow = async () => {
    await (window as any).ipcRenderer.invoke('run-task')
    ElMessage.success('任务已开始')
}

const clearBrowserData = async () => {
  try {
    await ElMessageBox.confirm(
      '将清空内置浏览器的 Cookie 与缓存，可能需要重新登录站点。是否继续？',
      '清除缓存',
      { type: 'warning', confirmButtonText: '确定', cancelButtonText: '取消' }
    )
    const ok = await (window as any).ipcRenderer.invoke('clear-browser-data')
    if (ok) ElMessage.success('已清除缓存与 Cookie')
    else ElMessage.error('清除失败，请查看日志')
  } catch {}
}
</script>

<style scoped>
.settings-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
}

.help-text {
    font-size: 12px;
    color: #909399;
    line-height: 1.5;
    margin-top: 4px;
}

.unit-text {
    margin-left: 10px;
    color: #606266;
}
</style>
