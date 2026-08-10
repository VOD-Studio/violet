/**
 * onSessionExpired - 会话失效时清理 auth 客户端状态的回调槽
 *
 * http 401 拦截器（shared 层）不能直接 import features/auth 的 query key
 * （违反 FSD shared ← features 依赖方向），故用回调注册解耦：
 * features/auth 在 queries.ts 加载时注册真正的缓存清理函数（clearAuthCache），
 * 401 拦截器调 onSessionExpired 触发。
 *
 * 未注册时为 noop，保证 shared 层无 features 依赖也能独立编译运行。
 */
type SessionExpiredHandler = () => void;

let handler: SessionExpiredHandler | null = null;

export const registerSessionExpiredHandler = (fn: SessionExpiredHandler): void => {
	handler = fn;
};

export const onSessionExpired = (): void => {
	handler?.();
};
