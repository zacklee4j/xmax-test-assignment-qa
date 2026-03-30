/**
 * Minimal logger stub for gateway middleware imports (see docs/module-a-assignment.md).
 * jwt_auth 使用命名导出 `log`；gateway_auth 使用 default。
 * @param {string} _url
 */
export function log(_url) {
    const noop = () => {}
    return {
        info: noop,
        warn: noop,
        error: noop,
    }
}

const defaultLogger = {
    info: (...args) => console.debug('[logger]', ...args),
    warn: (...args) => console.warn('[logger]', ...args),
    error: (...args) => console.error('[logger]', ...args),
}

export default defaultLogger
