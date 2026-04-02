"""
实时测试 B方案：CDP接管本地Chrome，直接复用已登录Session访问audiences.me
"""
import asyncio
import subprocess
import time
import sys
from playwright.async_api import async_playwright

CHROME_EXE = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
CDP_URL = "http://localhost:9222"
TARGET_URL = "https://audiences.me/rules.php"
CHROME_USER_DATA = r"C:\Users\zongx\AppData\Local\Google\Chrome\User Data"


async def main():
    async with async_playwright() as p:

        # ① 先尝试连接已有的Chrome调试端口
        print("[*] 尝试连接本地Chrome调试端口 (9222)...")
        browser = None
        try:
            browser = await p.chromium.connect_over_cdp(CDP_URL, timeout=3000)
            print("[+] 已连接到正在运行的Chrome！")
        except Exception:
            print("[!] 未检测到调试端口，正在启动带调试端口的Chrome...")
            subprocess.Popen([
                CHROME_EXE,
                "--remote-debugging-port=9222",
                f"--user-data-dir={CHROME_USER_DATA}",  # 复用已登录的Profile
                "--no-first-run",
                "--no-default-browser-check",
            ])
            print("[*] 等待Chrome启动 (4秒)...")
            await asyncio.sleep(4)
            browser = await p.chromium.connect_over_cdp(CDP_URL, timeout=8000)
            print("[+] Chrome已启动并连接！")

        # ② 获取已有的浏览器上下文（复用已登录的Session）
        contexts = browser.contexts
        if contexts:
            ctx = contexts[0]
            print(f"[+] 复用已有Context，当前已有 {len(ctx.pages)} 个Tab")
        else:
            ctx = await browser.new_context()
            print("[+] 创建新Context")

        # ③ 新开一个Tab访问目标站
        page = await ctx.new_page()
        print(f"\n[*] 正在访问 {TARGET_URL} ...")
        await page.goto(TARGET_URL, wait_until="domcontentloaded", timeout=20000)

        print("[*] 等待页面响应 (6秒)...")
        await asyncio.sleep(6)

        title = await page.title()
        url_now = page.url
        print(f"\n[+] 标题: {title}")
        print(f"[+] URL:  {url_now}")

        # ④ 判断结果
        content = await page.content()
        if "请稍候" in content or "cf-challenge" in content.lower():
            print("\n[!] ❌ 结果: 仍在CF挑战页")
        elif "login" in url_now.lower() and "returnto" in url_now.lower():
            print("\n[!] ⚠️  结果: 跳到登录页（需要重新登录一次）")
        else:
            print("\n[✓] ✅ 结果: 成功！直接进入页面，CF已绕过！")
            body_text = await page.inner_text("body")
            print(f"\n--- 页面内容预览 ---\n{body_text[:600]}\n---")

        # ⑤ 打印关键Cookie
        cookies = await ctx.cookies(urls=[TARGET_URL])
        cf_clearance = [c for c in cookies if c["name"] == "cf_clearance"]
        if cf_clearance:
            print(f"\n[+] cf_clearance Cookie 存在（有效期内CF不会再拦截）")
            print(f"    value: {cf_clearance[0]['value'][:60]}...")

        print("\n[*] 5秒后关闭这个Tab（不关闭Chrome）...")
        await asyncio.sleep(5)
        await page.close()  # 只关Tab，不关Chrome

        print("[✓] 完成！Chrome仍在运行，Cookie已刷新。")

asyncio.run(main())
