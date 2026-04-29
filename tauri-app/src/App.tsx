import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Activity,
  CheckCircle2,
  Clock3,
  ListChecks,
  PauseCircle,
  Play,
  Plus,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  Trash2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import "./App.css";

type Site = {
  id: string;
  name: string;
  url: string;
};

type AppConfig = {
  sites: Site[];
  cron: string;
  cdp_port: number;
  visit_duration: number;
  random_delay: boolean;
  auto_launch: boolean;
};

type LogEntry = {
  timestamp: string;
  level: "INFO" | "SUCCESS" | "ERROR";
  message: string;
};

type AppStatus = {
  cdp_connected: boolean;
  active_cdp_port: number | null;
  next_run: string | null;
  last_result: LogEntry | null;
  is_running: boolean;
};

type TabKey = "dashboard" | "sites" | "settings" | "logs";

const defaultConfig: AppConfig = {
  sites: [],
  cron: "0 9 * * *",
  cdp_port: 9222,
  visit_duration: 30,
  random_delay: true,
  auto_launch: false,
};

const navItems: Array<{ key: TabKey; label: string; icon: LucideIcon }> = [
  { key: "dashboard", label: "总览", icon: Activity },
  { key: "sites", label: "站点", icon: ListChecks },
  { key: "settings", label: "设置", icon: Settings },
  { key: "logs", label: "日志", icon: Clock3 },
];

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [settingsDraft, setSettingsDraft] = useState<AppConfig>(defaultConfig);
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [newSite, setNewSite] = useState({ name: "", url: "" });
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [editingSite, setEditingSite] = useState({ name: "", url: "" });
  const [busy, setBusy] = useState(false);
  const [cdpBusy, setCdpBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastVisibleLog = useMemo(() => logs[logs.length - 1], [logs]);

  async function refreshConfig() {
    const next = await invoke<AppConfig>("get_config");
    setConfig(next);
    setSettingsDraft(next);
  }

  async function refreshStatus() {
    const next = await invoke<AppStatus>("get_status");
    setStatus(next);
  }

  async function refreshLogs() {
    const next = await invoke<LogEntry[]>("get_logs");
    setLogs(next);
  }

  useEffect(() => {
    refreshConfig().catch(showError);
    refreshStatus().catch(showError);
    refreshLogs().catch(showError);

    const timer = window.setInterval(() => {
      refreshStatus().catch(showError);
      refreshLogs().catch(showError);
    }, 4000);

    return () => window.clearInterval(timer);
  }, []);

  function showError(err: unknown) {
    setError(err instanceof Error ? err.message : String(err));
  }

  async function runNow() {
    setBusy(true);
    setError(null);
    try {
      await invoke("run_task");
      await refreshStatus();
      await refreshLogs();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function ensureCdp() {
    setCdpBusy(true);
    setError(null);
    try {
      await invoke("ensure_cdp");
      await refreshStatus();
      await refreshLogs();
    } catch (err) {
      showError(err);
    } finally {
      setCdpBusy(false);
    }
  }

  async function addSite() {
    const name = newSite.name.trim();
    const url = newSite.url.trim();
    if (!name || !url) {
      setError("站点名称和 URL 不能为空");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const next = await invoke<AppConfig>("add_site", { name, url });
      setConfig(next);
      setSettingsDraft(next);
      setNewSite({ name: "", url: "" });
      await refreshStatus();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(site: Site) {
    setEditingSiteId(site.id);
    setEditingSite({ name: site.name, url: site.url });
  }

  async function saveSite(id: string) {
    const name = editingSite.name.trim();
    const url = editingSite.url.trim();
    if (!name || !url) {
      setError("站点名称和 URL 不能为空");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const next = await invoke<AppConfig>("update_site", { id, name, url });
      setConfig(next);
      setSettingsDraft(next);
      setEditingSiteId(null);
      await refreshStatus();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function removeSite(id: string) {
    setBusy(true);
    setError(null);
    try {
      const next = await invoke<AppConfig>("remove_site", { id });
      setConfig(next);
      setSettingsDraft(next);
      await refreshStatus();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings() {
    const next: AppConfig = {
      ...settingsDraft,
      cdp_port: Number(settingsDraft.cdp_port) || 9222,
      visit_duration: Math.max(5, Number(settingsDraft.visit_duration) || 30),
      cron: settingsDraft.cron.trim() || defaultConfig.cron,
    };

    setBusy(true);
    setError(null);
    try {
      await invoke("save_config", { config: next });
      setConfig(next);
      setSettingsDraft(next);
      await refreshStatus();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function clearLogs() {
    setError(null);
    try {
      await invoke("clear_logs");
      setLogs([]);
    } catch (err) {
      showError(err);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <ShieldCheck size={24} />
          <div>
            <strong>PT Manager</strong>
            <span>CDP Keepalive</span>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                className={activeTab === item.key ? "nav-item active" : "nav-item"}
                onClick={() => setActiveTab(item.key)}
                type="button"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-status">
          <span className={status?.cdp_connected ? "dot ok" : "dot danger"} />
          <div>
            <strong>{status?.cdp_connected ? "Chrome 已连接" : "Chrome 未连接"}</strong>
            <span>localhost:{status?.active_cdp_port ?? config.cdp_port}</span>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">MVP 控制台</p>
            <h1>{pageTitle(activeTab)}</h1>
          </div>
          <button
            className="primary-action"
            disabled={busy || status?.is_running}
            onClick={runNow}
            type="button"
          >
            {busy || status?.is_running ? <RefreshCw size={18} /> : <Play size={18} />}
            <span>{busy || status?.is_running ? "执行中" : "立即保活"}</span>
          </button>
        </header>

        {error ? (
          <div className="error-banner">
            <XCircle size={18} />
            <span>{error}</span>
            <button onClick={() => setError(null)} type="button">
              关闭
            </button>
          </div>
        ) : null}

        {activeTab === "dashboard" ? (
          <Dashboard
            cdpBusy={cdpBusy}
            config={config}
            lastLog={lastVisibleLog}
            onEnsureCdp={ensureCdp}
            status={status}
            onRefresh={() => {
              refreshStatus().catch(showError);
              refreshLogs().catch(showError);
            }}
          />
        ) : null}

        {activeTab === "sites" ? (
          <SitesPanel
            busy={busy}
            config={config}
            editingSite={editingSite}
            editingSiteId={editingSiteId}
            newSite={newSite}
            onAdd={addSite}
            onCancelEdit={() => setEditingSiteId(null)}
            onEditChange={setEditingSite}
            onNewSiteChange={setNewSite}
            onRemove={removeSite}
            onSave={saveSite}
            onStartEdit={startEdit}
          />
        ) : null}

        {activeTab === "settings" ? (
          <SettingsPanel
            busy={busy}
            draft={settingsDraft}
            onChange={setSettingsDraft}
            onSave={saveSettings}
          />
        ) : null}

        {activeTab === "logs" ? (
          <LogsPanel logs={logs} onClear={clearLogs} onRefresh={refreshLogs} />
        ) : null}
      </section>
    </main>
  );
}

function Dashboard({
  cdpBusy,
  config,
  lastLog,
  onEnsureCdp,
  status,
  onRefresh,
}: {
  cdpBusy: boolean;
  config: AppConfig;
  lastLog?: LogEntry;
  onEnsureCdp: () => void;
  status: AppStatus | null;
  onRefresh: () => void;
}) {
  return (
    <div className="dashboard">
      <section className="metric-grid">
        <MetricCard
          icon={status?.cdp_connected ? CheckCircle2 : XCircle}
          label="CDP 状态"
          tone={status?.cdp_connected ? "ok" : "danger"}
          value={status?.cdp_connected ? "已连接" : "未连接"}
        />
        <MetricCard icon={ListChecks} label="站点数量" value={`${config.sites.length}`} />
        <MetricCard
          icon={Clock3}
          label="下一轮任务"
          value={formatDate(status?.next_run)}
        />
        <MetricCard
          icon={status?.is_running ? RefreshCw : PauseCircle}
          label="执行状态"
          tone={status?.is_running ? "warning" : "muted"}
          value={status?.is_running ? "运行中" : "待机"}
        />
      </section>

      <section className="dashboard-grid">
        <div className="panel setup-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Chrome</p>
              <h2>调试端口</h2>
            </div>
            <div className="row-actions">
              <button
                className="ghost"
                disabled={cdpBusy}
                onClick={onEnsureCdp}
                type="button"
              >
                {cdpBusy ? <RefreshCw size={16} /> : <Play size={16} />}
                <span>{cdpBusy ? "打开中" : "打开全部"}</span>
              </button>
              <button className="icon-button" onClick={onRefresh} title="刷新状态" type="button">
                <RefreshCw size={17} />
              </button>
            </div>
          </div>
          <code className="command-line">
            {status?.cdp_connected
              ? `CDP 已连接：localhost:${status.active_cdp_port ?? config.cdp_port}`
              : "自动模式会启动专用 Chrome，并打开全部已配置站点"}
          </code>
          <div className="setup-steps">
            <span>1. 自动模式使用专用 Chrome Profile，不再固定依赖 9222</span>
            <span>2. 打开全部会补齐当前站点列表，不只处理第一个站点</span>
            <span>3. 手动接管时，设置页里的 CDP 端口仍可用于连接已有 Chrome</span>
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">最近结果</p>
              <h2>{status?.last_result?.level ?? "暂无任务"}</h2>
            </div>
            <span className={status?.last_result ? levelClass(status.last_result.level) : "badge"}>
              {status?.last_result ? formatTime(status.last_result.timestamp) : "待执行"}
            </span>
          </div>
          <p className="result-text">
            {status?.last_result?.message ?? lastLog?.message ?? "添加站点并确认 CDP 连接后即可开始。"}
          </p>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  tone = "muted",
  value,
}: {
  icon: LucideIcon;
  label: string;
  tone?: "ok" | "danger" | "warning" | "muted";
  value: string;
}) {
  return (
    <div className={`metric-card ${tone}`}>
      <Icon size={22} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SitesPanel({
  busy,
  config,
  editingSite,
  editingSiteId,
  newSite,
  onAdd,
  onCancelEdit,
  onEditChange,
  onNewSiteChange,
  onRemove,
  onSave,
  onStartEdit,
}: {
  busy: boolean;
  config: AppConfig;
  editingSite: { name: string; url: string };
  editingSiteId: string | null;
  newSite: { name: string; url: string };
  onAdd: () => void;
  onCancelEdit: () => void;
  onEditChange: (site: { name: string; url: string }) => void;
  onNewSiteChange: (site: { name: string; url: string }) => void;
  onRemove: (id: string) => void;
  onSave: (id: string) => void;
  onStartEdit: (site: Site) => void;
}) {
  return (
    <div className="content-stack">
      <section className="panel site-form">
        <input
          onChange={(event) => onNewSiteChange({ ...newSite, name: event.target.value })}
          placeholder="站点名称"
          value={newSite.name}
        />
        <input
          onChange={(event) => onNewSiteChange({ ...newSite, url: event.target.value })}
          placeholder="https://example.com"
          value={newSite.url}
        />
        <button disabled={busy} onClick={onAdd} type="button">
          <Plus size={17} />
          <span>新增</span>
        </button>
      </section>

      <section className="site-list">
        {config.sites.length === 0 ? (
          <div className="empty-state">暂无站点</div>
        ) : (
          config.sites.map((site) => {
            const editing = editingSiteId === site.id;
            return (
              <article className="site-row" key={site.id}>
                {editing ? (
                  <>
                    <input
                      onChange={(event) =>
                        onEditChange({ ...editingSite, name: event.target.value })
                      }
                      value={editingSite.name}
                    />
                    <input
                      onChange={(event) =>
                        onEditChange({ ...editingSite, url: event.target.value })
                      }
                      value={editingSite.url}
                    />
                  </>
                ) : (
                  <div className="site-main">
                    <strong>{site.name}</strong>
                    <span>{site.url}</span>
                  </div>
                )}
                <div className="row-actions">
                  {editing ? (
                    <>
                      <button onClick={() => onSave(site.id)} type="button">
                        <Save size={16} />
                        <span>保存</span>
                      </button>
                      <button className="ghost" onClick={onCancelEdit} type="button">
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => onStartEdit(site)} type="button">
                        编辑
                      </button>
                      <button className="danger-button" onClick={() => onRemove(site.id)} type="button">
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}

function SettingsPanel({
  busy,
  draft,
  onChange,
  onSave,
}: {
  busy: boolean;
  draft: AppConfig;
  onChange: (config: AppConfig) => void;
  onSave: () => void;
}) {
  return (
    <section className="panel settings-grid">
      <label>
        <span>Cron 表达式</span>
        <input
          onChange={(event) => onChange({ ...draft, cron: event.target.value })}
          value={draft.cron}
        />
      </label>
      <label>
        <span>CDP 端口</span>
        <input
          min={1}
          onChange={(event) => onChange({ ...draft, cdp_port: Number(event.target.value) })}
          type="number"
          value={draft.cdp_port}
        />
      </label>
      <label>
        <span>页面停留秒数</span>
        <input
          min={5}
          onChange={(event) =>
            onChange({ ...draft, visit_duration: Number(event.target.value) })
          }
          type="number"
          value={draft.visit_duration}
        />
      </label>
      <label className="switch-row">
        <span>随机延迟</span>
        <input
          checked={draft.random_delay}
          onChange={(event) => onChange({ ...draft, random_delay: event.target.checked })}
          type="checkbox"
        />
      </label>
      <label className="switch-row">
        <span>开机自启</span>
        <input
          checked={draft.auto_launch}
          onChange={(event) => onChange({ ...draft, auto_launch: event.target.checked })}
          type="checkbox"
        />
      </label>
      <button className="primary-action settings-save" disabled={busy} onClick={onSave} type="button">
        <Save size={18} />
        <span>保存设置</span>
      </button>
    </section>
  );
}

function LogsPanel({
  logs,
  onClear,
  onRefresh,
}: {
  logs: LogEntry[];
  onClear: () => void;
  onRefresh: () => void;
}) {
  return (
    <section className="panel logs-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Runtime</p>
          <h2>运行日志</h2>
        </div>
        <div className="row-actions">
          <button className="ghost" onClick={onRefresh} type="button">
            <RefreshCw size={16} />
            <span>刷新</span>
          </button>
          <button className="ghost" onClick={onClear} type="button">
            清空
          </button>
        </div>
      </div>
      <div className="log-list">
        {logs.length === 0 ? (
          <div className="empty-state">暂无日志</div>
        ) : (
          logs
            .slice()
            .reverse()
            .map((entry, index) => (
              <div className="log-row" key={`${entry.timestamp}-${index}`}>
                <span className={levelClass(entry.level)}>{entry.level}</span>
                <time>{formatTime(entry.timestamp)}</time>
                <p>{entry.message}</p>
              </div>
            ))
        )}
      </div>
    </section>
  );
}

function pageTitle(tab: TabKey) {
  return {
    dashboard: "状态总览",
    sites: "站点管理",
    settings: "保活设置",
    logs: "运行日志",
  }[tab];
}

function formatDate(value?: string | null) {
  if (!value) return "未计划";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function levelClass(level: LogEntry["level"]) {
  return `badge ${level.toLowerCase()}`;
}

export default App;
