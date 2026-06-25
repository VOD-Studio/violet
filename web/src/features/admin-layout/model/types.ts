/**
 * admin-layout 类型定义
 *
 * 后台管理导航与布局相关的类型。
 */

/**
 * AdminNavItem - 后台侧边栏导航项
 */
export interface AdminNavItem {
	/** 显示文案 */
	label: string;
	/** 路由路径 */
	to: string;
	/** Lucide 图标名称 */
	icon: string;
}
