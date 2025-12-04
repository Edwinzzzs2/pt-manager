<template>
  <div class="settings-container">
    <h2>Settings</h2>
  <el-form label-width="120px">
    <el-form-item label="Cron Expression">
        <el-input v-model="cron" placeholder="0 9 * * *">
            <template #append>
                <el-button @click="saveSettings">Save</el-button>
            </template>
        </el-input>
        <div class="help-text">
            Examples:<br>
            Every day at 9:00 AM: 0 9 * * *<br>
            Every 6 hours: 0 */6 * * *
        </div>
      </el-form-item>
      <el-form-item label="Auto Launch">
        <el-switch v-model="autoLaunch" />
      </el-form-item>
      <el-form-item>
          <el-button type="primary" @click="runNow">Run Task Now</el-button>
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
  ElMessage.success('Settings saved')
}

const runNow = async () => {
    await (window as any).ipcRenderer.invoke('run-task')
    ElMessage.success('Task started')
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
