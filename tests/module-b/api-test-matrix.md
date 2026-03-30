# Module B：黑盒 API 测试矩阵（基于 `docs/api-spec.md`）

等价类 / 边界：请求头、`jobId`、重复申请、未认证、职位不存在、Cover letter 长度等。

| ID | 场景 | 前置条件 | 输入（要点） | 预期 HTTP | 预期行为（摘要） |
|----|------|----------|--------------|-----------|------------------|
| TC01 | 正常第一次投递 | 服务可用；存在 `published` 职位；候选人已登录 | `POST /api/v1/candidate/applications`，合法 `jobId`，带 `x-user-id` | 201 | `data.status === submitting`（或文档约定状态） |
| TC02 | 缺少 `x-user-id` | 无 | 同上，省略 `x-user-id` | 401 | 未认证错误码 1002 |
| TC03 | `jobId` 缺失 | 有用户头 | body `{}` 或缺 `jobId` | 400 | 参数校验 1006 |
| TC04 | `coverLetter` 超长 | 有用户头 | `coverLetter` 长度 > 2000 | 400 | 1006 |
| TC05 | 职位不存在 | 有用户头 | 不存在的 `jobId` | 404 | 2001 |
| TC06 | 重复申请（非 submitting） | 该职位已存在非 `submitting` 申请 | 再次 `POST` 同 `jobId` | 400 | 3010 DUPLICATE |
| TC07 | B 端更新状态无权限 | 使用 C 端用户头 | `PUT /api/v1/applications/:id/status`，body 合法 `status` | 403 | 无 `application:update` |
| TC08 | B 端更新状态成功路径 | 使用 B 端头 + `x-user-permissions` 含 `application:update`；合法 `applicationId` | `PUT` 带 `status` | 200 | `code===0`，含 `previousStatus`/`newStatus` |

自动化说明：见 `tests/module-b/api-blackbox.test.js`。若本机未启动 `job-service`（默认 `http://127.0.0.1:3020`），用例将跳过并提示先 `docker-compose up -d` 与启动服务。
