# Module B：代码审查（ApplicationService + C 端控制器）

## 问题 1：`hasAssessment` 在控制器中恒为 `true`，与「两步提交需简历+评估」的语义不一致

**位置**：`job-service/src/controllers/candidateApplicationController.js` — `submitApplication`

```javascript
// AI 面试已改为可选：hasAssessment 始终为 true，不再阻塞申请提交
const hasAssessment = true
```

而 `ApplicationService.createApplication()` / `canSubmitApplication()` 仍体现「需 `hasResume && hasAssessment` 才能从 `submitting` 进入 `submitted`」的两步模型（见 `application_status.js` 中 `canSubmitApplication`）。

**影响分析**

- 文档与 `docs/api-spec.md` 描述的两步流程（第二次调用需「有简历且简历已就绪」）与实现细节不完全对齐：评估侧永远视为已满足。
- B 端/统计若依赖 `metadata.hasAssessment` 区分「未完成 AI 评估的投递」，该字段失去区分度。
- 与 `checkApplicationStatus` 返回的 `missingInfo.needAssessment` 可能产生组合语义冲突（视前端是否仍读取该字段而定）。

**修复建议**

- 若产品确认「AI 评估可选」：同步修订 `docs/api-spec.md`、`canSubmitApplication` 注释与 `missingInfo.needAssessment` 的计算规则，使文档与常量层语义一致。
- 若仍希望第二步强依赖评估完成：应恢复根据职位/面试类型或 `ResumeAiService` 结果设置 `hasAssessment`，并与 Joi/stripUnknown 行为一起做一次联调测试。
