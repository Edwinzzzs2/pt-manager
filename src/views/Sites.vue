<template>
  <div class="sites-container">
    <div class="header">
      <h2>站点管理</h2>
      <el-button type="primary" @click="addSite">新增站点</el-button>
    </div>

    <!-- Desktop Table View -->
    <div class="table-view">
      <el-table :data="sites" style="width: 100%">
        <el-table-column prop="name" label="名称" min-width="120">
          <template #default="scope">
            <el-input v-if="scope.row.editing" v-model="scope.row.name" />
            <span v-else class="text-truncate">{{ scope.row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="url" label="链接" min-width="200">
          <template #default="scope">
            <el-input v-if="scope.row.editing" v-model="scope.row.url" />
            <a v-else :href="scope.row.url" target="_blank" class="text-truncate d-block">{{ scope.row.url }}</a>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="scope">
            <div class="action-buttons">
              <template v-if="!scope.row.editing">
                    <el-button size="small" @click="handleEdit(scope.row)">编辑</el-button>
                    <el-button size="small" type="danger" @click="handleDelete(scope.$index)">删除</el-button>
                    <el-button size="small" @click="handleOpen(scope.row)">打开</el-button>
              </template>
              <template v-else>
                    <el-button size="small" type="success" @click="handleSave(scope.row)">保存</el-button>
                    <el-button size="small" @click="scope.row.editing = false">取消</el-button>
              </template>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- Mobile Card View -->
    <div class="card-view">
      <div v-for="(site, index) in sites" :key="site.id" class="site-card">
            <div class="card-header">
              <div class="site-name">
                <el-input v-if="site.editing" v-model="site.name" size="small" />
                <span v-else>{{ site.name }}</span>
              </div>
            </div>
        <div class="card-body">
          <div class="site-url">
            <el-input v-if="site.editing" v-model="site.url" size="small" />
            <a v-else :href="site.url" target="_blank">{{ site.url }}</a>
          </div>
        </div>
        <div class="card-footer">
              <template v-if="!site.editing">
                <el-button size="small" @click="handleEdit(site)">编辑</el-button>
                <el-button size="small" type="danger" @click="handleDelete(index)">删除</el-button>
                <el-button size="small" @click="handleOpen(site)">打开</el-button>
              </template>
              <template v-else>
                <el-button size="small" type="success" @click="handleSave(site)">保存</el-button>
                <el-button size="small" @click="site.editing = false">取消</el-button>
              </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Site {
  id: string
  name: string
  url: string
  editing?: boolean
}

const sites = ref<Site[]>([])
const store = ref<any>({})

onMounted(async () => {
  await loadStore()
})

const loadStore = async () => {
  const ipc = (window as any).ipcRenderer
  if (ipc && ipc.invoke) {
    store.value = await ipc.invoke('get-store')
    sites.value = store.value.sites || []
  } else {
    sites.value = [
      { id: '1', name: 'M-Team', url: 'https://next.m-team.cc/index' },
    ]
  }
}

const saveStore = async () => {
  store.value.sites = sites.value.map(({ editing, ...rest }) => rest)
  await (window as any).ipcRenderer.invoke('save-store', JSON.parse(JSON.stringify(store.value)))
}

const addSite = () => {
  sites.value.push({
    id: Date.now().toString(),
    name: '新站点',
    url: 'https://',
    editing: true
  })
}

const handleEdit = (row: Site) => {
  row.editing = true
}

const handleSave = async (row: Site) => {
  row.editing = false
  await saveStore()
}

const handleDelete = async (index: number) => {
  sites.value.splice(index, 1)
  await saveStore()
}

const handleOpen = (row: Site) => {
    (window as any).ipcRenderer.invoke('open-external', row.url)
}
</script>

<style scoped>
.sites-container { padding-left: inherit; padding-right: inherit; }
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

/* Utility Classes */
.text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  display: block;
}

.d-block {
  display: block;
}

.action-buttons {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

/* View Toggle Logic */
.card-view {
  display: none;
}

@media (max-width: 767.98px) {
  .table-view {
    display: none;
  }

  .card-view {
    display: block;
  }

  .header h2 {
    font-size: 1.25rem;
  }
}

/* Card View Styles */
.site-card {
  background: white;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  margin-bottom: var(--space-4);
  border: 1px solid var(--gray-200);
  overflow: hidden;
}

.card-header {
  padding: var(--space-3) var(--space-4);
  background: var(--gray-50);
  border-bottom: 1px solid var(--gray-200);
  font-weight: 600;
}

.card-body {
  padding: var(--space-4);
}

.card-footer {
  padding: var(--space-3) var(--space-4);
  background: var(--gray-50);
  border-top: 1px solid var(--gray-200);
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
}

.site-name {
  font-size: 1rem;
  color: var(--gray-900);
}

.site-url {
  color: var(--primary-600);
  word-break: break-all;
}

.site-url a {
  color: inherit;
  text-decoration: none;
}

.site-url a:hover {
  text-decoration: underline;
}
</style>
