import type { PostDetail } from "@entities/post/model/types";
import { formatDate } from "@shared/lib/date";
import { Popover, PopoverContent, PopoverTrigger, TextUnderline } from "@violet/ui";
import { useEffect, useRef, useState } from "react";

export interface RevisionChipProps {
	post: PostDetail;
	/** 未显示发布日期时独立呈现编辑日期。 */
	standalone?: boolean;
}

/** 悬停修订标记查看首次发布时间、最近编辑时间与修订次数。 */
export function RevisionChip({ post, standalone }: RevisionChipProps) {
	const [open, setOpen] = useState(false);
	const closeTimer = useRef<number>(0);

	const handleOpen = () => {
		window.clearTimeout(closeTimer.current);
		setOpen(true);
	};

	const handleClose = () => {
		window.clearTimeout(closeTimer.current);
		closeTimer.current = window.setTimeout(() => {
			setOpen(false);
		}, 120);
	};

	useEffect(() => () => window.clearTimeout(closeTimer.current), []);

	const count = post.edited_version_count ?? 1;
	const editedDate = post.edited_at ?? "";
	if (!editedDate) return null;

	const formattedEditDate = formatDate(editedDate, "long-date");

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="inline-flex cursor-pointer items-center gap-1.5 select-none bg-transparent p-0 font-inherit text-inherit"
					onMouseEnter={handleOpen}
					onMouseLeave={handleClose}
					onClick={(event) => event.preventDefault()}
				>
					{!standalone && <span className="text-muted-foreground/40">·</span>}
					<TextUnderline
						thickness={1}
						color="var(--primary)"
						className="text-xs text-muted-foreground/75 transition-colors hover:text-foreground"
					>
						{standalone ? `编辑于 ${formattedEditDate}` : "(已编辑)"}
					</TextUnderline>
				</button>
			</PopoverTrigger>
			<PopoverContent
				side="top"
				sideOffset={8}
				align="center"
				className="w-64 rounded-xl border border-border/80 bg-popover/95 p-3 text-popover-foreground shadow-[0_4px_24px_rgba(0,0,0,0.05)] backdrop-blur-md"
				onMouseEnter={handleOpen}
				onMouseLeave={handleClose}
			>
				<div className="flex items-center justify-between border-b border-border/50 pb-2">
					<span className="font-sans text-xs font-medium text-foreground">修订记录</span>
					<span className="font-mono text-[11px] text-muted-foreground">
						共 {count} 次
					</span>
				</div>
				<div className="mt-2.5 space-y-1.5 font-mono text-xs">
					{post.published_at ? (
						<div className="flex items-center justify-between text-muted-foreground">
							<span>首次发布</span>
							<span>{formatDate(post.published_at, "long-date")}</span>
						</div>
					) : null}
					<div className="flex items-center justify-between text-foreground">
						<span className="text-muted-foreground">最近编辑</span>
						<span className="font-medium">{formattedEditDate}</span>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
