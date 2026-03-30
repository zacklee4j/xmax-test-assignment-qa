# Module A：网关鉴权代码审查（Bug 报告）

审查范围：`gateway/jwt_auth.js`、`gateway/gateway_auth.js`（及 `gateway/errors.js` 语义对照）。

---

## 问题 1：`internalAuth` 中对 `const userId` 的二次赋值（逻辑错误 / 调试后门失效）

**位置**：`gateway/gateway_auth.js` — `internalAuth` 内

```javascript
const userId = ctx.headers['x-user-id']

if (!userId && config.debug.enabled && config.debug.userId) {
    userId = config.debug.userId  // 对 const 重新赋值
}
```

**问题描述**：`userId` 使用 `const` 声明，后续分支却尝试赋值。这在运行时会抛出 `TypeError: Assignment to constant variable`，导致「无 X-User-ID 时通过 debug 配置注入 userId」的逻辑**永远无法执行**；一旦进入该分支即崩溃。

**影响分析**：内部服务鉴权在「缺少 header 且开启 debug」场景下会直接 500，而不是按设计回退到调试用户；同时说明该路径缺少基本静态检查/测试覆盖。

**修复建议**：改为 `let userId = ctx.headers['x-user-id']`，或先读入临时变量再合并；并为 `internalAuth` 增加单元测试覆盖 debug 分支。

---

## 问题 2：`x-user-roles` 未经安全解析（可用性与潜在 DoS）

**位置**：`gateway/gateway_auth.js` — `gatewayAuth` 主流程

```javascript
roles: userRoles ? JSON.parse(userRoles) : [],
```

**问题描述**：`JSON.parse` 未包裹在 `try/catch` 中。恶意或错误的 header（非合法 JSON 字符串）会导致同步异常向上抛出，请求在未进入业务逻辑前失败。

**影响分析**：攻击者可用畸形 header 制造大量 500/异常日志；合法客户端若误传格式也会得到硬错误而非 401/400。

**修复建议**：解析失败时视为空数组或返回 400/401，并记录 warn；或对网关约定为逗号分隔列表时与 `job-service` 的 `gateway-auth.js` 一样做兼容解析。

---

## 问题 3：B 端缺少 `companyId` 时使用 `TOKEN_EXPIRED` 错误码（语义错误）

**位置**：`gateway/jwt_auth.js` — B 端用户 `companyId` 校验分支

```javascript
const error = new CustomError(errorCodes.TOKEN_EXPIRED.message, errorCodes.TOKEN_EXPIRED.code)
throw error
```

**问题描述**：业务含义是「B 端用户未关联公司，不应访问除白名单外的接口」，但错误码与文案均为「access token expired」。

**影响分析**：客户端会误判为令牌过期并走刷新 token 流程，无法引导用户完成企业绑定/创建公司；与安全审计日志中的「过期」事件混淆。

**修复建议**：使用独立业务码（例如 `403` + `COMPANY_REQUIRED`）或在 `errorCodes` 中新增明确项，并保证与 `gateway/errors.js` 文档一致。
