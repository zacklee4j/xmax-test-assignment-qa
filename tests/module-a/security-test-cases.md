# Module A：安全测试用例设计（OWASP 认证相关）

以下为 5 个可落地的安全测试用例，均包含：**场景描述**、**请求构造**、**预期结果**。可在网关 / 集成环境执行；与 `tests/module-a/auth-regression.test.js` 中的单测互补。

---

## 用例 1：缺失 Bearer Token

| 项目 | 内容 |
|------|------|
| **场景描述** | 未携带 `Authorization: Bearer <token>` 访问需认证路由。 |
| **请求构造** | `GET /api/v1/protected`，无 `Authorization` 头；`curl` 或 Postman 省略认证头。 |
| **预期结果** | 返回 401；错误码为 `TOKEN_MISSING`（401001）；不进入下游业务与数据库写操作。 |

---

## 用例 2：Token 签名被篡改

| 项目 | 内容 |
|------|------|
| **场景描述** | 使用合法 JWT 结构但修改 payload 或签名任意比特，验证服务端拒绝。 |
| **请求构造** | 复制合法 `accessToken`，修改末位字符或 payload 中 `userId` 后仍带 `Bearer ` 发送。 |
| **预期结果** | 401，`TOKEN_INVALID`（401002）；`ctx.state.user` 不被设置；审计日志记录校验失败。 |

---

## 用例 3：Token 过期（`exp` 已过）

| 项目 | 内容 |
|------|------|
| **场景描述** | 使用已过期的 access token 调用需认证接口。 |
| **请求构造** | 使用用户中心签发的、故意缩短 `exp` 的 token，或等待自然过期后请求。 |
| **预期结果** | 401，`TOKEN_EXPIRED`（401003）；客户端应走 refresh 或重新登录（与业务约定一致）。 |

---

## 用例 4：C 端用户越权访问 B 端专属能力

| 项目 | 内容 |
|------|------|
| **场景描述** | JWT 中 `userType`（或网关注入的 `x-user-type`）为 `C` 时，访问仅允许 `B` 的接口（如企业管理、B 端申请处理）。 |
| **请求构造** | 以候选人 token 调用 `PUT /api/v1/applications/:id/status` 或文档中 B 端专用 API，Header 仍带合法 token。 |
| **预期结果** | 403 或业务约定的无权限码；不得修改他人/他司数据；服务端以 `x-user-type` + 权限列表双重校验。 |

---

## 用例 5：网关头注入 / 伪造 `x-user-id`

| 项目 | 内容 |
|------|------|
| **场景描述** | 攻击者绕过网关，直接请求下游服务并伪造 `x-user-id` 为管理员或他人 ID。 |
| **请求构造** | 直连 `job-service`（若暴露），带 `x-user-id: <victim>` 且无有效内网 mTLS/签名。 |
| **预期结果** | 生产环境下游应对「非网关来源」拒绝或要求 mTLS/HMAC；测试环境也应在文档中声明禁止公网直连。 |

---

## 可选自动化

- 单测层：对 `jwt_auth` / `gateway_auth` 使用 mock 的 `jwt.verify`、`fetch` 验证上述分支（见 `auth-regression.test.js`）。
- 集成层：在启用测试网关时，用 `supertest` 或 `curl` 跑用例 1–3；用例 5 依赖部署模型，可在 CI 中 `skip` 并注明前提。
