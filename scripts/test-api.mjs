// 后台接口自测脚本：覆盖公共服务全流程 + 管理台每个菜单的分页查询。
// 用法：node scripts/test-api.mjs [baseUrl]   默认 http://127.0.0.1:8037

const BASE = process.argv[2] || 'http://127.0.0.1:8037'

let passed = 0
let failed = 0
const failures = []

const check = (name, condition, detail = '') => {
  if (condition) {
    passed += 1
    console.log(`  ✓ ${name}`)
  } else {
    failed += 1
    failures.push(name)
    console.log(`  ✗ ${name} ${detail}`)
  }
}

const request = async (method, path, { token, body, raw } = {}) => {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body && !raw) headers['Content-Type'] = 'application/json'
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? (raw ? body : JSON.stringify(body)) : undefined,
  })
  const text = await response.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch (_) {
    json = null
  }
  return { status: response.status, json, text, headers: response.headers }
}

// 验证码是 SVG，字符直接取 <text> 节点内容（用于自动化自测）
const fetchCaptcha = async () => {
  const response = await request('GET', '/api/auth/captcha')
  const svg = response.json?.data?.svg || ''
  const code = [...svg.matchAll(/>([A-Z0-9])<\/text>/g)].map((m) => m[1]).join('')
  return { id: response.json?.data?.id, code }
}

const login = async (username, password) => {
  const captcha = await fetchCaptcha()
  const response = await request('POST', '/api/auth/login', {
    body: { username, password, captchaId: captcha.id, captchaCode: captcha.code },
  })
  return response
}

const section = (title) => console.log(`\n== ${title} ==`)

