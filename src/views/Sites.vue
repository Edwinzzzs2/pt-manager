<template>
  <div class="sites-container">
    <div class="header">
      <h2>Sites Management</h2>
      <el-button type="primary" @click="addSite">Add Site</el-button>
    </div>

    <el-table :data="sites" style="width: 100%">
      <el-table-column prop="name" label="Name" width="180">
        <template #default="scope">
            <el-input v-if="scope.row.editing" v-model="scope.row.name" />
            <span v-else>{{ scope.row.name }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="url" label="URL">
        <template #default="scope">
            <el-input v-if="scope.row.editing" v-model="scope.row.url" />
            <a v-else :href="scope.row.url" target="_blank">{{ scope.row.url }}</a>
        </template>
      </el-table-column>
      <el-table-column label="Actions" width="200">
        <template #default="scope">
          <el-button size="small" @click="handleEdit(scope.row)" v-if="!scope.row.editing">Edit</el-button>
          <el-button size="small" type="success" @click="handleSave(scope.row)" v-else>Save</el-button>
          <el-button size="small" type="danger" @click="handleDelete(scope.$index)">Delete</el-button>
          <el-button size="small" @click="handleOpen(scope.row)" v-if="!scope.row.editing">Open</el-button>
        </template>
      </el-table-column>
    </el-table>
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
  store.value = await (window as any).ipcRenderer.invoke('get-store')
  sites.value = store.value.sites || []
}

const saveStore = async () => {
  store.value.sites = sites.value.map(({ editing, ...rest }) => rest)
  await (window as any).ipcRenderer.invoke('save-store', JSON.parse(JSON.stringify(store.value)))
}

const addSite = () => {
  sites.value.push({
    id: Date.now().toString(),
    name: 'New Site',
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
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
</style>
