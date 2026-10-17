import { getCommentAuthorPresentation } from "@entities/comment/lib/ai-personas";
import { CommentAuthorAvatar } from "@entities/comment/ui/CommentAuthorAvatar";
import type { AnnotationAuthorFilter, BlockAuthor, BlockCount } from "../model/types";

const MARKER_AVATAR_MAX = 3;

/** 正文边距中的评论者角标，按原始署名与 AI 来源选择批注。 */
export interface AnnotationMarkerProps {
	block: BlockCount;
	top: number;
	/** undefined 未展开；null 显示全部；对象只看该身份。 */
	activeAuthor: AnnotationAuthorFilter | undefined;
	onSelect: (author: AnnotationAuthorFilter, anchorEl: HTMLElement) => void;
}

export function AnnotationMarker({ block, top, activeAuthor, onSelect }: AnnotationMarkerProps) {
	const authors = block.authors ?? [];
	const shown = authors.slice(0, MARKER_AVATAR_MAX);
	const extra = authors.length - shown.length;
	const label = `${block.count} 条批注`;
	return (
		<div
			data-annotation-blockid={block.block_id}
			style={{ top }}
			className="annotation-marker pointer-events-auto absolute"
		>
			<button
				type="button"
				aria-label={label}
				aria-pressed={activeAuthor !== undefined}
				title={label}
				onClick={(event) => onSelect(null, event.currentTarget)}
				className="annotation-marker-mobile"
				data-active={activeAuthor !== undefined ? "true" : undefined}
			>
				<span className="inline-flex -space-x-1.5" aria-hidden="true">
					{shown.map((author) => (
						<CommentAuthorAvatar
							key={`${author.is_ai ? "ai" : "user"}:${author.name}`}
							name={author.name}
							avatarUrl={author.avatar_url}
							isAI={!!author.is_ai}
							className="size-5 text-[9px]"
						/>
					))}
				</span>
				<span>{label}</span>
			</button>
			{authors.length === 0 ? (
				<button
					type="button"
					aria-label={label}
					aria-pressed={activeAuthor !== undefined}
					title={label}
					onClick={(event) => onSelect(null, event.currentTarget)}
					className="annotation-avatar"
					data-active={activeAuthor !== undefined ? "true" : undefined}
				>
					{block.count}
				</button>
			) : (
				shown.map((author, index) => (
					<MarkerAvatar
						key={`${author.is_ai ? "ai" : "user"}:${author.name}`}
						author={author}
						index={index}
						isActive={
							activeAuthor != null &&
							activeAuthor.name === author.name &&
							activeAuthor.is_ai === !!author.is_ai
						}
						onClick={(element) =>
							onSelect({ name: author.name, is_ai: !!author.is_ai }, element)
						}
					/>
				))
			)}
			{extra > 0 && (
				<button
					type="button"
					aria-label={label}
					aria-pressed={activeAuthor === null}
					title={label}
					onClick={(event) => onSelect(null, event.currentTarget)}
					className="annotation-avatar"
					data-active={activeAuthor === null ? "true" : undefined}
				>
					+{extra}
				</button>
			)}
		</div>
	);
}

interface MarkerAvatarProps {
	author: BlockAuthor;
	index: number;
	isActive: boolean;
	onClick: (anchorEl: HTMLElement) => void;
}

function MarkerAvatar({ author, index, isActive, onClick }: MarkerAvatarProps) {
	const { displayName, personaId } = getCommentAuthorPresentation({
		author_name: author.name,
		avatar_url: author.avatar_url,
		is_ai: author.is_ai,
	});
	const label = author.is_ai ? `${displayName}（AI）的批注` : `${displayName} 的批注`;
	return (
		<span
			className="annotation-avatar-wrap relative inline-flex shrink-0"
			style={{ zIndex: MARKER_AVATAR_MAX - index }}
		>
			<button
				type="button"
				aria-label={label}
				aria-pressed={isActive}
				title={label}
				onClick={(event) => onClick(event.currentTarget)}
				className="annotation-avatar"
				data-active={isActive ? "true" : undefined}
				data-annotation-author={JSON.stringify({
					name: author.name,
					is_ai: !!author.is_ai,
				})}
				data-ai={author.is_ai ? "true" : undefined}
				data-ai-persona={personaId}
			>
				<CommentAuthorAvatar
					name={author.name}
					avatarUrl={author.avatar_url}
					isAI={!!author.is_ai}
					className="size-full bg-transparent text-[9px]"
				/>
			</button>
		</span>
	);
}
