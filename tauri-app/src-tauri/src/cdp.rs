use serde::Deserialize;
use std::env;
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

#[derive(Deserialize, Debug)]
pub struct CdpTab {
    pub id: String,
    pub url: Option<String>,
    #[serde(rename = "type")]
    pub tab_type: Option<String>,
}

struct HttpResponse {
    status: u16,
    body: String,
}

pub struct CdpClient {
    port: u16,
}

pub struct CdpLaunchResult {
    pub port: u16,
    pub message: String,
    pub opened_initial_urls: usize,
}

impl CdpClient {
    pub fn new(port: u16) -> Self {
        Self { port }
    }

    /// 返回当前可用的 CDP 端口；自动模式会从 Chrome 写出的 DevToolsActivePort 中读取真实端口。
    pub async fn available_port(&self) -> Option<u16> {
        if self.is_available().await {
            return Some(self.port);
        }

        for profile_dir in [dedicated_profile_dir(), recovery_profile_dir()] {
            let Some(port) = read_devtools_port(&profile_dir) else {
                continue;
            };
            if CdpClient::new(port).is_available().await {
                return Some(port);
            }
        }

        None
    }

    /// 检测 Chrome 是否以调试模式运行。
    pub async fn is_available(&self) -> bool {
        self.request("GET", "/json/version", Duration::from_secs(3))
            .map(|response| (200..300).contains(&response.status))
            .unwrap_or(false)
    }

    /// 确保 Chrome 已开放 CDP 端口；自动启动时让 Chrome 选择空闲端口，避免卡死在 9222。
    pub async fn ensure_available(
        &self,
        initial_urls: &[String],
    ) -> Result<CdpLaunchResult, String> {
        if self.is_available().await {
            let opened_initial_urls = self.ensure_initial_urls(initial_urls).await?;
            return Ok(CdpLaunchResult {
                port: self.port,
                message: connected_message("Chrome CDP 已连接", self.port, opened_initial_urls),
                opened_initial_urls,
            });
        }

        let profile_dir = dedicated_profile_dir();
        if let Some(port) = read_devtools_port(&profile_dir) {
            let cdp = CdpClient::new(port);
            if cdp.is_available().await {
                let opened_initial_urls = cdp.ensure_initial_urls(initial_urls).await?;
                return Ok(CdpLaunchResult {
                    port,
                    message: connected_message(
                        "已连接到专用调试 Chrome",
                        port,
                        opened_initial_urls,
                    ),
                    opened_initial_urls,
                });
            }
        }

        if let Some(result) = launch_and_wait(&profile_dir, false, initial_urls).await? {
            return Ok(result);
        }

        let recovery_dir = recovery_profile_dir();
        if let Some(result) = launch_and_wait(&recovery_dir, true, initial_urls).await? {
            return Ok(result);
        }

        Err(format!(
            "已尝试自动启动 Chrome，但 CDP 仍未连接。请关闭刚打开的专用 Chrome 后重试，或在设置里更换 CDP 端口。原端口：{}",
            self.port
        ))
    }

    /// 在 Chrome 中打开新标签页，返回 tab ID。
    pub async fn open_tab(&self, url: &str) -> Result<String, String> {
        let encoded = encode_cdp_target_url(url);
        let response = self.request(
            "PUT",
            &format!("/json/new?{}", encoded),
            Duration::from_secs(10),
        )?;
        if !(200..300).contains(&response.status) {
            return Err(format!("CDP 返回 HTTP {}", response.status));
        }

        let tab = serde_json::from_str::<CdpTab>(&response.body).map_err(|err| err.to_string())?;
        Ok(tab.id)
    }

    /// 查找已经打开到相同站点的标签页，避免启动 Chrome 后再重复打开同一个站点。
    pub async fn find_tab_for_url(&self, url: &str) -> Option<String> {
        let response = self
            .request("GET", "/json/list", Duration::from_secs(5))
            .ok()?;
        if !(200..300).contains(&response.status) {
            return None;
        }

        let tabs = serde_json::from_str::<Vec<CdpTab>>(&response.body).ok()?;
        let expected_host = host_from_url(url)?;
        tabs.into_iter()
            .filter(|tab| tab.tab_type.as_deref() == Some("page"))
            .find(|tab| {
                tab.url
                    .as_deref()
                    .and_then(host_from_url)
                    .map(|host| host == expected_host)
                    .unwrap_or(false)
            })
            .map(|tab| tab.id)
    }

