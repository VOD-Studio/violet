import { createContext } from "react";
import type { ChatAppearance } from "./appearance";

/** 允许会话把消息发送者追加进外层侧栏的用户集合。 */
export interface ChatAppearanceScope {
	/** 该查询缓存归属的账号;登录切换后绝不复用。 */
	currentUserID: string;
	/** 当前 scope 及其祖先已请求过的用户 ID。 */
	coveredIDs: ReadonlySet<string>;
	/** 按发送者 ID 索引的公开外观。 */
	values: Readonly<Record<string, ChatAppearance>>;
}

/** 默认 null:聊天组件单测/故事渲染时可脱离 Provider 独立运行。 */
export const ChatAppearanceContext = createContext<ChatAppearanceScope | null>(null);