const run = async () => {
  section('健康检查与验证码')
  const health = await request('GET', '/api/health')
  check('GET /api/health 返回 ok', health.json?.ok === true)
  const captcha = await fetchCaptcha()
  check('验证码 SVG 可解析出 4 位字符', captcha.code.length === 4, `实际 ${captcha.code.length} 位`)

  section('登录与鉴权')
  const badCaptcha = await request('POST', '/api/auth/login', {
    body: { username: 'admin', password: 'Admin@123', captchaId: 'nope', captchaCode: 'XXXX' },
  })
  check('错误验证码被拒绝', badCaptcha.status === 400, `status=${badCaptcha.status}`)

  const wrongPassword = await login('admin', 'WrongPass123')
  check('错误密码被拒绝', wrongPassword.status === 401, `status=${wrongPassword.status}`)

  const adminLogin = await login('admin', 'Admin@123')
  check('管理员登录成功', adminLogin.json?.ok === true, adminLogin.text.slice(0, 120))
  const adminToken = adminLogin.json?.data?.token || ''
  check('登录返回令牌与权限', Boolean(adminToken) && Array.isArray(adminLogin.json?.data?.permissions))
  check('管理员权限包含通配符 *', (adminLogin.json?.data?.permissions || []).includes('*'))

  const noToken = await request('GET', '/api/admin/users')
  check('未带令牌访问管理接口返回 401', noToken.status === 401, `status=${noToken.status}`)

  const me = await request('GET', '/api/auth/me', { token: adminToken })
  check('GET /api/auth/me 返回当前用户', me.json?.data?.user?.username === 'admin')

  section('注册 / 修改密码 / 找回密码 全流程')
  // 手机号在库里是唯一的，必须每次运行都换一个，否则第二次自测会卡在「该手机号已被注册」
  const runTag = Date.now().toString().slice(-6)
  const newUser = `autotest${runTag}`
  const captcha2 = await fetchCaptcha()
  const register2 = await request('POST', '/api/auth/register', {
    body: {
      username: newUser,
      password: 'Test@1234',
      confirmPassword: 'Test@1234',
      name: '自测用户',
      phone: `137${runTag.padStart(8, '0')}`,
      email: `${newUser}@test.local`,
      captchaId: captcha2.id,
      captchaCode: captcha2.code,
    },
  })
  check('注册成功并自动登录', register2.json?.ok === true, register2.text.slice(0, 160))
  const userToken = register2.json?.data?.token || ''
  check('新用户默认角色为 user', register2.json?.data?.user?.role === 'user')

  const dupCaptcha = await fetchCaptcha()
  const duplicate = await request('POST', '/api/auth/register', {
    body: {
      username: newUser,
      password: 'Test@1234',
      confirmPassword: 'Test@1234',
      name: '自测用户',
      captchaId: dupCaptcha.id,
      captchaCode: dupCaptcha.code,
    },
  })
  check('重复用户名被拒绝', duplicate.status === 400, `status=${duplicate.status}`)

  const weakCaptcha = await fetchCaptcha()
  const weak = await request('POST', '/api/auth/register', {
    body: {
      username: `weak${Date.now().toString().slice(-5)}`,
      password: '12345678',
      confirmPassword: '12345678',
      name: '弱口令',
      captchaId: weakCaptcha.id,
      captchaCode: weakCaptcha.code,
    },
  })
  check('纯数字弱口令被拒绝', weak.status === 400, `status=${weak.status}`)

  const changePwd = await request('POST', '/api/auth/change-password', {
    token: userToken,
    body: { oldPassword: 'Test@1234', newPassword: 'Test@5678', confirmPassword: 'Test@5678' },
  })
  check('修改密码成功', changePwd.json?.ok === true, changePwd.text.slice(0, 120))

  const loginOld = await login(newUser, 'Test@1234')
  check('旧密码已失效', loginOld.status === 401, `status=${loginOld.status}`)
  const loginNew = await login(newUser, 'Test@5678')
  check('新密码可登录', loginNew.json?.ok === true)

  const forgotCaptcha = await fetchCaptcha()
  const forgot = await request('POST', '/api/auth/forgot-password', {
    body: { username: newUser, phone: `137${runTag.padStart(8, '0')}`, captchaId: forgotCaptcha.id, captchaCode: forgotCaptcha.code },
  })
  check('找回密码签发重置令牌', Boolean(forgot.json?.data?.token), forgot.text.slice(0, 160))
  const resetToken = forgot.json?.data?.token || ''
  const reset = await request('POST', '/api/auth/reset-password', {
    body: { username: newUser, token: resetToken, newPassword: 'Test@9999', confirmPassword: 'Test@9999' },
  })
  check('重置密码成功', reset.json?.ok === true, reset.text.slice(0, 120))
  const loginReset = await login(newUser, 'Test@9999')
  check('重置后的密码可登录', loginReset.json?.ok === true)

  const reuse = await request('POST', '/api/auth/reset-password', {
    body: { username: newUser, token: resetToken, newPassword: 'Test@0000', confirmPassword: 'Test@0000' },
  })
  check('重置令牌不可重复使用', reuse.status === 400, `status=${reuse.status}`)

  section('管理台权限隔离')
  const operatorLogin = await login('operator', 'Operator@123')
  const operatorToken = operatorLogin.json?.data?.token || ''
  check('运维账号可登录', Boolean(operatorToken))
  const operatorUsers = await request('GET', '/api/admin/users', { token: operatorToken })
  check('运维账号无用户管理权限（403）', operatorUsers.status === 403, `status=${operatorUsers.status}`)
  const operatorAlarms = await request('GET', '/api/admin/alarms', { token: operatorToken })
  check('运维账号可查看告警', operatorAlarms.json?.ok === true)

  section('管理台各菜单分页查询')
  const menus = [
    ['/api/admin/overview', '概览统计'],
    ['/api/admin/users', '用户管理'],
    ['/api/admin/roles', '角色权限'],
    ['/api/admin/signals', '信号机管理'],
    ['/api/admin/alarms', '告警记录'],
    ['/api/admin/work-orders', '工单管理'],
    ['/api/admin/telemetry', '遥测记录'],
    ['/api/admin/login-logs', '登录日志'],
    ['/api/admin/op-logs', '操作日志'],
    ['/api/admin/ai-sessions', '智能体会话'],
    ['/api/admin/models', '模型管理'],
    ['/api/admin/configs', '系统设置'],
  ]
  for (const [path, label] of menus) {
    const response = await request('GET', `${path}?page=1&pageSize=5`, { token: adminToken })
    const data = response.json?.data
    if (path.endsWith('overview')) {
      check(`${label}（${path}）返回统计数据`, Boolean(data?.stats?.userTotal !== undefined))
      continue
    }
    const okShape =
      Array.isArray(data?.list) &&
      typeof data?.total === 'number' &&
      data.page === 1 &&
      data.pageSize === 5 &&
      typeof data.totalPages === 'number'
    check(
      `${label}（${path}）分页结构正确`,
      okShape,
      `total=${data?.total} list=${data?.list?.length} pages=${data?.totalPages}`
    )
    check(`${label} 每页条数受控（<=5）`, (data?.list?.length || 0) <= 5, `实际 ${data?.list?.length}`)

    if (!path.endsWith('overview') && (data?.totalPages || 1) > 1) {
      const page2 = await request('GET', `${path}?page=2&pageSize=5`, { token: adminToken })
      const list2 = page2.json?.data?.list || []
      const firstIds = (data?.list || []).map((item) => item.id ?? item.key ?? item.code).join(',')
      const secondIds = list2.map((item) => item.id ?? item.key ?? item.code).join(',')
      check(
        `${label} 第 2 页数据与第 1 页不重复`,
        list2.length > 0 && firstIds !== secondIds,
        `p1=[${firstIds}] p2=[${secondIds}]`
      )
    }
  }

  section('分页边界')
  const edge = await request('GET', '/api/admin/alarms?page=0&pageSize=9999', { token: adminToken })
  check('page=0 归一到第 1 页', edge.json?.data?.page === 1, `page=${edge.json?.data?.page}`)
  check('pageSize 上限被限制为 200', edge.json?.data?.pageSize === 200, `pageSize=${edge.json?.data?.pageSize}`)

  const search = await request('GET', '/api/admin/users?keyword=admin&page=1&pageSize=10', { token: adminToken })
  check(
    '关键词搜索生效',
    (search.json?.data?.list || []).length > 0 && search.json?.data?.list?.every((u) => JSON.stringify(u).includes('admin')),
    `命中 ${search.json?.data?.total} 条`
  )

  const filter = await request('GET', '/api/admin/alarms?status=pending&page=1&pageSize=20', { token: adminToken })
  check(
    '状态筛选生效',
    (filter.json?.data?.list || []).every((item) => item.status === 'pending'),
    `命中 ${filter.json?.data?.total} 条`
  )

  const sortCheck = await request('GET', '/api/admin/alarms?page=1&pageSize=10&dateFrom=2000-01-01&dateTo=2999-01-01', {
    token: adminToken,
  })
  check('时间范围筛选生效', (sortCheck.json?.data?.total || 0) === 96, `total=${sortCheck.json?.data?.total}`)

  section('管理台写操作')
  const pending = await request('GET', '/api/admin/alarms?status=pending&page=1&pageSize=1', { token: adminToken })
  const alarmId = pending.json?.data?.list?.[0]?.id
  const handle = await request('PUT', `/api/admin/alarms/${alarmId}/handle`, {
    token: adminToken,
    body: { status: 'resolved', remark: '自测处理' },
  })
  check('处理告警成功', handle.json?.ok === true, handle.text.slice(0, 120))

  // 新增接口只回 {id}，用户名要用本地变量，不能从响应里取
  const createdUsername = `mgr${Date.now().toString().slice(-6)}`
  const created = await request('POST', '/api/admin/users', {
    token: adminToken,
    body: { username: createdUsername, name: '后台创建', role: 'operator', password: 'Mgr@12345' },
  })
  check('后台新增用户成功', created.json?.ok === true, created.text.slice(0, 120))
  const createdId = created.json?.data?.id

  const disable = await request('PUT', `/api/admin/users/${createdId}/status`, { token: adminToken, body: { status: 'disabled' } })
  check('禁用用户成功', disable.json?.ok === true)
  const loginDisabled = await login(createdUsername, 'Mgr@12345')
  check('被禁用账号无法登录（403）', loginDisabled.status === 403, `status=${loginDisabled.status}`)

  const removeUser = await request('DELETE', `/api/admin/users/${createdId}`, { token: adminToken })
  check('删除用户成功', removeUser.json?.ok === true)

  const logAfter = await request('GET', '/api/admin/op-logs?page=1&pageSize=5', { token: adminToken })
  check('写操作已记录操作日志', (logAfter.json?.data?.total || 0) > 1, `total=${logAfter.json?.data?.total}`)

  section('智能体接口')
  const models = await request('GET', '/api/ai/models', { token: adminToken })
  check('模型列表可用', (models.json?.data?.list || []).length > 0, `共 ${models.json?.data?.total} 个`)
  check('模型列表标注本机是否已安装', (models.json?.data?.list || []).some((m) => m.installed === true))
  const aiHealth = await request('GET', '/api/ai/health')
  check('Ollama 在线', aiHealth.json?.data?.ollama?.online === true, JSON.stringify(aiHealth.json?.data?.ollama))

  const context = await request('GET', '/api/ai/context', { token: adminToken })
  check('实时上下文包含信号机状态', (context.json?.data?.signals || []).length > 0)

  section('遥测入库')
  const ingested = await request('POST', '/api/telemetry/ingest', {
    body: { device_id: 'selftest-01', device: '自测雷达', distance_cm: 123.4, distance_m: 1.23, water_active: 0, ts_ms: Date.now() },
  })
  check('遥测上报入库成功', ingested.json?.ok === true, ingested.text.slice(0, 120))
  const telemetrySearch = await request('GET', '/api/admin/telemetry?keyword=自测雷达&page=1&pageSize=5', { token: adminToken })
  check('遥测记录可分页查到刚上报的数据', (telemetrySearch.json?.data?.total || 0) >= 1, `total=${telemetrySearch.json?.data?.total}`)

  console.log(`\n通过 ${passed} 项，失败 ${failed} 项`)
  if (failures.length) console.log('失败项：\n - ' + failures.join('\n - '))
  process.exit(failed ? 1 : 0)
}

run().catch((error) => {
  console.error('自测脚本异常:', error)
  process.exit(1)
})
