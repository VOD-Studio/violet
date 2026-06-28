import type { AxiosRequestConfig, AxiosResponse } from "axios";
import { ApiError } from "./error";

/**
 * authGate - 鉴权降级编排器（单例，纯 JS，无 React 依赖）
 *
 * 解决"refresh 失败后既不弹登录、请求又直接 reject"的断链问题。
 *
 * 职责链：
 *   1. refresh 失败时，http 拦截器不再直接抛错，而是调用 requestReplay(config)
 *      把原请求挂起，并把控制权交还用户（弹窗登录）。
 *   2. 用户在 LoginDialog 重新登录成功 → 调用 flush()，用新 cookie 批量重放
 *      所有挂起请求，各自的 deferred 按真实结果 resolve/reject。
 *   3. 用户取消登录 → 调用 rejectAll()，所有挂起请求以 401 拒绝。
 *
 * 依赖注入（避免循环依赖）：
 *   - http.ts 注入 replayer：如何用 axios 实例重放一个 config
 *   - LoginDialog 注入 opener：如何打开登录弹窗（store.open）
 *
 * SSR 防护：SSR 端不注册 replayer/opener，requestReplay 直接抛 401，
 * 让 SSR 调用方拿到失败（与 refresh-queue.ts 的 SSR 策略一致）。
 */

/** 挂起的请求条目：原 config + 控制其 resolve/reject 的 deferred */
interface PendingRequest {
    config: AxiosRequestConfig;
    resolve: (res: AxiosResponse) => void;
    reject: (err: unknown) => void;
}

/** replayer：把一个 config 重新发给 axios（由 http.ts 注入） */
type Replayer = (config: AxiosRequestConfig) => Promise<AxiosResponse>;
/** opener：打开登录弹窗（由 LoginDialog 注入，通常 = store.open） */
type Opener = () => void;

let replayer: Replayer | null = null;
let opener: Opener | null = null;

/** 挂起队列 */
let pending: PendingRequest[] = [];
/** 弹窗是否已打开（避免并发 401 触发多次 open） */
let dialogOpen = false;

/**
 * setReplayer - http 拦截器注册重放函数
 *
 * 客户端实例创建后注入 client.request；SSR 不调用此方法。
 */
export const setReplayer = (fn: Replayer | null): void => {
    replayer = fn;
};

/**
 * setOpener - 登录弹窗组件注册开门回调
 *
 * LoginDialog 挂载时注入 store.open，卸载时传 null 解绑。
 */
export const setOpener = (fn: Opener | null): void => {
    opener = fn;
};

/**
 * requestReplay - refresh 失败后挂起原请求，等待重新登录后重放
 *
 * 由 http.ts 的 401 失败分支调用：
 *   - SSR（无 replayer）→ 直接抛 401，调用方自行处理
 *   - 客户端 → 推入挂起队列；首个挂起请求触发 opener 开弹窗
 *   - 返回 deferred.promise：axios 拦截器直接 return，
 *     登录成功（flush）或取消（rejectAll）后才会 settle
 *
 * @param config 失败请求的原 config
 * @returns 登录后会 resolve/reject 的 promise
 */
export const requestReplay = (config: AxiosRequestConfig): Promise<AxiosResponse> => {
    // SSR 兜底：没有 replayer 说明不在客户端，挂起重放无意义
    if (!replayer) {
        return Promise.reject(
            new ApiError({
                error: "UNAUTHORIZED",
                message: "登录已失效，请重新登录",
                status: 401,
            }),
        );
    }

    return new Promise<AxiosResponse>((resolve, reject) => {
        pending.push({ config, resolve, reject });
        // 仅在弹窗未开时开门，避免并发 401 重复弹窗
        if (!dialogOpen && opener) {
            dialogOpen = true;
            opener();
        }
    });
};

/**
 * flush - 重新登录成功后，用新 cookie 批量重放所有挂起请求
 *
 * 由 LoginDialog 的登录成功回调调用。每个 config 重放前打 __retried 标记，
 * 防止重放请求再次 401 时又回到 requestReplay 形成死循环——
 * 重放若再失败会按正常错误流（归一化为 ApiError）抛出。
 *
 * 重放期间新产生的 401（来自尚未重放的并发请求）会继续入队，
 * 但 dialogOpen 已置 false，flush 完成后若有残留 pending 会再次开门。
 */
export const flush = async (): Promise<void> => {
    // 捕获到局部常量：闭包内（async map 回调）CFA 无法窄化模块级变量
    const replay = replayer;
    if (!replay) return;

    const batch = pending;
    pending = [];
    dialogOpen = false;

    await Promise.all(
        batch.map(async (req) => {
            try {
                // 打标记：重放再 401 时拦截器直接抛错，不二次入队
                req.config.__retried = true;
                const res = await replay(req.config);
                req.resolve(res);
            } catch (err) {
                req.reject(err);
            }
        }),
    );

    // 若重放期间又有新请求入队（极端并发），递归处理
    if (pending.length > 0 && opener && !dialogOpen) {
        dialogOpen = true;
        opener();
    }
};

/**
 * rejectAll - 用户取消登录时，批量拒绝所有挂起请求
 *
 * 由 LoginDialog 的 onOpenChange(false) 调用。
 * 清空队列并重置弹窗状态，使后续 401 能重新开门。
 *
 * @param error 拒绝原因（默认 401 AUTH_REQUIRED）
 */
export const rejectAll = (
    error: ApiError = new ApiError({
        error: "UNAUTHORIZED",
        message: "需要重新登录才能继续",
        status: 401,
    }),
): void => {
    const batch = pending;
    pending = [];
    dialogOpen = false;
    for (const req of batch) {
        req.reject(error);
    }
};
