<template>
  <div class="sites-container">
    <div class="header">
      <h2>站点管理</h2>
      <el-button type="primary" :icon="Plus" @click="addSite">新增站点</el-button>
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
        <el-table-column label="自动打开" width="100" align="center">
          <template #default="scope">
            <el-switch
              v-model="scope.row.active"
              @change="handleSwitchChange"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right" align="center">
          <template #default="scope">
            <div class="action-buttons">
              <template v-if="!scope.row.editing">
                <el-tooltip content="编辑" placement="top">
                  <el-button type="primary" link :icon="Edit" @click="handleEdit(scope.row)" />
                </el-tooltip>
                <el-tooltip content="立即打开" placement="top">
                  <el-button type="success" link :icon="Link" @click="handleOpen(scope.row)" />
                </el-tooltip>
                <el-tooltip content="删除" placement="top">
                  <el-button type="danger" link :icon="Delete" @click="handleDelete(scope.$index)" />
                </el-tooltip>
              </template>
              <template v-else>
                <el-tooltip content="保存" placement="top">
                  <el-button type="success" link :icon="Check" @click="handleSave(scope.row)" />
                </el-tooltip>
                <el-tooltip content="取消" placement="top">
                  <el-button type="info" link :icon="Close" @click="scope.row.editing = false" />
                </el-tooltip>
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
          <div class="site-active">
            <el-switch v-model="site.active" size="small" @change="handleSwitchChange" />
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
            <el-button size="small" :icon="Edit" @click="handleEdit(site)">编辑</el-button>
            <el-button size="small" type="danger" :icon="Delete" @click="handleDelete(index)">删除</el-button>
            <el-button size="small" :icon="Link" @click="handleOpen(site)">打开</el-button>
          </template>
          <template v-else>
            <el-button size="small" type="success" :icon="Check" @click="handleSave(site)">保存</el-button>
            <el-button size="small" :icon="Close" @click="site.editing = false">取消</el-button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Edit, Delete, Link, Check, Close, Plus } from '@element-plus/icons-vue'

interface Site {
  id: string
  name: string
  url: string
  active?: boolean
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
    sites.value = (store.value.sites || []).map((s: any) => ({
      ...s,
      active: s.active !== false // default true
    }))
  } else {
    sites.value = [
      { id: '1', name: 'M-Team', url: 'https://next.m-team.cc/index', active: true },
    ]
  }
}

const saveStore = async () => {
  store.value.sites = sites.value.map(({ editing, ...rest }) => rest)
  await (window as any).ipcRenderer.invoke('save-store', JSON.parse(JSON.stringify(store.value)))
}

const handleSwitchChange = async () => {
  await saveStore()
}

const addSite = () => {
  sites.value.push({
    id: Date.now().toString(),
    name: '新站点',
    url: 'https://',
    active: true,
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
  justify-content: center;
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
  display: flex;
  justify-content: space-between;
  align-items: center;
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
