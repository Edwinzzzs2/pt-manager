import { createRouter, createWebHashHistory } from 'vue-router'
import Sites from '../views/Sites.vue'
import Settings from '../views/Settings.vue'
import Logs from '../views/Logs.vue'

const routes = [
    { path: '/', component: Sites },
    { path: '/settings', component: Settings },
    { path: '/logs', component: Logs },
]

const router = createRouter({
    history: createWebHashHistory(),
    routes,
})

export default router
