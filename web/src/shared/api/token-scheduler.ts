/**
 * token-scheduler - access token 主动静默刷新（单例，纯 JS，无 React 依赖）
 *
 * 设计目标：让绝大多数请求根本不会撞 401。登录/刷新成功后按 expires_in 设定时器，
 * 在 token 过期前 60s 主动 POST /auth/refresh 续期。
 *
 * 与响应式 401 拦截的关系（互补）：
 * - 主动刷新（本模块）：治本，减少 401 发生。
 * - 响应式刷新（http.ts 401 拦截器）：兜底，主动刷新失败/页面刚加载定时器还没建好时
 *   仍能恢复。两条路径都成功后重新 arm 定时器，保持链路不中断。
 *
 * 生命周期：
 * - 登录成功 → scheduleRefresh(expires_in)
 * - 每次刷新成功（主动或响应式）→ scheduleRefresh(new expires_in) 重新 arm
 * - 登出 / 刷新彻底失败 → clearRefresh()
 * - 页面刷新后定时器丢失 → 自动回退到响应式，无功能损失
 *
 * 仅客户端运行：SSR 不调度（typeof window 检查 + 调用方都在客户端路径）。
 */

/** 提前量：token 过期前这么多秒就主动刷新，留足网络往返余量 */
const REFRESH_LEAD_TIME_SECONDS = 60;

/** 安全下限：避免 expires_in 异常小（如 < 90s）导致定时器立即/负数触发 */
const MIN_REFRESH_DELAY_SECONDS = 30;

let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * doRefresh - 实际执行刷新的函数（由 http.ts 注入，避免循环依赖）
 *
 * 返回新的 expires_in（秒）供重新 arm；返回 null 表示刷新失败，调用方应清调度。
 * 注入实现复用 httpClient（带新 cookie），单飞由 triggerRefresh 保证。
 */
let doRefresh: (() => Promise<number | null>) | null = null;

/**
 * setRefresher - http 模块注册刷新实现
 *
 * @param fn 返回新 expires_in（秒）；失败返回 null
 */
export const setRefresher = (fn: (() => Promise<number | null>) | null): void => {
    doRefresh = fn;
};

/**
 * scheduleRefresh - 按 expires_in 设定时器，到期主动刷新并重新 arm
 *
 * @param expiresInSeconds access token 有效期（秒），来自 TokenResponse.expires_in
 */
export const scheduleRefresh = (expiresInSeconds: number): void => {
    // 仅客户端调度
    if (typeof window === "undefined") return;

    // 清掉旧的定时器（多次 arm 只保留最新一次）
    if (timer !== null) {
        clearTimeout(timer);
        timer = null;
    }

    // 计算延迟：提前 REFRESH_LEAD_TIME_SECONDS，但不小于安全下限
    const delaySeconds = Math.max(
        expiresInSeconds - REFRESH_LEAD_TIME_SECONDS,
        MIN_REFRESH_DELAY_SECONDS,
    );
    const delayMs = delaySeconds * 1000;

    timer = setTimeout(() => {
        timer = null;
        void proactiveRefresh();
    }, delayMs);
};

/**
 * proactiveRefresh - 定时器触发的主动刷新
 *
 * 成功 → 用新 expires_in 重新 arm；失败 → 清调度（交由响应式 401 拦截兜底，
 * 或最终弹登录窗）。
 */
const proactiveRefresh = async (): Promise<void> => {
    if (!doRefresh) return;
    try {
        const newExpiresIn = await doRefresh();
        if (newExpiresIn && newExpiresIn > 0) {
            scheduleRefresh(newExpiresIn);
        } else {
            // 刷新失败：不再 arm，后续请求撞 401 时由响应式链路处理
            clearRefresh();
        }
    } catch {
        clearRefresh();
    }
};

/**
 * clearRefresh - 清除主动刷新定时器（登出 / 刷新彻底失败时调用）
 */
export const clearRefresh = (): void => {
    if (timer !== null) {
        clearTimeout(timer);
        timer = null;
    }
};
