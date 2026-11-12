# Comment 评论

`CommentItem`、`CommentHeader`、`CommentList` 与 `CommentReplies` 是可组合的评论展示单元。文章、推文或其他宿主共用同一套结构与 BEM 样式；请求、登录、分页、审核权限、排序查询、回复会话和草稿均由宿主持有。

## 公开入口与样式

```tsx
import {
	CommentHeader,
	CommentItem,
	CommentList,
	CommentReplies,
	type CommentHeaderProps,
	type CommentItemProps,
	type CommentListProps,
	type CommentRepliesProps,
	type CommentSort,
	type CommentStatus,
} from "@violet/ui/comment";
```

完整样式入口为 `@violet/ui/styles.css`。按需消费先加载 `@violet/ui/tokens.css`，再加载 `@violet/ui/components/comment.css`；后者包含内部 Button、Segmented 与头像槽使用的 Avatar 样式。`actions`、`replyForm`、`badges` 和 `replies` 中其他组件的样式仍由对应单元提供，例如 `ReactionBar` 的叶子 CSS。

## 结构与状态所有权

| 组件 | 根节点与契约 |
| --- | --- |
| `CommentHeader` | 原生 `header`。`title` 可传标题元素；SDK 不猜测页面标题层级。`count` 为已知总数，`0` 也显示，省略则不显示。 |
| `CommentList` | 原生 `ol`，直接 children 必须是宿主提供的 `li`。只处理列表间距，不插入空态、加载或错误面板。 |
| `CommentItem` | 原生 `article`，内部以 `header` 标记作者元信息，以 `time[dateTime]` 标记时间；`children` 为正文。 |
| `CommentReplies` | 原生 `ol`，直接 children 同样由宿主提供 `li`，添加 16px 缩进与 1px 引导线。不会截取、折叠或重新排序回复。 |

四个根节点均保留原生属性、`className`、`style` 和 `ref`。列表不会克隆或包装传入的子节点。宿主应保留稳定 key，加载更多与失败重试等状态放在自己的语义容器内，不能把普通 `div` 直接放进 `ol`。

### CommentItem 属性

| 属性 | 契约 |
| --- | --- |
| `author`、`avatar` | 必填展示槽。作者链接、个人页路由、身份来源和图片请求由宿主管理。头像可用 Avatar、图片或链接，顶层占 36px，`reply` 时占 28px。作者名已经在旁边时，头像宜传 `alt=""`，不重复播报。 |
| `dateTime`、`time` | 必填；前者为机器可读时间，后者为宿主生成的相对时间文案。SDK 不启动时间刷新定时器。 |
| `replyTo` | 可选回复目标名字，显示为「回复 @名字」，不在 SDK 内解析用户标识或发起提及请求。 |
| `badges` | 元信息行的附加展示槽，如宿主自己的身份来源标记。 |
| `isAuthor` | 默认 `false`。显示作者环、装饰皇冠和「作者」标签，并使用作者配色。传入 Avatar 时不要再传它自己的 `ring` 或 `crown`，避免重复标记。 |
| `reply` | 默认 `false`。只改变头像尺寸与横向间距，不限制宿主的回复模型。 |
| `status` | `"visible"`（默认）、`"pending"` 或 `"deleted"`，详见下表。 |
| `actions` | 放入真实 `ReactionBar` 与其他操作。组件不生成第二套独立点赞按钮或计数，也不改写槽内的回调。 |
| `onReply` | 回复按钮的切换意图。省略则不渲染回复按钮，不放空回调占位。 |
| `replyForm` | 受控表单槽。出现时聚焦首个可编辑输入；关闭时遵循下文的焦点归还规则。提交、关闭、错误、忙碌和草稿仍由宿主控制。 |
| `replies` | 回复列表或宿主自己的回复加载区。删除态仍保留此槽，不连带隐藏仍可见的回复。 |
| `enterDelay` | 默认 `0`，单位毫秒。展开回复可按本次新增批次的序号传 `index * 40`，不累计历史页；预览与刚提交的回复不增加错峰。系统或宿主 reduce 时忽略。 |

| `status` | 实际输出 |
| --- | --- |
| `visible` | 正常正文、操作与受控表单。 |
| `pending` | 正文透明度 0.6，元信息明确显示「待审核 · 仅自己可见」。**宿主必须先完成权限筛选**，这个状态不是访问控制。 |
| `deleted` | 不挂载原文、`actions`、回复按钮和 `replyForm`，改为「这条评论已删除」。保留 article、作者时间与 replies 的位置。 |

### 排序

`CommentHeader` 的 `sort` 为 `"latest" | "hot"`，默认 `"latest"`。只有提供 `onSortChange` 时才渲染真实 `Segmented`，选项为「最新 / 最热」，可访问名称为「评论排序」。保留 Segmented 的 radio 语义、唯一 Tab 停靠位与方向键行为。

排序是完全受控的意图：宿主接到回调后更新 `sort`，让该值参与查询参数与查询缓存键。SDK 不拿当前页 children 冒充完整热度排序，也不会在回调之后自行改选中值。

## 受控回复与焦点

