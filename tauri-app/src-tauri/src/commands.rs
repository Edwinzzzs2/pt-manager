use crate::cdp::CdpClient;
use crate::scheduler;
use crate::store::{self, AppConfig, LogEntry};
use chrono::{DateTime, Local};
use serde::Serialize;
use std::sync::Arc;
use tauri::State;
use tauri_plugin_autostart::ManagerExt;
use tokio::sync::Mutex;

/// 应用全局状态
pub struct AppState {
    pub config: Arc<Mutex<AppConfig>>,
    pub logs: Arc<Mutex<Vec<LogEntry>>>,
    pub scheduler: Arc<Mutex<scheduler::Scheduler>>,
    pub task_running: Arc<Mutex<bool>>,
    pub app_handle: tauri::AppHandle,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppStatus {
    pub cdp_connected: bool,
    pub active_cdp_port: Option<u16>,
    pub next_run: Option<DateTime<Local>>,
    pub last_result: Option<LogEntry>,
    pub is_running: bool,
}

#[tauri::command]
pub async fn get_config(state: State<'_, AppState>) -> Result<AppConfig, String> {
    let config = state.config.lock().await;
    Ok(config.clone())
}

#[tauri::command]
pub async fn save_config(state: State<'_, AppState>, config: AppConfig) -> Result<(), String> {
    {
        let mut current = state.config.lock().await;
        *current = config.clone();
    }
    apply_auto_launch(&state.app_handle, config.auto_launch)?;
    store::save_config(&state.app_handle, &config);
    restart_scheduler(&state, config).await;
    Ok(())
}

#[tauri::command]
pub async fn add_site(
    state: State<'_, AppState>,
    name: String,
    url: String,
) -> Result<AppConfig, String> {
    let mut config = state.config.lock().await;
    let site = store::Site {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        url,
    };
    config.sites.push(site);
    store::save_config(&state.app_handle, &config);
    let next = config.clone();
    drop(config);
    restart_scheduler(&state, next.clone()).await;
    Ok(next)
}

#[tauri::command]
pub async fn remove_site(state: State<'_, AppState>, id: String) -> Result<AppConfig, String> {
    let mut config = state.config.lock().await;
    config.sites.retain(|s| s.id != id);
    store::save_config(&state.app_handle, &config);
    let next = config.clone();
    drop(config);
    restart_scheduler(&state, next.clone()).await;
    Ok(next)
}

#[tauri::command]
pub async fn update_site(
    state: State<'_, AppState>,
    id: String,
    name: String,
    url: String,
) -> Result<AppConfig, String> {
    let mut config = state.config.lock().await;
    if let Some(site) = config.sites.iter_mut().find(|s| s.id == id) {
        site.name = name;
        site.url = url;
    }
    store::save_config(&state.app_handle, &config);
    let next = config.clone();
    drop(config);
    restart_scheduler(&state, next.clone()).await;
    Ok(next)
}

#[tauri::command]
pub async fn check_cdp(state: State<'_, AppState>) -> Result<bool, String> {
    let cdp_port = state.config.lock().await.cdp_port;
    let cdp = CdpClient::new(cdp_port);
    Ok(cdp.available_port().await.is_some())
}

#[tauri::command]
pub async fn ensure_cdp(state: State<'_, AppState>) -> Result<bool, String> {
    let (cdp_port, initial_urls) = {
        let config = state.config.lock().await;
        let urls = config
            .sites
            .iter()
            .map(|site| site.url.clone())
            .collect::<Vec<_>>();
        (config.cdp_port, urls)
    };
    let cdp = CdpClient::new(cdp_port);
    let result = cdp.ensure_available(&initial_urls).await?;
    state.logs.lock().await.push(LogEntry::info(result.message));
    Ok(true)
}

#[tauri::command]
pub async fn get_status(state: State<'_, AppState>) -> Result<AppStatus, String> {
    let config = state.config.lock().await.clone();
    let cdp = CdpClient::new(config.cdp_port);
    let active_cdp_port = cdp.available_port().await;
    let cdp_connected = active_cdp_port.is_some();
    let next_run = state.scheduler.lock().await.next_run().await;
    let is_running = *state.task_running.lock().await;
    let last_result = state.logs.lock().await.iter().last().cloned();

    Ok(AppStatus {
        cdp_connected,
        active_cdp_port,
        next_run,
        last_result,
        is_running,
    })
}

#[tauri::command]
pub async fn run_task(state: State<'_, AppState>) -> Result<(), String> {
    let config = { state.config.lock().await.clone() };
    let logs = Arc::clone(&state.logs);
    let task_running = Arc::clone(&state.task_running);
    tauri::async_runtime::spawn(async move {
        scheduler::run_with_flag(&config, &logs, &task_running, false).await;
    });
    Ok(())
}

#[tauri::command]
pub async fn get_logs(state: State<'_, AppState>) -> Result<Vec<LogEntry>, String> {
    let logs = state.logs.lock().await;
    Ok(logs.clone())
}

#[tauri::command]
pub async fn clear_logs(state: State<'_, AppState>) -> Result<(), String> {
    let mut logs = state.logs.lock().await;
    logs.clear();
    Ok(())
}

async fn restart_scheduler(state: &State<'_, AppState>, config: AppConfig) {
    state.scheduler.lock().await.start(
        config,
        Arc::clone(&state.logs),
        Arc::clone(&state.task_running),
    );
}

pub fn apply_auto_launch(app_handle: &tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let manager = app_handle.autolaunch();
    if enabled {
        manager.enable().map_err(|err| err.to_string())
    } else {
        manager.disable().map_err(|err| err.to_string())
    }
}
