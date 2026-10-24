import { useSettings } from "@features/settings/api/queries";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { type ReactNode, useState } from "react";

/** 实际展示 Google 登录或账号绑定操作的子树。 */
export interface GoogleOAuthGateProps {
	/** 将加载失败提示放在操作区内，不替换或重新挂载表单。 */
	children: (error: ReactNode) => ReactNode;
}

/**
 * 为实际提供 Google 登录或绑定操作的区域准备 SDK，不挂在全站阅读壳层。
 *
 * @remarks 公开配置优先于构建配置；缺失时使用占位 ID 保持 Provider 可挂载，
 * 操作入口仍由 `useOAuthVisibility` 隐藏。
 */
export function GoogleOAuthGate({ children }: GoogleOAuthGateProps) {
	const { data: settings } = useSettings();
	const [hasScriptError, setHasScriptError] = useState(false);
	const clientId =
		settings?.google_client_id || import.meta.env.VITE_GOOGLE_CLIENT_ID || "missing_client_id";
	return (
		<GoogleOAuthProvider clientId={clientId} onScriptLoadError={() => setHasScriptError(true)}>
			{children(
				hasScriptError ? (
					<p role="alert" className="text-sm text-destructive">
						Google 登录组件加载失败，请使用其他登录方式或刷新页面重试。
					</p>
				) : null,
			)}
		</GoogleOAuthProvider>
	);
}
