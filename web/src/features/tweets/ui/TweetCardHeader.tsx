import type { TweetAuthor } from "@entities/tweet/model/types";
import { formatDateTime, formatRelativeTime } from "@shared/lib/date";
import { avatarUrl } from "@shared/lib/image-url";
import { Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";

/** 本站作者、发布时间及可选删除入口。 */
export interface TweetCardHeaderProps {
	/** 本站作者资料。 */
	author: TweetAuthor;
	/** 详情页的本站推文标识。 */
	tweetId: string;
	/** 推文创建时间。 */
	createdAt: string;
	/** 详情卡在底部展示完整时间。 */
	isDetail?: boolean;
	/** 缺省时不显示删除入口，权限由调用方判定。 */
	onDelete?: () => void;
}

/** 复用推文包的作者布局，所有作者与时间链接留在本站。 */
export function TweetCardHeader({
	author,
	tweetId,
	createdAt,
	isDetail = false,
	onDelete,
}: TweetCardHeaderProps) {
	return (
		<header className="v-tweet__header">
			<div className="v-tweet__identity">
				<Link
					to="/users/$username"
					params={{ username: author.username }}
					onClick={(event) => event.stopPropagation()}
					className="v-tweet__avatar-link"
					aria-label={`${author.username} 的个人主页`}
				>
					<img
						src={avatarUrl(author.avatar_url, author.username)}
						alt=""
						loading="lazy"
						className="v-tweet__avatar"
					/>
				</Link>
				<div className="v-tweet__author">
					<Link
						to="/users/$username"
						params={{ username: author.username }}
						onClick={(event) => event.stopPropagation()}
						className="v-tweet__name truncate"
					>
						{author.username}
					</Link>
					{!isDetail && (
						<Link
							to="/tweets/$id"
							params={{ id: tweetId }}
							onClick={(event) => event.stopPropagation()}
							className="v-tweet__handle"
						>
							<time dateTime={createdAt} title={formatDateTime(createdAt, "long")}>
								{formatRelativeTime(new Date(createdAt))}
							</time>
						</Link>
					)}
				</div>
			</div>
			{onDelete && (
				<button
					type="button"
					aria-label="删除推文"
					className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
					onClick={(event) => {
						event.stopPropagation();
						onDelete();
					}}
				>
					<Trash2 className="size-4" />
				</button>
			)}
		</header>
	);
}
