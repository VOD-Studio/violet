/** GitHub 仓库数据 */
export interface Repo {
	/** 仓库名 */
	name: string;
	/** 仓库描述 */
	description: string;
	/** 仓库链接 */
	url: string;
	/** 主语言 */
	language: string;
	/** star 数 */
	stars: number;
	/** fork 数 */
	forks: number;
	/** 是否置顶 */
	pinned: boolean;
}
