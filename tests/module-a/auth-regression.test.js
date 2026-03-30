/**
 * Module A 回归测试：覆盖 bug-report.md 中的问题（需配合 mock 外部依赖）。
 * @jest-environment node
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, '../..')

describe('gateway_auth — x-user-roles 非法 JSON（问题 2）', () => {
    let gatewayAuth

    beforeEach(async () => {
        jest.resetModules()
        await jest.unstable_mockModule(path.join(repoRoot, 'config/env.js'), () => ({
            default: { debug: { enabled: false, userId: null } },
        }))
        const mod = await import('../../gateway/gateway_auth.js')
        gatewayAuth = mod.gatewayAuth
    })

    it('应在 JSON.parse 失败时抛出（避免静默吞掉畸形 header）', async () => {
        const ctx = {
            headers: {
                'x-user-id': 'cand-001',
                'x-user-type': 'C',
                'x-user-username': 'u',
                'x-user-email': 'e@test.com',
                'x-user-roles': '{broken-json',
            },
            state: { traceId: 't-regression-1' },
            logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
        }
        ctx.throw = (status, msg) => {
            const err = new Error(msg)
            err.status = status
            throw err
        }
        const next = jest.fn()

        await expect(gatewayAuth(ctx, next)).rejects.toMatchObject({ status: 500 })
        expect(next).not.toHaveBeenCalled()
    })
})

describe('jwt_auth — B 端缺少 companyId 时使用 TOKEN_EXPIRED（问题 3）', () => {
    let jwtAuth

    beforeEach(async () => {
        jest.resetModules()
        process.env.JWT_SECRET = 'test-secret-for-jwt-regression'
        process.env.JWT_ISSUER = 'xmax-user-center'
        process.env.JWT_AUDIENCE = 'xmax-services'
        await jest.unstable_mockModule('jsonwebtoken', () => ({
            default: {
                verify: jest.fn().mockReturnValue({
                    userId: 'b-user',
                    username: 'corp',
                    email: 'b@example.com',
                    userType: 'B',
                    type: 'access',
                    companyId: null,
                    roles: [],
                    permissions: [],
                }),
            },
        }))
        await jest.unstable_mockModule(path.join(repoRoot, 'config/whitelist.js'), () => ({
            isWhitelistPath: jest.fn().mockReturnValue(false),
        }))
        await jest.unstable_mockModule(path.join(repoRoot, 'src/proxy/routes.js'), () => ({
            getTargetService: jest.fn().mockReturnValue(null),
        }))
        const mod = await import('../../gateway/jwt_auth.js')
        jwtAuth = mod.default
    })

    it('在非白名单路径上应抛出 TOKEN_EXPIRED 语义错误（当前实现）', async () => {
        const ctx = {
            request: {
                path: '/api/v1/job-b/something',
                method: 'GET',
                headers: { authorization: 'Bearer valid-looking-token' },
            },
            state: { traceId: 't-regression-2' },
        }
        const next = jest.fn()

        await expect(jwtAuth(ctx, next)).rejects.toMatchObject({
            code: 401003,
            message: expect.stringMatching(/expired/i),
        })
        expect(next).not.toHaveBeenCalled()
    })
})

describe('gateway_auth.internalAuth — const userId 无法被 debug 覆盖（问题 1）', () => {
    let internalAuth

    beforeEach(async () => {
        jest.resetModules()
        await jest.unstable_mockModule(path.join(repoRoot, 'config/env.js'), () => ({
            default: {
                debug: {
                    enabled: true,
                    userId: 'debug-user-override',
                    userName: 'dbg',
                    userEmail: 'd@x.test',
                    userType: 'C',
                    userRoles: '',
                },
            },
        }))
        const mod = await import('../../gateway/gateway_auth.js')
        internalAuth = mod.internalAuth
    })

    it('在缺少 x-user-id 且开启 debug 时 internalAuth 会失败（const 二次赋值触发异常后被包装为 500）', async () => {
        const ctx = {
            headers: {},
            state: { traceId: 't-regression-3' },
            logger: { info: jest.fn(), error: jest.fn() },
        }
        ctx.throw = (status, msg) => {
            const err = new Error(msg)
            err.status = status
            throw err
        }
        const next = jest.fn()

        await expect(internalAuth(ctx, next)).rejects.toMatchObject({
            status: 500,
            message: 'Internal authentication failed',
        })
        expect(next).not.toHaveBeenCalled()
    })
})
