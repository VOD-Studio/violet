import { Button, LinkCard } from "@violet/ui";
import { useRef, useState } from "react";

const LOGO_SRC = "/logo.png";
const COVER_SRC = "/ai-personas/unknown-cover.webp";

/** 独立资源展示完整图片、错误回退与内容更新，不调用预览 API。 */
export function LinkCardBasicDemo() {
	const [image, setImage] = useState("logo");
	const [version, setVersion] = useState(1);
	const [narrow, setNarrow] = useState(false);
	const [dark, setDark] = useState(false);
	const ref = useRef<HTMLAnchorElement>(null);
	const imageSrc =
		image === "logo"
			? LOGO_SRC
			: image === "cover"
				? COVER_SRC
				: image === "broken"
					? "data:image/png;base64,broken"
					: undefined;

	return (
		<div className={dark ? "dark" : undefined}>
			<div className="space-y-4 rounded-xl bg-background p-4 text-foreground">
				<div className="flex flex-wrap items-center gap-3">
					<label>
						图片：
						<select
							value={image}
							onChange={(event) => setImage(event.currentTarget.value)}
						>
							<option value="logo">Logo</option>
							<option value="cover">横向封面</option>
							<option value="broken">损坏图片</option>
							<option value="none">无图</option>
						</select>
					</label>
					<Button variant="outline" onClick={() => setNarrow(!narrow)}>
						切换宽窄
					</Button>
					<Button variant="outline" onClick={() => setDark(!dark)}>
						切换明暗
					</Button>
					<Button variant="outline" onClick={() => setVersion(version + 1)}>
						更新内容
					</Button>
					<Button variant="outline" onClick={() => ref.current?.focus()}>
						聚焦卡片
					</Button>
				</div>
				<div className="grid gap-3" style={{ maxWidth: narrow ? "18rem" : "36rem" }}>
					<LinkCard
						ref={ref}
						href={`https://example.com/guide?revision=${version}#native-links`}
						title={`组件设计指南 · 第 ${version} 版：保持原生链接交互和完整图片内容`}
						description="从原生语义开始，让封面、Logo、长标题和窄容器各自保持稳定，不依赖宿主补充卡片样式。"
						siteName="Example Journal"
						imageSrc={imageSrc}
						imageAlt={image === "cover" ? "抱着枕头的灰发角色插画" : ""}
					/>
					<LinkCard
						href="https://example.com/profile"
						title="y_defect的推文"
						description="@y_defect的推文"
						siteName="example.com"
					/>
				</div>
				<p className="text-sm text-muted-foreground">
					损坏图片退为文字卡；更新内容会重试，切回 Logo
					或封面会恢复图位。第二张卡的重复说明和站点名不会重复出现。Tab、Enter、Ctrl/Cmd
					点击与中键保持原生导航。
				</p>
			</div>
		</div>
	);
}
