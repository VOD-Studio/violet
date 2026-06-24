/**
 * roleKeys - 角色与权限查询的 query key 工厂
 *
 * 用工厂模式集中管理 key，避免散落字符串导致缓存失效不彻底。
 * 子键按 roles/permissions 维度组织，便于按维度 invalidate。
 */
export const roleKeys = {
	/** 角色与权限模块根 key */
	all: ["admin-roles"] as const,
	/** 角色列表维度 */
	lists: () => [...roleKeys.all, "list"] as const,
	/** 角色列表查询（无额外参数，后端返回全量角色） */
	list: () => [...roleKeys.lists()] as const,
	/** 角色详情维度 */
	details: () => [...roleKeys.all, "detail"] as const,
	/**
	 * 具体角色详情
	 *
	 * @param id 角色 ID
	 */
	detail: (id: number) => [...roleKeys.details(), id] as const,
	/** 权限维度 */
	permissions: () => [...roleKeys.all, "permissions"] as const,
};