    async fn ensure_initial_urls(&self, initial_urls: &[String]) -> Result<usize, String> {
        let mut opened_count = 0;

        for url in initial_urls
            .iter()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
        {
            if self.find_tab_for_url(url).await.is_some() {
                opened_count += 1;
                continue;
            }

            self.open_tab(url)
                .await
                .map_err(|err| format!("CDP 已连接，但打开站点 {} 失败：{}", url, err))?;
            opened_count += 1;
        }

        Ok(opened_count)
    }

    /// 关闭指定标签页。
    pub async fn close_tab(&self, tab_id: &str) -> Result<(), String> {
        let response = self.request(
            "GET",
            &format!("/json/close/{}", tab_id),
            Duration::from_secs(10),
        )?;
        if (200..300).contains(&response.status) {
            Ok(())
        } else {
            Err(format!("CDP 返回 HTTP {}", response.status))
        }
    }

    fn request(&self, method: &str, path: &str, timeout: Duration) -> Result<HttpResponse, String> {
        let addr = ("127.0.0.1", self.port)
            .to_socket_addrs()
            .map_err(|err| err.to_string())?
            .next()
            .ok_or_else(|| "无法解析 localhost 地址".to_string())?;
        let mut stream =
            TcpStream::connect_timeout(&addr, timeout).map_err(|err| err.to_string())?;
        stream
            .set_read_timeout(Some(timeout))
            .map_err(|err| err.to_string())?;
        stream
            .set_write_timeout(Some(timeout))
            .map_err(|err| err.to_string())?;

        let request = format!(
            "{} {} HTTP/1.1\r\nHost: localhost:{}\r\nConnection: close\r\n\r\n",
            method, path, self.port
        );
        stream
            .write_all(request.as_bytes())
            .map_err(|err| err.to_string())?;

        let mut raw = String::new();
        stream
            .read_to_string(&mut raw)
            .map_err(|err| err.to_string())?;
        parse_http_response(&raw)
    }
}

fn parse_http_response(raw: &str) -> Result<HttpResponse, String> {
    let mut parts = raw.splitn(2, "\r\n\r\n");
    let headers = parts.next().unwrap_or_default();
    let body = parts.next().unwrap_or_default().to_string();
    let status = headers
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|code| code.parse::<u16>().ok())
        .ok_or_else(|| "无法解析 CDP HTTP 响应".to_string())?;

    Ok(HttpResponse { status, body })
}

fn encode_cdp_target_url(value: &str) -> String {
    let mut encoded = String::new();

    // /json/new 把整个 query 当作目标 URL，不能把 : / ? & 这些 URL 分隔符全部转义。
    for byte in value.trim().as_bytes() {
        match byte {
            b'\t' | b'\n' | b'\r' | b' ' | b'"' | b'<' | b'>' | b'`' => {
                encoded.push_str(&format!("%{:02X}", byte));
            }
            0x00..=0x1F | 0x7F..=0xFF => encoded.push_str(&format!("%{:02X}", byte)),
            _ => encoded.push(*byte as char),
        }
    }

    encoded
}

fn unique_urls(urls: &[String]) -> Vec<String> {
    let mut result = Vec::new();

    for url in urls
        .iter()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        if result.iter().any(|existing| existing == url) {
            continue;
        }
        result.push(url.to_string());
    }

    result
}

fn launch_urls(urls: &[String]) -> Vec<String> {
    let urls = unique_urls(urls);
    if urls.is_empty() {
        vec!["about:blank".to_string()]
    } else {
        urls
    }
}

async fn launch_and_wait(
    profile_dir: &Path,
    recovery: bool,
    initial_urls: &[String],
) -> Result<Option<CdpLaunchResult>, String> {
    let launch_urls = launch_urls(initial_urls);
    let _ = fs::remove_file(devtools_port_path(profile_dir));
    launch_chrome(profile_dir, &launch_urls)?;

    for _ in 0..30 {
        tokio::time::sleep(Duration::from_millis(500)).await;
        let Some(port) = read_devtools_port(profile_dir) else {
            continue;
        };

        let cdp = CdpClient::new(port);
        if cdp.is_available().await {
            let opened_initial_urls = cdp.ensure_initial_urls(initial_urls).await?;
            let prefix = if recovery {
                "已启动备用专用调试 Chrome"
            } else {
                "已启动专用调试 Chrome"
            };
            let message = connected_message(prefix, port, opened_initial_urls);
            return Ok(Some(CdpLaunchResult {
                port,
                message,
                opened_initial_urls,
            }));
        }
    }

    Ok(None)
}

