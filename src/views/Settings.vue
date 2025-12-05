<template>
  <div class="settings-container">
    <h2>设置</h2>
  <el-form label-width="120px">
    <el-form-item label="定时表达式">
        <el-input v-model="cron" placeholder="0 9 * * *">
            <template #append>
                <el-button @click="saveSettings">保存</el-button>
            </template>
        </el-input>
        <div class="help-text">
          示例：每天上午 9 点：0 9 * * *
        </div>
      </el-form-item>
      <el-form-item label="开机自启">
        <el-switch v-model="autoLaunch" />
      </el-form-item>
      <el-form-item>
          <el-button type="primary" @click="runNow">立即执行任务</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const cron = ref('')
const autoLaunch = ref(false)
const store = ref<any>({})

onMounted(async () => {
  store.value = await (window as any).ipcRenderer.invoke('get-store')
  cron.value = store.value.cron
  autoLaunch.value = !!store.value.autoLaunch
})

const saveSettings = async () => {
  store.value.cron = cron.value
  store.value.autoLaunch = autoLaunch.value
  await (window as any).ipcRenderer.invoke('save-store', JSON.parse(JSON.stringify(store.value)))
  ElMessage.success('设置已保存')
}

const runNow = async () => {
    await (window as any).ipcRenderer.invoke('run-task')
    ElMessage.success('任务已开始')
}
</script>

<style scoped>
.help-text {
    font-size: 12px;
    color: #666;
    margin-top: 5px;
    line-height: 1.5;
}
</style>
