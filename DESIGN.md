# PT Manager — 重构技术设计文档

> 将原有 **Vue3 + Electron** 架构重构为 **React + Tauri v2** 架构，通过 **Chrome CDP接管** 绕过Cloudflare防护，定时自动刷新PT站登录状态。

---

## 目录

- [重构动机](#重构动机)
- [技术选型](#技术选型)
- [新版架构总览](#新版架构总览)
- [目录结构](#目录结构)
- [前端层：React + shadcn/ui](#前端层react--shadcnui)
- [后端层：Rust (Tauri)](#后端层rust-tauri)
- [CF绕过核心：Chrome CDP接管](#cf绕过核心chrome-cdp接管)
- [数据结构](#数据结构)
- [Tauri Commands（前后端接口）](#tauri-commands前后端接口)
- [重构迁移对照表](#重构迁移对照表)
- [搭建步骤](#搭建步骤)
- [使用流程](#使用流程)
- [FAQ](#faq)

---

## 重构动机

| 问题 | Electron（旧） | Tauri v2（新） |
|---|---|---|
| **包体积** | ~150MB（含V8引擎）| ~8MB（使用系统WebView）|
| **内存占用** | ~200MB | ~30MB |
| **CF绕过** | 内置BrowserWindow无Cookie，遇Turnstile被封 | Rust直接调用CDP REST API，接管本地Chrome |
| **定时调度** | node-cron（JS运行时） | tokio-cron-scheduler（Rust原生异步）|
| **系统集成** | Electron API | Tauri官方插件生态 |
| **安全性** | Node集成风险 | IPC权限控制，前端无法直接访问系统 |

---

## 技术选型

### UI框架推荐：shadcn/ui ✅

对比三个候选方案后，选择 **shadcn/ui**：

| | shadcn/ui ✅ | Ant Design | Mantine |
|---|---|---|---|
| **设计风格** | 现代简洁，高度可定制 | 企业风格（偏重），难以修改 | 清爽，但组件风格偏保守 |
| **打包体积** | 极小（只引入用到的组件代码） | 较大（全量引入） | 中等 |
| **Tauri适配** | 完美（Tailwind对原生WebView友好）| 一般 | 一般 |
| **2025年生态** | 最活跃，社区规模最大 | 成熟稳定 | 成长中 |
| **自定义程度** | 极高（代码完全归你所有）| 有限（受限于主题系统）| 中等 |

### 完整技术栈

| 层次 | 技术 | 版本 | 用途 |
|---|---|---|---|
| **前端框架** | React | 18 | UI渲染 |
| **构建工具** | Vite | 5 | 热重载、打包 |
| **语言** | TypeScript | 5 | 类型安全 |
| **UI组件** | shadcn/ui | latest | 组件库 |
| **CSS框架** | Tailwind CSS | 3 | 样式系统 |
| **状态管理** | Zustand | 4 | 前端状态 |
| **路由** | React Router | 6 | 页面路由 |
| **桌面框架** | Tauri | v2 | 原生桌面能力 |
| **后端语言** | Rust | stable | 系统调用、调度 |
| **定时调度** | tokio-cron-scheduler | 0.13 | Cron定时任务 |
| **HTTP客户端** | reqwest | 0.12 | CDP REST API调用 |
| **配置存储** | tauri-plugin-store | 2 | JSON持久化 |
| **开机自启** | tauri-plugin-autostart | 2 | 开机自动启动 |
| **系统托盘** | Tauri v2 内置 | - | 托盘菜单 |
| **Shell调用** | tauri-plugin-shell | 2 | （可选）启动Chrome |

---

## 新版架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                    React 前端 (Vite)                         │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │  Sites   │  │ Settings │  │   Logs   │  │  Dashboard│  │
│  │  站点管理 │  │  设置页  │  │  日志页  │  │  状态总览 │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────┘  │
│                                                              │
│  shadcn/ui 组件  │  Zustand 状态  │  Tauri invoke() API     │
└──────────────────────────────┬──────────────────────────────┘
                                │ Tauri IPC (安全沙盒)
┌──────────────────────────────▼──────────────────────────────┐
│                    Rust 后端 (Tauri v2)                       │
│                                                              │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │   Commands 层        │    │      后台服务层              │ │
│  │                     │    │                             │ │
│  │ get_store()         │    │  tokio-cron-scheduler       │ │
│  │ save_store()        │    │  （定时触发保活任务）         │ │
│  │ get_logs()          │    │                             │ │
│  │ run_task()          │    │  系统托盘                    │ │
│  │ check_chrome_cdp()  │    │  开机自启                    │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              CF绕过核心：CDP接管模块                      │ │
│  │                                                         │ │
│  │  reqwest → GET  http://localhost:9222/json/version      │ │
│  │  reqwest → PUT  http://localhost:9222/json/new?url=...  │ │
│  │  reqwest → DELETE http://localhost:9222/json/{tabId}    │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────┘
                                │ CDP REST API
┌──────────────────────────────▼──────────────────────────────┐
│              用户本地 Chrome（带 --remote-debugging-port）    │
│              已登录的 Session Cookie / cf_clearance          │
└─────────────────────────────────────────────────────────────┘
```

---

## 目录结构

```
pt-manager/
├── src/                          # React 前端
│   ├── components/
│   │   └── ui/                   # shadcn/ui 组件（cli自动生成）
│   ├── pages/
│   │   ├── Sites.tsx             # 站点管理
│   │   ├── Settings.tsx          # 设置页
│   │   ├── Logs.tsx              # 日志查看
│   │   └── Dashboard.tsx         # 状态总览（新增）
│   ├── store/
│   │   └── useAppStore.ts        # Zustand 全局状态
│   ├── lib/
│   │   ├── tauri.ts              # Tauri invoke 封装
│   │   └── utils.ts              # shadcn/ui 工具函数
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css                 # Tailwind 入口
│
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── main.rs               # 应用入口、Tauri配置
│   │   ├── commands.rs           # Tauri Commands（IPC接口）
│   │   ├── scheduler.rs          # 定时调度（tokio-cron）
│   │   ├── cdp.rs                # Chrome CDP接管核心
│   │   ├── store.rs              # 配置持久化
│   │   └── logger.rs             # 日志模块
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── capabilities/
│       └── default.json          # 权限声明
│
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── components.json               # shadcn/ui 配置
└── DESIGN.md
```

---

## 前端层：React + shadcn/ui

### 状态管理（Zustand）

```ts
// src/store/useAppStore.ts
import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'

interface Site {
  id: string
  name: string
  url: string
}

interface AppStore {
  // 数据
  sites: Site[]
  cron: string
  autoLaunch: boolean
  mode: 'cdp' | 'webview'
  cdpPort: number
  chromePath: string
  visitDuration: number
  randomDelay: boolean
  logs: string[]

  // 状态
  isRunning: boolean
  cdpStatus: 'connected' | 'disconnected' | 'unknown'

  // Actions
  loadStore: () => Promise<void>
  saveStore: () => Promise<void>
  runTask: () => Promise<void>
  checkCdp: () => Promise<void>
  setSites: (sites: Site[]) => void
  setCron: (cron: string) => void
}

export const useAppStore = create<AppStore>((set, get) => ({
  sites: [],
  cron: '0 9 * * *',
  autoLaunch: false,
  mode: 'cdp',
  cdpPort: 9222,
  chromePath: '',
  visitDuration: 30,
  randomDelay: true,
  logs: [],
  isRunning: false,
  cdpStatus: 'unknown',

  loadStore: async () => {
    const data = await invoke<any>('get_store')
    set({ ...data })
  },

  saveStore: async () => {
    const { sites, cron, autoLaunch, mode, cdpPort, visitDuration, randomDelay } = get()
    await invoke('save_store', { data: { sites, cron, autoLaunch, mode, cdpPort, visitDuration, randomDelay } })
  },

  runTask: async () => {
    set({ isRunning: true })
    try {
      await invoke('run_task')
    } finally {
      set({ isRunning: false })
    }
  },

  checkCdp: async () => {
    const ok = await invoke<boolean>('check_chrome_cdp')
    set({ cdpStatus: ok ? 'connected' : 'disconnected' })
  },

  setSites: (sites) => set({ sites }),
  setCron: (cron) => set({ cron }),
}))
```

### 页面结构

**Dashboard.tsx** — 状态总览（新增）
```tsx
// 实时显示：
// - Chrome CDP连接状态（绿灯/红灯）
// - 下次执行时间
// - 站点数量
// - 最近一次执行结果
// - 手动触发按钮
```

**Sites.tsx** — 站点管理（与现在Sites.vue功能一致）

**Settings.tsx** — 设置（增加CDP配置区域）

**Logs.tsx** — 日志（实时滚动展示）

---

## 后端层：Rust (Tauri)

### Cargo.toml 依赖

```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon", "image-png"] }
tauri-plugin-store = "2"
tauri-plugin-autostart = "2"
tauri-plugin-shell = "2"
tokio = { version = "1", features = ["full"] }
tokio-cron-scheduler = "0.13"
reqwest = { version = "0.12", features = ["json"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
chrono = "0.4"
log = "0.4"
```

### `src-tauri/src/cdp.rs` —  CDP接管核心

Chrome的CDP接口除了WebSocket外，还暴露了**REST HTTP接口**，可以用`reqwest`直接调用，无需复杂的WebSocket库：

```rust
use reqwest::Client;
use serde::Deserialize;

#[derive(Deserialize)]
struct CdpTab {
    id: String,
    #[serde(rename = "type")]
    tab_type: String,
    url: String,
}

pub struct CdpClient {
    client: Client,
    base_url: String,
}

impl CdpClient {
    pub fn new(port: u16) -> Self {
        Self {
            client: Client::new(),
            base_url: format!("http://localhost:{}", port),
        }
    }

    /// 检测Chrome是否以调试模式运行
    pub async fn is_available(&self) -> bool {
        self.client
            .get(format!("{}/json/version", self.base_url))
            .timeout(std::time::Duration::from_secs(2))
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false)
    }

    /// 在Chrome中打开新标签页，返回tabId
    pub async fn open_tab(&self, url: &str) -> anyhow::Result<String> {
        let encoded = urlencoding::encode(url);
        let res = self.client
            .put(format!("{}/json/new?{}", self.base_url, encoded))
            .send()
            .await?
            .json::<CdpTab>()
            .await?;
        Ok(res.id)
    }

    /// 关闭指定标签页
    pub async fn close_tab(&self, tab_id: &str) -> anyhow::Result<()> {
        self.client
            .delete(format!("{}/json/close/{}", self.base_url, tab_id))
            .send()
            .await?;
        Ok(())
    }
}
```

> **关键设计**：使用 Chrome CDP 的 REST 接口（`/json/new`、`/json/close`），无需 WebSocket，用`reqwest`即可实现，是最轻量的方案。

### `src-tauri/src/scheduler.rs` — 定时调度

```rust
use tokio_cron_scheduler::{JobScheduler, Job};
use std::sync::Arc;
use tokio::sync::Mutex;

pub async fn start_scheduler(
    cron: String,
    state: Arc<Mutex<AppState>>,
) -> anyhow::Result<JobScheduler> {
    let sched = JobScheduler::new().await?;

    sched.add(Job::new_async(cron.as_str(), move |_uuid, _l| {
        let state = state.clone();
        Box::pin(async move {
            run_keepalive(state).await;
        })
    })?).await?;

    sched.start().await?;
    Ok(sched)
}

pub async fn run_keepalive(state: Arc<Mutex<AppState>>) {
    let store = {
        let s = state.lock().await;
        s.store.clone()
    };

    let cdp = CdpClient::new(store.cdp_port);

    // 随机延迟（防止整点触发）
    if store.random_delay {
        let delay_secs = rand::random::<u64>() % (30 * 60);
        log::info!("随机延迟 {} 分钟", delay_secs / 60);
        tokio::time::sleep(tokio::time::Duration::from_secs(delay_secs)).await;
    }

    for site in &store.sites {
        log::info!("正在访问: {}", site.url);

        match cdp.open_tab(&site.url).await {
            Ok(tab_id) => {
                // 等待页面加载（CF验证时间 + 随机抖动）
                let base = store.visit_duration as u64;
                let jitter = rand::random::<u64>() % 10;
                tokio::time::sleep(
                    tokio::time::Duration::from_secs(base + jitter)
                ).await;

                // 关闭标签页
                if let Err(e) = cdp.close_tab(&tab_id).await {
                    log::warn!("关闭标签页失败: {}", e);
                }
                log::info!("✓ {} 保活完成", site.name);
            }
            Err(e) => log::error!("✗ {} 失败: {}", site.name, e),
        }

        // 站点间隔 5~15 秒
        let interval = 5 + rand::random::<u64>() % 10;
        tokio::time::sleep(tokio::time::Duration::from_secs(interval)).await;
    }
}
```

### `src-tauri/src/commands.rs` — IPC接口

```rust
use tauri::State;

#[tauri::command]
pub async fn get_store(state: State<'_, AppState>) -> Result<Store, String> {
    Ok(state.store.lock().await.clone())
}

#[tauri::command]
pub async fn save_store(
    state: State<'_, AppState>,
    data: Store
) -> Result<(), String> {
    let mut store = state.store.lock().await;
    *store = data.clone();
    store.save().map_err(|e| e.to_string())?;

    // 重启定时器（cron可能变更）
    restart_scheduler(state.inner()).await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn run_task(state: State<'_, AppState>) -> Result<(), String> {
    run_keepalive(state.inner().clone()).await;
    Ok(())
}

#[tauri::command]
pub async fn check_chrome_cdp(state: State<'_, AppState>) -> Result<bool, String> {
    let store = state.store.lock().await;
    let cdp = CdpClient::new(store.cdp_port);
    Ok(cdp.is_available().await)
}

#[tauri::command]
pub async fn get_logs(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    Ok(state.logs.lock().await.clone())
}
```

### 系统托盘（Tauri v2）

```rust
// src-tauri/src/main.rs
use tauri::tray::{TrayIconBuilder, MouseButton, TrayIconEvent};
use tauri::menu::{MenuBuilder, MenuItemBuilder};

fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItemBuilder::with_id("show", "打开主界面").build(app)?;
    let run  = MenuItemBuilder::with_id("run", "立即执行保活").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "退出").build(app)?;
    let menu = MenuBuilder::new(app).items(&[&show, &run, &quit]).build()?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("PT Manager — 保活运行中")
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "run"  => { tauri::async_runtime::spawn(run_task_from_tray(app.clone())); }
            "quit" => { app.exit(0); }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::DoubleClick { button: MouseButton::Left, .. } = event {
                if let Some(w) = tray.app_handle().get_webview_window("main") {
                    let _ = w.show();
                }
            }
        })
        .build(app)?;

    Ok(())
}
```

---

## CF绕过核心：Chrome CDP接管

### 原理

```
┌──────────────────────────────────────────────────────┐
│  用户正常登录过 audiences.me                          │
│  Chrome本地存有：                                     │
│    cf_clearance = xxxx...（CF认证Token，24小时有效）  │
│    session_cookie = xxxx...（PT站登录态）             │
└──────────────────────────┬───────────────────────────┘
                            │
     Rust通过 CDP REST 调用：
     PUT http://localhost:9222/json/new?https://audiences.me
                            │
                            ▼
┌──────────────────────────────────────────────────────┐
│  Chrome 打开新标签页访问 audiences.me                 │
│                                                      │
│  CF检测到：                                           │
│    ✓ 真实Chrome浏览器特征                             │
│    ✓ 家用真实IP                                       │
│    ✓ 有效的 cf_clearance Cookie                      │
│    ✓ 正常的浏览器指纹                                  │
│    → 直接放行，无任何验证弹窗                          │
└──────────────────────────┬───────────────────────────┘
                            │  等待30秒（Cookie刷新）
                            ▼
            DELETE http://localhost:9222/json/close/{tabId}
                            │
                            ▼
                    保活完成，关闭标签页
```

### 一次性配置：修改Chrome快捷方式

```
右键Chrome快捷方式 → 属性 → 目标(Target)，末尾追加：

  --remote-debugging-port=9222

完整示例：
  "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

配置后每次打开Chrome，`http://localhost:9222` 就会暴露CDP接口，Rust后端可静默接入，**无需用户任何操作**。

---

## 数据结构

### Store（`store.json`）

```ts
interface Store {
  // 基础配置
  cron: string           // Cron表达式，默认 "0 9 * * *"（每天09:00）
  autoLaunch: boolean    // 开机自启

  // 站点列表
  sites: Array<{
    id: string           // 唯一ID
    name: string         // 显示名称
    url: string          // 目标URL
  }>

  // CDP配置
  mode: 'cdp' | 'webview'     // 访问模式（默认 cdp）
  cdpPort: number              // CDP端口（默认 9222）
  chromePath?: string          // Chrome路径（空则自动检测）
  visitDuration: number        // 每站停留秒数（默认 30）
  randomDelay: boolean         // 随机延迟 ±30分钟（默认 true）
}
```

---

## Tauri Commands（前后端接口）

| Command | 参数 | 返回 | 说明 |
|---|---|---|---|
| `get_store` | — | `Store` | 读取完整配置 |
| `save_store` | `Store` | — | 保存配置（自动重启定时器） |
| `get_logs` | — | `string[]` | 获取日志列表 |
| `run_task` | — | — | 立即执行保活 |
| `check_chrome_cdp` | — | `boolean` | 检测CDP是否可用 |

---

## 重构迁移对照表

| 功能 | 旧版（Electron） | 新版（Tauri） |
|---|---|---|
| **保活执行** | Electron BrowserWindow（无Cookie，CF必封）| Rust reqwest → CDP REST（复用Chrome登录态）|
| **定时调度** | node-cron（JS）| tokio-cron-scheduler（Rust）|
| **配置存储** | fs.writeFileSync（JSON）| tauri-plugin-store |
| **系统托盘** | Electron Tray API | Tauri v2 TrayIconBuilder |
| **开机自启** | app.setLoginItemSettings | tauri-plugin-autostart |
| **日志写入** | fs.appendFileSync | Rust log + 自定义 appender |
| **IPC** | ipcMain/ipcRenderer | tauri::command + invoke() |
| **UI框架** | Vue 3 + Element Plus | React 18 + shadcn/ui |
| **打包** | electron-builder（~150MB）| Tauri（~8MB）|

---

## 搭建步骤

### 1. 创建Tauri + React项目

```bash
# 用Tauri官方CLI初始化（选择React + TypeScript模板）
npm create tauri-app@latest pt-manager -- --template react-ts
cd pt-manager
npm install
```

### 2. 安装shadcn/ui

```bash
# 安装Tailwind
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# 初始化shadcn/ui
npx shadcn@latest init

# 按需添加组件
npx shadcn@latest add button card input label switch badge toast table
```

### 3. 安装前端依赖

```bash
npm install zustand react-router-dom
npm install @tauri-apps/api @tauri-apps/plugin-store
```

### 4. 配置Rust依赖

```toml
# src-tauri/Cargo.toml
[dependencies]
tauri = { version = "2", features = ["tray-icon", "image-png"] }
tauri-plugin-store = "2"
tauri-plugin-autostart = "2"
tauri-plugin-shell = "2"
tokio = { version = "1", features = ["full"] }
tokio-cron-scheduler = "0.13"
reqwest = { version = "0.12", features = ["json"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
chrono = "0.4"
rand = "0.8"
anyhow = "1"
urlencoding = "2"
```

### 5. 声明Tauri权限

```json
// src-tauri/capabilities/default.json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "store:allow-get",
    "store:allow-set",
    "store:allow-save",
    "autostart:allow-enable",
    "autostart:allow-disable",
    "shell:allow-open"
  ]
}
```

### 6. 开发运行

```bash
npm run tauri dev
```

### 7. 打包发布

```bash
npm run tauri build
# 输出位于 src-tauri/target/release/bundle/
```

---

## 使用流程

```
一次性配置（约2分钟）
─────────────────────
1. 下载安装 PT Manager（~8MB）
2. 修改Chrome快捷方式 → 在目标末尾加 --remote-debugging-port=9222
3. 重启Chrome
4. 打开PT Manager → 主界面显示"Chrome CDP: 已连接 ✓"
5. 添加PT站点URL
6. 配置Cron表达式（如每天09:00）
7. 开启开机自启
8. 关闭窗口（最小化到托盘）

日常使用（零操作）
─────────────────
定时自动触发
  → Rust CDP客户端调用 PUT /json/new?{url}
  → Chrome悄悄打开新标签页
  → CF认到已有cf_clearance → 直接放行
  → 停留30秒后 DELETE /json/close/{tabId}
  → Cookie刷新完成，标签页自动关闭
  → 用户无感知，全程无操作
```

---

## FAQ

**Q: 修改Chrome快捷方式安全吗？**
A: 完全安全。`--remote-debugging-port` 只在本机`localhost`暴露，外部网络无法访问。它是Chrome官方提供的调试功能，DevTools也用这个机制。

**Q: CF的Turnstile验证还会出现吗？**
A: 不会。Turnstile只在`cf_clearance` Cookie缺失或过期时触发。CDP接管直接复用你Chrome里已有的Cookie，CF视为正常用户访问。如果你超过24小时没有手动访问过某PT站，可能需要手动过一次验证，之后恢复自动。

**Q: 为什么选用CDP REST而非WebSocket？**
A: 对于`打开标签页`和`关闭标签页`这两个操作，Chrome CDP暴露了直接的REST接口（`PUT /json/new`、`DELETE /json/close`），比WebSocket方案更简单，完全用`reqwest`实现，不需要额外的CDP库。

**Q: 包体积为什么这么小？**
A: Tauri不像Electron那样在包内捆绑Chromium引擎（~100MB），而是使用系统自带WebView（Windows用Edge WebView2，macOS用WebKit），应用本身只有约8MB。

**Q: 为什么选shadcn/ui而不是Ant Design？**
A: 对于PT Manager这个场景：①shadcn/ui包体更小；②与Tailwind完美配合，对原生WebView渲染友好；③组件代码归项目所有，不受库版本升级影响；④视觉风格更现代，可完全自定义。

**Q: 配置文件在哪里？**
A: Windows: `%APPDATA%\pt-manager\store.json`，日志: `%APPDATA%\pt-manager\app.log`。
