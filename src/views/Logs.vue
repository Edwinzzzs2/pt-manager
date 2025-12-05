<template>
  <div class="logs-container">
    <div class="header">
        <h2>日志</h2>
        <el-button @click="refreshLogs">刷新</el-button>
    </div>
    <div class="log-content">
        <div v-for="(log, index) in logs" :key="index" class="log-line">
            {{ log }}
        </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const logs = ref<string[]>([])

const refreshLogs = async () => {
  logs.value = await (window as any).ipcRenderer.invoke('get-logs')
}

onMounted(() => {
  refreshLogs()
})
</script>

<style scoped>
.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}
.log-content {
    background: #f5f7fa;
    padding: 10px;
    border-radius: 4px;
    height: '90%';
    min-height: 400px;
    overflow-y: auto;
    font-family: monospace;
}
.log-line {
    margin-bottom: 4px;
    border-bottom: 1px solid #eee;
    padding-bottom: 2px;
}
</style>
