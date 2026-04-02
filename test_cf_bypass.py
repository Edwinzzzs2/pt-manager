"""
测试：通过 sqlite3 读取本地 Chrome Cookies 并注入 Playwright 来绕过 CF
目标站：https://audiences.me/rules.php
策略：Chrome 运行中 Profile 被锁 → 复制 Cookies DB → 注入新 context
"""
import asyncio
import os
import shutil
import sqlite3
import json
import tempfile
from playwright.async_api import async_playwright

# Windows 下 Chrome 默认用户数据目录
CHROME_USER_DATA = r"C:\Users\zongx\AppData\Local\Google\Chrome\User Data"
CHROME_COOKIES_PATH = r"C:\Users\zongx\AppData\Local\Google\Chrome\User Data\Default\Network\Cookies"
TARGET_URL = "https://audiences.me/rules.php"


def read_chrome_cookies_raw(domain_filter="audiences.me"):
    """复制 Chrome Cookies DB（绕过文件锁）并读取指定域名的 Cookie"""
    # 复制到临时文件（避免 Chrome 占用的文件锁）
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    shutil.copy2(CHROME_COOKIES_PATH, tmp.name)

    conn = sqlite3.connect(tmp.name)
    cursor = conn.cursor()
    # Chrome Cookies 表结构: host_key, name, value, path, expires_utc, is_secure, etc.
    cursor.execute(
        "SELECT host_key, name, value, path, expires_utc, is_secure, is_httponly "
        "FROM cookies WHERE host_key LIKE ?",
        (f"%{domain_filter}%",)
    )
    rows = cursor.fetchall()
    conn.close()
    os.unlink(tmp.name)

    cookies = []
    for host_key, name, value, path, expires_utc, is_secure, is_httponly in rows:
        # Chrome 时间戳是从 1601-01-01 的微秒数，转为 Unix 时间戳（秒）
        expires_unix = (expires_utc / 1_000_000) - 11644473600 if expires_utc > 0 else -1
        cookies.append({
            "name": name,
            "value": value,
            "domain": host_key.lstrip("."),
            "path": path,
            "expires": expires_unix,
            "secure": bool(is_secure),
            "httpOnly": bool(is_httponly),
            "sameSite": "Lax",
        })
    return cookies

async def test_cf_bypass():
    print(f"[*] 目标URL: {TARGET_URL}")

    # 1. 从 Chrome 读取 audiences.me 的 Cookies
    print("[*] 从本地 Chrome 读取 audiences.me Cookies...")
    try:
        chrome_cookies = read_chrome_cookies_raw("audiences.me")
        print(f"[+] 读取到 {len(chrome_cookies)} 个 Cookie")
        for c in chrome_cookies:
            print(f"    {c['name']:30s} = {c['value'][:50]}")
    except Exception as e:
        print(f"[!] 读取 Cookie 失败: {e}")
        chrome_cookies = []

    async with async_playwright() as p:
        # 2. 启动一个新的 Chromium（不用本地Profile，避免锁冲突）
        # 注入从Chrome读取的Cookies，模拟已登录状态
        print("\n[*] 启动 Chromium 浏览器（headful模式）...")
        browser = await p.chromium.launch(
            headless=False,
            channel="chrome",   # 用正式Chrome
            args=[
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-blink-features=AutomationControlled",  # 隐藏自动化标志
            ],
        )

        ctx = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/134.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 800},
            locale="zh-CN",
        )

        # 3. 注入 Cookies
        if chrome_cookies:
            await ctx.add_cookies(chrome_cookies)
            print(f"[+] 已注入 {len(chrome_cookies)} 个 Cookie")

        page = await ctx.new_page()

        # 4. 隐藏 navigator.webdriver
        await page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        """)

        print(f"\n[*] 正在访问 {TARGET_URL} ...")
        await page.goto(TARGET_URL, wait_until="domcontentloaded", timeout=30000)

        print("[*] 等待页面响应（10秒）...")
        await page.wait_for_timeout(8000)

        title = await page.title()
        url_now = page.url
        print(f"[+] 当前标题: {title}")
        print(f"[+] 当前URL:  {url_now}")

        # 检查结果
        content = await page.content()
        if "请稍候" in content or "cf-challenge" in content.lower() or "Checking" in content:
            print("\n[!] 结果: ❌ 仍在 CF 挑战页，Cookie注入未能绕过")
        elif "login" in url_now.lower() and "returnto" in url_now.lower():
            print("\n[!] 结果: ⚠️  跳转到登录页（Session Cookie可能已过期）")
        else:
            print("\n[✓] 结果: ✅ 成功绕过 CF！已进入正常页面！")
            text = await page.inner_text("body")
            print(f"[+] 页面内容预览:\n{text[:800]}")

        print("\n[*] 10秒后关闭浏览器...")
        await page.wait_for_timeout(10000)
        await ctx.close()
        await browser.close()

asyncio.run(test_cf_bypass())
