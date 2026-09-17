// 端到端自测：用 CDP 驱动无头 Chrome 走一遍真实用户流程。
// 覆盖：未登录重定向 → 图形验证码登录 → 原有三个可视化标签页未回归 →
//       管理台 12 个菜单逐页渲染与翻页 → 智能体弹框。
// 只起一个浏览器实例，跑完即退出（机器内存有限）。
//
// 用法：node scripts/e2e-browser.mjs [baseUrl]   默认 http://127.0.0.1:4028
// 前置：前端已启动（npm run dev / preview）、后端 8037 已启动且数据库有种子数据。
import { spawn } from 'node:child_process'
import { writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs'
import WebSocket from 'ws'

const BASE = process.argv[2] || 'http://127.0.0.1:4028'
// 默认 0 = 由 Chrome 自选空闲端口（见下方说明）；只有排查问题时才用 E2E_DEBUG_PORT 固定端口
const PORT = Number(process.env.E2E_DEBUG_PORT || 0)
const OUT = process.env.E2E_OUT_DIR || '.e2e-output'
let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `  ${detail}`}`)
  ok ? pass++ : fail++
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// —— 启动 Chrome ——
// 每次都必须跑在一个干净的浏览器上：令牌存在 localStorage，profile 留着会让下一轮一上来就是已登录。
//
// 调试端口默认用 0（让 Chrome 自己挑一个空闲端口，端口号写在 profile 的 DevToolsActivePort 里）。
// 不要改成固定端口：本机常有别的会话也在跑无头 Chrome，固定端口一旦被它们占住，
// 我们自己的 Chrome 会静默启动失败，脚本却照旧连上**别人家的浏览器**，
// 于是所有断言都对着一个陌生页面跑，得出的结论全是错的。
const PROFILE = `${OUT}/chrome-profile`
mkdirSync(OUT, { recursive: true })
rmSync(PROFILE, { recursive: true, force: true })
const chrome = spawn('google-chrome', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  `--remote-debugging-port=${PORT}`, '--window-size=1440,900', '--no-first-run',
  `--user-data-dir=${PROFILE}`, 'about:blank',
], { stdio: 'ignore' })
// 无论正常结束还是抛异常，都要回收浏览器，否则残留进程会污染下一轮
process.on('exit', () => { try { chrome.kill('SIGKILL') } catch {} })
process.on('uncaughtException', (e) => { console.error(e); try { chrome.kill('SIGKILL') } catch {}; process.exit(1) })
process.on('unhandledRejection', (e) => { console.error(e); try { chrome.kill('SIGKILL') } catch {}; process.exit(1) })

const waitFor = async (fn, timeout = 20000, step = 300) => {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try { const v = await fn(); if (v) return v } catch {}
    await sleep(step)
  }
  return null
}

// 等 Chrome 把实际端口写进 DevToolsActivePort（首行端口、次行 ws 路径）
const activePort = await waitFor(async () => {
  try {
    const raw = readFileSync(`${PROFILE}/DevToolsActivePort`, 'utf8').trim().split('\n')
    return Number(raw[0]) || null
  } catch { return null }
}, 20000, 200)
if (!activePort) {
  const why = chrome.exitCode !== null ? `Chrome 启动即退出（exitCode=${chrome.exitCode}）` : 'DevToolsActivePort 未生成'
  console.error(`Chrome 未就绪：${why}`)
  chrome.kill()
  process.exit(1)
}

const target = await waitFor(async () => {
  const res = await fetch(`http://127.0.0.1:${activePort}/json/list`)
  const list = await res.json()
  return list.find((t) => t.type === 'page') || null
}, 20000)
if (!target) { console.error('Chrome 未就绪'); chrome.kill(); process.exit(1) }
console.log(`（调试端口 ${activePort}）`)

const ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 256 * 1024 * 1024 })
await new Promise((r) => ws.on('open', r))
let seq = 0
const pending = new Map()
ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString())
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
  }
})
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(`CDP 超时: ${method}`)) } }, 30000)
  })

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'JS 异常')
  return r.result.value
}
const goto = async (url) => {
  await send('Page.navigate', { url })
  await sleep(2500)
}
const shot = async (name) => {
  try {
    const r = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.data, 'base64'))
  } catch { /* 截图失败不影响判定 */ }
}