- 激活「回复」仅调用 `onReply`，不会自己插入表单或维护一份展开状态。
- 非空 `replyForm` 挂载时，焦点进入其中首个可编辑的文本 `input`、`textarea` 或 `contenteditable`；复选框、提交等非文本输入，以及隐藏、禁用、只读和 hidden / inert / aria-hidden 区域会被跳过。没有可编辑内容时保留当前焦点。
- 表单的普通重渲染不重新聚焦。异步编辑器若晚于表单外壳就绪，其就绪焦点应由宿主处理；SDK 不延迟等待并在用户离开后抢焦点。
- 组件不内置「取消」按钮：再次激活「回复」即关闭表单；宿主也可以在自己的入口直接关闭 `replyForm`，都沿用同一归还规则，焦点回到原「回复」按钮。
- 宿主提交成功等其他原因关闭时，只有焦点仍属于被卸载的表单才归还入口；焦点已进入别处、主动 blur 到空白、点击表单外空白或窗口失焦后，关闭不再抢回。
- 回复按钮用 `aria-expanded` 表达宿主当前表单状态；表单出现时通过稳定的 `aria-controls` 关联其容器。按钮保留原生 Enter / Space 行为，聚焦环四边完整。

## 组合示例

以下示例只承接宿主提供的真实数据与提交回调，不模拟 API，也不存第二份回应数据。`onToggleReaction` 应执行宿主自己的受控更新；`onSubmitReply` 完成成功提交后才关闭表单，异常继续交由宿主的表单状态处理。

```tsx
import { useState } from "react";
import {
	Avatar,
	CommentHeader,
	CommentItem,
	CommentList,
	CommentReplies,
	ReactionBar,
	type CommentSort,
	type ReactionItem,
} from "@violet/ui";

interface CommentExampleProps {
	sort: CommentSort;
	onSortChange: (sort: CommentSort) => void;
	reactions: readonly ReactionItem[];
	onToggleReaction: (id: string) => void;
	onSubmitReply: (body: string) => Promise<void>;
}

function CommentExample({
	sort,
	onSortChange,
	reactions,
	onToggleReaction,
	onSubmitReply,
}: CommentExampleProps) {
	const [replying, setReplying] = useState(false);
	let replyForm = null;
	if (replying) {
		replyForm = (
			<form
				onSubmit={async (event) => {
					event.preventDefault();
					const body = String(new FormData(event.currentTarget).get("body") ?? "");
					await onSubmitReply(body);
					setReplying(false);
				}}
			>
				<label>
					回复林间
					<textarea name="body" required />
				</label>
				<button type="submit">发送回复</button>
			</form>
		);
	}

	return (
		<section aria-label="评论">
			<CommentHeader title={<h2>评论</h2>} count={2} sort={sort} onSortChange={onSortChange} />
			<CommentList aria-label="评论列表">
				<li>
					<CommentItem
						author="林间"
						avatar={<Avatar name="林间" alt="" />}
						dateTime="2026-11-12T08:00:00Z"
						time="2 小时前"
						actions={<ReactionBar items={reactions} onToggle={onToggleReaction} />}
						onReply={() => setReplying(!replying)}
						replyForm={replyForm}
						replies={
							<CommentReplies aria-label="林间的回复">
								<li>
									<CommentItem
										author="作者"
										avatar={<Avatar name="作者" alt="" />}
										dateTime="2026-11-12T09:00:00Z"
										time="1 小时前"
										replyTo="林间"
										isAuthor
										reply
									>
										谢谢，已补上说明。
									</CommentItem>
								</li>
							</CommentReplies>
						}
					>
						这一段可以再解释一下吗？
					</CommentItem>
				</li>
			</CommentList>
		</section>
	);
}
```

## 视觉与动效

唯一视觉源为 `comment.css`。气泡内边距为 `8px 12px`，圆角为 `4px 14px 14px 14px`；普通气泡使用 `muted` 凹陷材质，作者气泡为 `decoration` 的 10% 与 `card` 混色。作者环位于图片外，2px 纸色间隔后接 2px `decoration` 边框，不使用 box-shadow；右上 18px 皇冠对读屏隐藏。皇冠与环使用装饰色，作者文字与标签使用对应可读强调语义 `link`，不写固定金色。

时间使用宿主 `--font-mono` 或系统等宽字体、12px 与等宽数字。操作高 28px，只提供颜色反馈，不缩放。正文按自身内容自然撑开，长文字可换行；组件不裁掉焦点环。

每条只做 180ms 透明度入场，不做位移；`enterDelay` 可用于展开回复的 40ms 错峰。`prefers-reduced-motion: reduce`、组件自身或祖先的 `data-motion="reduce"` 下直接出现，无入场与错峰。排序器、回应条和宿主编辑器分别沿用其自身的减弱动态契约。

## 验收边界

就近行为测试覆盖列表/article/header/time 语义、状态正文与操作隐藏、真实槽回调、受控排序、回复输入与 contenteditable 聚焦、切换/受控关闭归还、重渲染不重聚焦，以及离开后关闭不抢焦点。真实浏览器仍需检查窄屏、明暗与季节、头像环间隔、完整焦点环、180ms 入场及两种 reduce；包入口、CSS 依赖闭合和独立 tarball 消费由最终集成验证覆盖，本文不作为执行通过的证据。
