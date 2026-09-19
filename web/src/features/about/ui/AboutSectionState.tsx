import styles from "./AboutSections.module.css";

interface AboutSectionStateProps {
	message: string;
	onRetry?: () => void;
	isRetrying?: boolean;
}

/** 在章节原位呈现可恢复的空态或错误态。 */
export function AboutSectionState({
	message,
	onRetry,
	isRetrying = false,
}: AboutSectionStateProps) {
	return (
		<div className={styles.state} role={onRetry ? "alert" : "status"}>
			<span>{message}</span>
			{onRetry ? (
				<button
					type="button"
					className={styles.stateAction}
					disabled={isRetrying}
					onClick={onRetry}
				>
					{isRetrying ? "正在重试" : "重新获取"}
				</button>
			) : null}
		</div>
	);
}