await send('Page.enable')
await send('Runtime.enable')

console.log('\n== 1. 未登录访问首页应跳到登录页 ==')
await goto(BASE + '/')
const hash1 = await evaluate('location.hash')
check('未登录重定向到 #/login', hash1.startsWith('#/login'), `hash=${hash1}`)
const hasForm = await evaluate(`!!document.querySelector('input[type="password"]')`)
check('登录表单已渲染', hasForm)
await shot('01-login')

console.log('\n== 2. 用真实界面登录（验证码从 DOM 里读，等同于人工识别）==')
// 从页面上的验证码 SVG 里读出字符
const captchaText = await evaluate(`
  (() => {
    const svg = document.querySelector('.captcha-svg svg');
    if (!svg) return '';
    return [...svg.querySelectorAll('text')].map(t => t.textContent.trim()).join('');
  })()
`)
check('能从页面读出验证码', /^[A-Z0-9]{4,6}$/.test(captchaText || ''), `读到 "${captchaText}"`)

// 用户名输入框 placeholder「请输入用户名」；验证码输入框 placeholder「不区分大小写」
const filled = await evaluate(`
  (() => {
    const set = (el, v) => {
      const proto = Object.getPrototypeOf(el);
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const inputs = [...document.querySelectorAll('input')];
    const user = inputs.find(i => /用户名/.test(i.placeholder || ''));
    const pwd = inputs.find(i => i.type === 'password');
    const cap = inputs.find(i => /不区分大小写|验证码/.test(i.placeholder || ''));
    if (!user || !pwd || !cap) return 'missing:' + inputs.map(i => i.placeholder).join('|');
    set(user, 'admin');
    set(pwd, 'Admin@123');
    set(cap, ${JSON.stringify(captchaText)});
    return 'ok';
  })()
`)
check('三个输入框都填上了', filled === 'ok', filled)
await sleep(300)
await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(x => /登\\s*录/.test(x.textContent)); if (b) b.click(); return true })()`)
await sleep(4000)

const hash2 = await evaluate('location.hash')
check('登录成功并进入门户页', !hash2.includes('login'), `hash=${hash2}`)
await shot('02-portal')

console.log('\n== 3. 原有三个可视化标签页未回归 ==')
const tabText = await evaluate(`document.body.innerText.slice(0, 600)`)
check('页面含「地理信息可视化」', tabText.includes('地理信息可视化'))
check('页面含「孪生」相关标签', /孪生|设备/.test(tabText))
check('页面含「数据可视化」', tabText.includes('数据可视化'))

console.log('\n== 4. 管理台菜单与分页 ==')
// 首次进入管理台要现加载分包，多等一会儿。
// 注意：只等 tbody tr 是不够的——门户页自己的表格也有 tbody tr，
// 会把「管理台还没渲染」误判成已就绪。必须等到管理台的标题出现。
await goto(BASE + '/#/admin/users')
const ready = await waitFor(async () => {
  const info = await evaluate(`
    (() => ({
      text: document.body.innerText,
      rows: document.querySelectorAll('tbody tr').length,
    }))()
  `)
  return info.text.includes('用户管理') && info.rows > 0 ? info : null
}, 20000)
check('进入用户管理页', Boolean(ready))
const adminText = ready ? ready.text : await evaluate('document.body.innerText')
const rowCount = await evaluate(`document.querySelectorAll('tbody tr').length`)
check('用户列表有数据行', rowCount > 0, `rows=${rowCount}`)
const totalText = await evaluate(`(document.body.innerText.match(/共\\s*\\d+\\s*条/) || [''])[0]`)
check('显示总条数', /\d+/.test(totalText), totalText)
const firstPageFirst = await evaluate(`(document.querySelector('tbody tr')?.innerText || '').slice(0, 40)`)

// 翻到第 2 页
await evaluate(`
  (() => {
    const b = [...document.querySelectorAll('button, a')].find(x => /下一页|下一頁|›|»/.test(x.textContent.trim()));
    if (b) { b.click(); return 'clicked' } return 'notfound'
  })()