fn launch_chrome(profile_dir: &Path, urls: &[String]) -> Result<(), String> {
    let chrome_path = find_chrome_executable()
        .ok_or_else(|| "未找到 Chrome，请确认已安装 Google Chrome".to_string())?;

    let mut command = Command::new(chrome_path);
    fs::create_dir_all(profile_dir)
        .map_err(|err| format!("创建 Chrome 专用 Profile 失败：{}", err))?;

    command
        .arg("--remote-debugging-port=0")
        .arg("--remote-debugging-address=127.0.0.1")
        .arg(format!("--user-data-dir={}", profile_dir.display()))
        .arg("--no-first-run")
        .arg("--no-default-browser-check")
        .arg("--new-window");

    for url in urls {
        command.arg(url);
    }

    command
        .spawn()
        .map(|_| ())
        .map_err(|err| format!("自动启动 Chrome 失败：{}", err))
}

fn dedicated_profile_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Some(root) = env::var_os("LOCALAPPDATA") {
            return PathBuf::from(root).join("pt-manager\\chrome-cdp-profile-auto");
        }
    }

    env::temp_dir().join("pt-manager-chrome-cdp-profile-auto")
}

fn recovery_profile_dir() -> PathBuf {
    env::temp_dir().join(format!(
        "pt-manager-chrome-cdp-recovery-{}",
        std::process::id()
    ))
}

fn devtools_port_path(profile_dir: &Path) -> PathBuf {
    profile_dir.join("DevToolsActivePort")
}

fn read_devtools_port(profile_dir: &Path) -> Option<u16> {
    let data = fs::read_to_string(devtools_port_path(profile_dir)).ok()?;
    data.lines().next()?.trim().parse::<u16>().ok()
}

fn connected_message(prefix: &str, port: u16, opened_initial_urls: usize) -> String {
    match opened_initial_urls {
        0 => format!("{}：localhost:{}", prefix, port),
        1 => format!(
            "{}：localhost:{}，已打开 1 个站点。首次使用请在该窗口登录站点。",
            prefix, port
        ),
        count => format!(
            "{}：localhost:{}，已打开 {} 个站点。首次使用请在该窗口登录站点。",
            prefix, port, count
        ),
    }
}

fn host_from_url(url: &str) -> Option<String> {
    let without_scheme = url
        .trim()
        .strip_prefix("https://")
        .or_else(|| url.trim().strip_prefix("http://"))?;
    let host = without_scheme
        .split(['/', ':', '?', '#'])
        .next()?
        .trim()
        .to_ascii_lowercase();
    if host.is_empty() {
        None
    } else {
        Some(host)
    }
}

fn find_chrome_executable() -> Option<PathBuf> {
    chrome_candidates().into_iter().find_map(|path| {
        if path.exists() {
            return Some(path);
        }
        find_in_path(&path)
    })
}

fn chrome_candidates() -> Vec<PathBuf> {
    let mut paths = Vec::new();

    if let Ok(value) = env::var("CHROME") {
        paths.push(PathBuf::from(value));
    }

    #[cfg(target_os = "windows")]
    {
        for key in ["LOCALAPPDATA", "PROGRAMFILES", "PROGRAMFILES(X86)"] {
            if let Ok(root) = env::var(key) {
                paths.push(PathBuf::from(root).join("Google\\Chrome\\Application\\chrome.exe"));
            }
        }
        paths.push(PathBuf::from("chrome.exe"));
    }

    #[cfg(target_os = "macos")]
    {
        paths.push(PathBuf::from(
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        ));
    }

    #[cfg(target_os = "linux")]
    {
        paths.push(PathBuf::from("google-chrome"));
        paths.push(PathBuf::from("google-chrome-stable"));
        paths.push(PathBuf::from("chromium"));
        paths.push(PathBuf::from("chromium-browser"));
    }

    paths
}

fn find_in_path(command: &PathBuf) -> Option<PathBuf> {
    let file_name = command.file_name()?;
    let path_var = env::var_os("PATH")?;
    env::split_paths(&path_var)
        .map(|dir| dir.join(file_name))
        .find(|path| path.exists())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cdp_target_url_keeps_url_separators() {
        let url = "https://example.com/a/b?x=1&next=https://pt.test/#top";

        assert_eq!(encode_cdp_target_url(url), url);
    }

    #[test]
    fn cdp_target_url_escapes_spaces_without_double_encoding_url_syntax() {
        assert_eq!(
            encode_cdp_target_url(" https://example.com/a path?q=hello world "),
            "https://example.com/a%20path?q=hello%20world"
        );
    }

    #[test]
    fn launch_urls_uses_all_unique_configured_sites() {
        let urls = vec![
            "https://one.test".to_string(),
            " https://two.test ".to_string(),
            "https://one.test".to_string(),
        ];

        assert_eq!(
            launch_urls(&urls),
            vec!["https://one.test", "https://two.test"]
        );
    }
}
