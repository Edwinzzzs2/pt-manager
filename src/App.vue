<template>
  <div class="app-container">
    <el-container>
      <el-aside width="200px">
        <el-menu
          router
          :default-active="$route.path"
          class="el-menu-vertical-demo"
        >
          <el-menu-item index="/">
            <el-icon><Monitor /></el-icon>
            <span>Sites</span>
          </el-menu-item>
          <el-menu-item index="/settings">
            <el-icon><Setting /></el-icon>
            <span>Settings</span>
          </el-menu-item>
          <el-menu-item index="/logs">
            <el-icon><Document /></el-icon>
            <span>Logs</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { Monitor, Setting, Document } from '@element-plus/icons-vue'
</script>

<style>
html, body, #app, .app-container, .el-container {
  height: 100%;
  margin: 0;
}

.el-aside {
  background-color: #f5f7fa;
  border-right: 1px solid #e6e6e6;
}

.el-menu {
  border-right: none;
  background-color: transparent;
}
</style>