`)
await sleep(2000)
const firstPageTwo = await evaluate(`(document.querySelector('tbody tr')?.innerText || '').slice(0, 40)`)
const pageLabel = await evaluate(`(document.body.innerText.match(/(\\d+)\\s*\\/\\s*(\\d+)/) || [''])[0]`)
check('翻页后首行内容变化（真的换页了）', firstPageTwo !== firstPageFirst && firstPageTwo.length > 0,
  `p1="${firstPageFirst.slice(0, 20)}" p2="${firstPageTwo.slice(0, 20)}"`)
check('分页控件显示页码', /\d+\s*\/\s*\d+/.test(pageLabel), pageLabel)
await shot('03-admin-users-p2')

// 逐个菜单点一遍，确认都能打开且有分页组件
console.log('\n== 5. 遍历 12 个管理菜单（要求真的渲染出内容）==')
await goto(BASE + '/#/admin/dashboard')
await sleep(2000)
const sidebarCount = await evaluate(`document.querySelectorAll('.sidebar a, .sidebar .menu-item, aside a').length`)
check('侧边菜单项数量为 12', sidebarCount === 12, `count=${sidebarCount}`)

const menus = [
  ['dashboard', '概览'], ['users', '用户'], ['roles', '角色'], ['signals', '信号机'],
  ['alarms', '告警'], ['work-orders', '工单'], ['telemetry', '遥测'],
  ['logs/login', '登录日志'], ['logs/op', '操作日志'],
  ['ai/sessions', '会话'], ['ai/models', '模型'], ['settings', '设置'],
]
for (const [path, label] of menus) {
  await goto(`${BASE}/#/admin/${path}`)
  await sleep(2200)
  const info = await evaluate(`
    (() => {
      const text = document.body.innerText;
      const heading = (document.querySelector('h1,h2,.page-head h2,.page-head')?.innerText || '').split('\\n')[0];
      return {
        heading,
        notLogin: !/请输入用户名/.test(text),
        rows: document.querySelectorAll('tbody tr').length,
        cards: document.querySelectorAll('.rs-panel, .stat-card, [class*="card"]').length,
        hasPager: /共\\s*\\d+\\s*条|\\d+\\s*\\/\\s*\\d+/.test(text),
      };
    })()
  `)
  // 概览/设置页没有表格，用卡片或分页判定；其余菜单必须有数据行或分页控件
  const ok = info.notLogin && (info.rows > 0 || info.cards > 0 || info.hasPager)
  check(`菜单 ${label} 渲染内容`, ok, JSON.stringify(info).slice(0, 140))
}
await shot('04-admin-settings')

console.log('\n== 6. 智能体弹框 ==')
await goto(BASE + '/')
await sleep(2500)
const launcher = await evaluate(`
  (() => {
    const btn = document.querySelector('.agent-fab');
    if (!btn) return 'no-fab';
    btn.click();
    return 'clicked';
  })()
`)
await sleep(2500)
const dialogOpen = await evaluate(`
  (() => {
    const dlg = document.querySelector('.agent-dialog');
    return Boolean(dlg) && document.body.innerText.includes('铁路信号运维智能体');
  })()
`)
check('点击浮动按钮弹出智能体对话框', launcher === 'clicked' && dialogOpen, launcher)
const modelPicker = await evaluate(`/模型|qwen|deepseek/i.test(document.body.innerText)`)
check('对话框内出现模型选择', modelPicker)
const voiceBtn = await evaluate(`/麦克风|语音|🎙/.test(document.body.innerText)`)
check('对话框内出现语音入口', voiceBtn)
await shot('05-agent-dialog')

console.log(`\n端到端：通过 ${pass} 项，失败 ${fail} 项（截图见 ${OUT}/）`)
ws.close()
chrome.kill()
process.exit(fail ? 1 : 0)
