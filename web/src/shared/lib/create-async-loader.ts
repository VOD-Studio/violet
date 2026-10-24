/**
 * 创建按需初始化的异步加载器，合并并发调用并复用成功结果。
 *
 * @typeParam T - 工厂的成功结果，由工厂返回类型推断。
 * @param factory - 首次调用时执行的无参异步工厂。
 * @returns 稳定的加载函数；进行中与成功后均返回同一个 Promise。
 * @throws 工厂同步抛出时原样透传，不缓存该异常。
 * @remarks Promise 拒绝后清除缓存，由下一次显式调用重试；不自动重试，也不包装错误。
 * 每个加载器独立缓存，适合模块导入或单次初始化，不用于参数化业务查询。
 * 重新执行工厂不保证重新下载资源；浏览器的动态导入仍可能命中模块失败缓存。
 */
export function createAsyncLoader<T>(factory: () => Promise<T>): () => Promise<T> {
	let pending: Promise<T> | undefined;
	return () => {
		pending ??= factory().catch((error: unknown) => {
			pending = undefined;
			throw error;
		});
		return pending;
	};
}
