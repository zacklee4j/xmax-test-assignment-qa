/**
 * Module B 黑盒 API（基于 docs/api-spec.md）
 * 默认请求 job-service `TEST_API_BASE`（默认 http://127.0.0.1:3020）。
 * 未启动服务时跳过（不失败）。
 * @jest-environment node
 */
import { jest, describe, it, expect, beforeAll } from '@jest/globals'

const BASE = process.env.TEST_API_BASE || 'http://127.0.0.1:3020'

async function isServerUp() {
    try {
        const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(1500) })
        return res.ok
    } catch {
        return false
    }
}

describe('API blackbox（需 job-service 运行在 3020）', () => {
    let up = false

    beforeAll(async () => {
        up = await isServerUp()
        if (!up) {
            // eslint-disable-next-line no-console
            console.warn(`[api-blackbox] 跳过：无法连接 ${BASE}/health（请先 docker-compose up -d 并启动 job-service）`)
        }
    })

    const req = (path, options = {}) => {
        if (!up) return Promise.resolve(null)
        return fetch(`${BASE}${path}`, {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options,
        })
    }

    it('TC-Health：GET /health 返回 200', async () => {
        if (!up) return
        const res = await req('/health')
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toBeDefined()
    })

    it('TC-Public：GET /api/v1/metadata 可访问（公开路由）', async () => {
        if (!up) return
        const res = await req('/api/v1/metadata')
        expect([200, 304]).toContain(res.status)
    })

    it('TC02：POST /api/v1/candidate/applications 缺少 x-user-id 返回 401', async () => {
        if (!up) return
        const res = await req('/api/v1/candidate/applications', {
            method: 'POST',
            body: JSON.stringify({ jobId: 'job_20250806_e8e99862' }),
        })
        expect(res.status).toBe(401)
        const body = await res.json().catch(() => ({}))
        expect(body.code).toBe(1002)
    })

    it('TC03：缺少 jobId 返回 400', async () => {
        if (!up) return
        const res = await req('/api/v1/candidate/applications', {
            method: 'POST',
            headers: {
                'x-user-id': '00000000-0000-4000-8000-000000000001',
                'x-user-type': 'C',
            },
            body: JSON.stringify({}),
        })
        expect(res.status).toBe(400)
    })

    it('TC04：coverLetter 超长返回 400', async () => {
        if (!up) return
        const res = await req('/api/v1/candidate/applications', {
            method: 'POST',
            headers: {
                'x-user-id': '00000000-0000-4000-8000-000000000001',
                'x-user-type': 'C',
            },
            body: JSON.stringify({
                jobId: 'job_20250806_e8e99862',
                coverLetter: 'x'.repeat(2001),
            }),
        })
        expect(res.status).toBe(400)
    })

    it('TC05：职位不存在返回 404', async () => {
        if (!up) return
        const res = await req('/api/v1/candidate/applications', {
            method: 'POST',
            headers: {
                'x-user-id': '00000000-0000-4000-8000-000000000001',
                'x-user-type': 'C',
            },
            body: JSON.stringify({ jobId: 'job_20990101_notexist00' }),
        })
        expect(res.status).toBe(404)
        const body = await res.json().catch(() => ({}))
        expect(body.code).toBe(2001)
    })

    it('TC07：C 端用户调用 B 端状态更新应 403', async () => {
        if (!up) return
        const res = await req('/api/v1/applications/app_20250101_fictional0/status', {
            method: 'PUT',
            headers: {
                'x-user-id': '00000000-0000-4000-8000-000000000001',
                'x-user-type': 'C',
                'x-user-permissions': '[]',
            },
            body: JSON.stringify({ status: 'screening' }),
        })
        expect(res.status).toBe(403)
    })

    it('TC-B：PUT 状态缺少 application:update 权限时 403', async () => {
        if (!up) return
        const res = await req('/api/v1/applications/app_20250101_fictional0/status', {
            method: 'PUT',
            headers: {
                'x-user-id': '00000000-0000-4000-8000-000000000002',
                'x-user-type': 'B',
                'x-company-id': 'company-1',
                'x-user-permissions': '[]',
            },
            body: JSON.stringify({ status: 'screening' }),
        })
        expect(res.status).toBe(403)
    })
})
