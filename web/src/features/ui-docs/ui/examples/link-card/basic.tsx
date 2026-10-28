import { Button, LinkCard } from "@violet/ui";
import { useRef, useState } from "react";

const logo = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" fill="#f0edf8"/><path d="m40 44 40 76 40-76H98l-18 36-18-36Z" fill="#684dda"/></svg>')}`;
const cover = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" viewBox="0 0 400 240"><rect width="400" height="240" fill="#dbe8e9"/><path d="m0 210 130-160 100 120 80-100 90 140v30H0Z" fill="#406c83"/><circle cx="310" cy="48" r="24" fill="#f7d58b"/></svg>')}`;

/** 独立资源展示完整图片、错误回退与内容更新，不调用预览 API。 */
export function LinkCardBasicDemo() {
	const [image, setImage] = useState("logo");
	const [version, setVersion] = useState(1);
	const [narrow, setNarrow] = useState(false);
	const [dark, setDark] = useState(false);
	const ref = useRef<HTMLAnchorElement>(null);
	const imageSrc =
		image === "logo"
			? logo
			: image === "cover"
				? cover
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
						imageAlt={image === "cover" ? "山间风景" : ""}
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
