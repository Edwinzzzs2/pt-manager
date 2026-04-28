use crate::cdp::CdpClient;
use crate::store::{AppConfig, LogEntry};
use rand::Rng;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

pub struct Scheduler {
    handle: Option<JoinHandle<()>>,
}

impl Scheduler {
    pub fn new() -> Self {
        Self { handle: None }
    }

    /// 停止当前调度
    pub fn stop(&mut self) {
        if let Some(h) = self.handle.take() {
            h.abort();
        }
    }

    /// 启动定时保活调度（简单循环实现）
    pub fn start(
        &mut self,
        config: AppConfig,
        logs: Arc<Mutex<Vec<LogEntry>>>,
    ) {
        self.stop();

        let handle = tokio::spawn(async move {
            loop {
                // 计算下一次执行的等待时间（简易实现：每24小时执行一次）
                // TODO: 未来用 cron 库解析 cron 表达式
                let wait_secs: u64 = 24 * 60 * 60;
                tokio::time::sleep(tokio::time::Duration::from_secs(wait_secs)).await;

                run_keepalive_inner(&config, &logs).await;
            }
        });

        self.handle = Some(handle);
    }
}

/// 执行一轮保活任务
pub async fn run_keepalive(
    config: &AppConfig,
    logs: &Arc<Mutex<Vec<LogEntry>>>,
) {
    run_keepalive_inner(config, logs).await;
}

async fn run_keepalive_inner(
    config: &AppConfig,
    logs: &Arc<Mutex<Vec<LogEntry>>>,
) {
    let cdp = CdpClient::new(config.cdp_port);

    // 检查 CDP 连接
    if !cdp.is_available().await {
        let entry = LogEntry::error("Chrome CDP 未连接，请确认 Chrome 已以 --remote-debugging-port 启动");
        logs.lock().await.push(entry);
        return;
    }

    {
        let entry = LogEntry::info(format!("开始保活任务，共 {} 个站点", config.sites.len()));
        logs.lock().await.push(entry);
    }

    // 随机延迟
    if config.random_delay {
        let mut rng = rand::thread_rng();
        let delay_secs: u64 = rng.gen_range(0..300); // 0~5分钟随机延迟
        {
            let entry = LogEntry::info(format!("随机延迟 {} 秒", delay_secs));
            logs.lock().await.push(entry);
        }
        tokio::time::sleep(tokio::time::Duration::from_secs(delay_secs)).await;
    }

    for site in &config.sites {
        {
            let entry = LogEntry::info(format!("正在访问: {} ({})", site.name, site.url));
            logs.lock().await.push(entry);
        }

        match cdp.open_tab(&site.url).await {
            Ok(tab_id) => {
                // 等待页面加载 + 随机抖动
                let mut rng = rand::thread_rng();
                let jitter: u64 = rng.gen_range(0..10);
                let wait = config.visit_duration + jitter;
                tokio::time::sleep(tokio::time::Duration::from_secs(wait)).await;

                // 关闭标签页
                if let Err(e) = cdp.close_tab(&tab_id).await {
                    let entry = LogEntry::error(format!("关闭标签页失败: {}", e));
                    logs.lock().await.push(entry);
                }

                let entry = LogEntry::success(format!("✓ {} 保活完成", site.name));
                logs.lock().await.push(entry);
            }
            Err(e) => {
                let entry = LogEntry::error(format!("✗ {} 访问失败: {}", site.name, e));
                logs.lock().await.push(entry);
            }
        }

        // 站点间隔 5~15 秒
        let mut rng = rand::thread_rng();
        let interval: u64 = rng.gen_range(5..15);
        tokio::time::sleep(tokio::time::Duration::from_secs(interval)).await;
    }

    {
        let entry = LogEntry::success("保活任务全部完成".to_string());
        logs.lock().await.push(entry);
    }
}
