"""
策略：让用户手动把Chrome Cookies导出成JSON后，用Playwright注入
使用 EditThisCookie / Cookie-Editor 扩展导出的JSON格式

运行前：
  1. 在Chrome安装扩展 "Cookie-Editor" (https://chrome.google.com/webstore/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm)
  2. 访问 audiences.me，点击扩展图标 → Export → 复制JSON
  3. 保存到本目录的 audiences_cookies.json
然后运行此脚本

或者：直接通过Chrome DevTools导出
"""
import asyncio
import json
import os
from playwright.async_api import async_playwright

COOKIES_FILE = "audiences_cookies.json"  # 手动导出的Cookie JSON
TARGET_URL = "https://audiences.me/rules.php"

async def keep_alive_with_cookies():
    if not os.path.exists(COOKIES_FILE):
        print(f"[!] 请先导出Cookie: 需要文件 {COOKIES_FILE}")
        print("    方法: Chrome安装 'Cookie-Editor' 扩展 → 访问audiences.me → 导出JSON → 保存为 audiences_cookies.json")
        return

    with open(COOKIES_FILE, encoding="utf-8") as f:
        raw_cookies = json.load(f)

    print(f"[+] 读取到 {len(raw_cookies)} 个Cookie")

    # Cookie-Editor 导出格式转换为 Playwright 格式
    playwright_cookies = []
    for c in raw_cookies:
        cookie = {
            "name": c.get("name", ""),
            "value": c.get("value", ""),
            "domain": c.get("domain", "audiences.me"),
            "path": c.get("path", "/"),
            "secure": c.get("secure", False),
            "httpOnly": c.get("httpOnly", False),
            "sameSite": c.get("sameSite", "Lax"),
        }
        # 过期时间
        if "expirationDate" in c:
            cookie["expires"] = c["expirationDate"]
        playwright_cookies.append(cookie)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=False,
            channel="chrome",
            args=[
                "--no-first-run",
                "--disable-blink-features=AutomationControlled",
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

        # 注入Cookie
        await ctx.add_cookies(playwright_cookies)
        print(f"[+] 已注入 {len(playwright_cookies)} 个Cookie")

        page = await ctx.new_page()
        await page.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', { get: () => undefined });"
        )

        print(f"[*] 访问 {TARGET_URL} ...")
        await page.goto(TARGET_URL, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(5000)

        title = await page.title()
        url_now = page.url
        print(f"[+] 标题: {title}")
        print(f"[+] URL: {url_now}")

        content = await page.content()
        if "请稍候" in content or "cf-challenge" in content.lower():
            print("\n[!] ❌ CF 挑战未通过")
        elif "login" in url_now.lower():
            print("\n[!] ⚠️  跳到登录页，Session可能过期")
        else:
            print("\n[✓] ✅ 成功！已进入正常页面")
            text = await page.inner_text("body")
            print(text[:600])

        await page.wait_for_timeout(8000)
        await ctx.close()
        await browser.close()

asyncio.run(keep_alive_with_cookies())
