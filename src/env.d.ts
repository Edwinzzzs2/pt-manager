/// <reference types="vite/client" />

declare module '*.vue' {
    import type { DefineComponent } from 'vue'
    const component: DefineComponent<{}, {}, any>
    export default component
}

interface Window {
    ipcRenderer: {
        on: (...args: any[]) => any
        off: (...args: any[]) => any
        send: (...args: any[]) => any
        invoke: (...args: any[]) => Promise<any>
    }
}
