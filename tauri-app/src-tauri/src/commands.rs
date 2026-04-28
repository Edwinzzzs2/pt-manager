use crate::cdp::CdpClient;
use crate::scheduler;
use crate::store::{self, AppConfig, LogEntry};
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

/// 应用全局状态
pub struct AppState {
    pub config: Arc<Mutex<AppConfig>>,
    pub logs: Arc<Mutex<Vec<LogEntry>>>,
    pub app_handle: tauri::AppHandle,
}

#[tauri::command]
pub async fn get_config(state: State<'_, AppState>) -> Result<AppConfig, String> {
    let config = state.config.lock().await;
    Ok(config.clone())
}

#[tauri::command]
pub async fn save_config(
    state: State<'_, AppState>,
    config: AppConfig,
) -> Result<(), String> {
    {
        let mut current = state.config.lock().await;
        *current = config.clone();
    }
    store::save_config(&state.app_handle, &config);
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
    Ok(config.clone())
}

#[tauri::command]
pub async fn remove_site(
    state: State<'_, AppState>,
    id: String,
) -> Result<AppConfig, String> {
    let mut config = state.config.lock().await;
    config.sites.retain(|s| s.id != id);
    store::save_config(&state.app_handle, &config);
    Ok(config.clone())
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
    Ok(config.clone())
}

#[tauri::command]
pub async fn check_cdp(state: State<'_, AppState>) -> Result<bool, String> {
    let config = state.config.lock().await;
    let cdp = CdpClient::new(config.cdp_port);
    Ok(cdp.is_available().await)
}

#[tauri::command]
pub async fn run_task(state: State<'_, AppState>) -> Result<(), String> {
    let config = {
        state.config.lock().await.clone()
    };
    scheduler::run_keepalive(&config, &state.logs).await;
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
