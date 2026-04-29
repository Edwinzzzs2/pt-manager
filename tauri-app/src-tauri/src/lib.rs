mod cdp;
mod commands;
mod scheduler;
mod store;

use chrono::{DateTime, Local};
use commands::AppState;
use std::sync::Arc;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;
use tauri::WindowEvent;
use tokio::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            // 加载配置
            let config = store::load_config(&app.handle());
            let _ = commands::apply_auto_launch(&app.handle(), config.auto_launch);
            let logs = Arc::new(Mutex::new(vec![]));
            let task_running = Arc::new(Mutex::new(false));
            let next_run: Arc<Mutex<Option<DateTime<Local>>>> = Arc::new(Mutex::new(None));
            let mut scheduler = scheduler::Scheduler::new(Arc::clone(&next_run));
            scheduler.start(config.clone(), Arc::clone(&logs), Arc::clone(&task_running));

            // 初始化全局状态
            let state = AppState {
                config: Arc::new(Mutex::new(config)),
                logs,
                scheduler: Arc::new(Mutex::new(scheduler)),
                task_running,
                app_handle: app.handle().clone(),
            };
            app.manage(state);

            // 设置系统托盘
            setup_tray(app)?;
            setup_window_close_behavior(app);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_config,
            commands::save_config,
            commands::add_site,
            commands::remove_site,
            commands::update_site,
            commands::check_cdp,
            commands::ensure_cdp,
            commands::get_status,
            commands::run_task,
            commands::get_logs,
            commands::clear_logs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItemBuilder::with_id("show", "打开主界面").build(app)?;
    let run = MenuItemBuilder::with_id("run", "立即执行保活").build(app)?;
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
            "run" => {
                let app = app.clone();
                tauri::async_runtime::spawn(async move {
                    let state = app.state::<AppState>();
                    let config = state.config.lock().await.clone();
                    scheduler::run_with_flag(&config, &state.logs, &state.task_running, false)
                        .await;
                });
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

fn setup_window_close_behavior(app: &tauri::App) {
    if let Some(window) = app.get_webview_window("main") {
        let window_to_hide = window.clone();
        window.on_window_event(move |event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window_to_hide.hide();
            }
        });
    }
}
