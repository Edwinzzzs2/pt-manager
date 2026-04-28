use reqwest::Client;
use serde::Deserialize;
use std::time::Duration;

#[derive(Deserialize, Debug)]
pub struct CdpTab {
    pub id: String,
    #[serde(rename = "type")]
    pub tab_type: Option<String>,
    pub url: Option<String>,
}

pub struct CdpClient {
    client: Client,
    base_url: String,
}

impl CdpClient {
    pub fn new(port: u16) -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(10))
                .build()
                .unwrap_or_default(),
            base_url: format!("http://localhost:{}", port),
        }
    }

    /// 检测 Chrome 是否以调试模式运行
    pub async fn is_available(&self) -> bool {
        self.client
            .get(format!("{}/json/version", self.base_url))
            .timeout(Duration::from_secs(3))
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false)
    }

    /// 在 Chrome 中打开新标签页，返回 tab ID
    pub async fn open_tab(&self, url: &str) -> anyhow::Result<String> {
        let encoded = urlencoding::encode(url);
        let res = self
            .client
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
            .get(format!("{}/json/close/{}", self.base_url, tab_id))
            .send()
            .await?;
        Ok(())
    }
}
