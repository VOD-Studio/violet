/** mock-data.mjs 的类型声明（契约 spec 以 ESM 导入共享路由表）。 */
export declare function handle(
	method: string,
	pathname: string,
	search?: string,
	cookie?: string,
): { status: number; body: string };
