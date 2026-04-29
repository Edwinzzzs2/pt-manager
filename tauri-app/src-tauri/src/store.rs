use chrono::{DateTime, Local};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Site {
    pub id: String,
    pub name: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub sites: Vec<Site>,
    pub cron: String,
    pub cdp_port: u16,
    pub visit_duration: u64,
    pub random_delay: bool,
    pub auto_launch: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            sites: vec![],
            cron: "0 9 * * *".to_string(),
            cdp_port: 9222,
            visit_duration: 30,
            random_delay: true,
            auto_launch: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: DateTime<Local>,
    pub level: String,
    pub message: String,
}

impl LogEntry {
    pub fn info(msg: impl Into<String>) -> Self {
        Self {
            timestamp: Local::now(),
            level: "INFO".to_string(),
            message: msg.into(),
        }
    }

    pub fn error(msg: impl Into<String>) -> Self {
        Self {
            timestamp: Local::now(),
            level: "ERROR".to_string(),
            message: msg.into(),
        }
    }

    pub fn success(msg: impl Into<String>) -> Self {
        Self {
            timestamp: Local::now(),
            level: "SUCCESS".to_string(),
            message: msg.into(),
        }
    }
}

/// 获取配置文件路径
fn config_path(app_handle: &tauri::AppHandle) -> PathBuf {
    let dir = app_handle
        .path()
        .app_data_dir()
        .expect("failed to get app data dir");
    fs::create_dir_all(&dir).ok();
    dir.join("config.json")
}

/// 从磁盘加载配置
pub fn load_config(app_handle: &tauri::AppHandle) -> AppConfig {
    let path = config_path(app_handle);
    if path.exists() {
        let data = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        let config = AppConfig::default();
        save_config(app_handle, &config);
        config
    }
}

/// 保存配置到磁盘
pub fn save_config(app_handle: &tauri::AppHandle, config: &AppConfig) {
    let path = config_path(app_handle);
    if let Ok(data) = serde_json::to_string_pretty(config) {
        fs::write(&path, data).ok();
    }
}
