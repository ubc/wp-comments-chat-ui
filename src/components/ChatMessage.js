import { useMemo } from 'react';

/**
 * Chat Message Component
 */
function ChatMessage({
	comment,
	depth,
	hasReplies,
	replyCount,
	isExpanded,
	hasNewMessages,
	onToggleThread,
	onReply,
	appConfig,
}) {
	const metadata = useMemo(() => {
		const base = {
			authorName: '',
			timestamp: '',
			contentHtml: '',
			avatarUrl: '',
			avatarAlt: '',
			isPostAuthor: false,
			permalink: '',
		};

		if (!comment.meta) {
			return base;
		}

		return {
			...base,
			...comment.meta,
		};
	}, [comment.meta]);

	return (
		<div className="chat-message-content">
			<div className="chat-avatar" aria-hidden="true">
				{metadata.avatarUrl && (
					<img 
						src={metadata.avatarUrl} 
						alt={metadata.avatarAlt} 
						width="40" 
						height="40"
						loading="lazy"
					/>
				)}
			</div>

			<div className="chat-bubble">
				<div className="chat-bubble-header">
					<span className="chat-author-name">
						{metadata.authorName}
					</span>
					<span className="chat-timestamp">
						{metadata.permalink ? (
							<a href={metadata.permalink}>{metadata.timestamp}</a>
						) : (
							metadata.timestamp
						)}
					</span>
				</div>

				<div
					className="chat-text"
					dangerouslySetInnerHTML={{ __html: metadata.contentHtml }}
				/>

				{depth === 0 && (
					<div className="chat-actions">
						{hasReplies && (
							<button
								className="chat-thread-toggle"
								data-comment-id={comment.id}
								aria-expanded={isExpanded}
								aria-label={isExpanded ? "Collapse replies" : "Expand replies"}
								onClick={onToggleThread}
							>
								<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
									<path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
								</svg>
								<span className="chat-reply-count">
									{replyCount === 1 ? '1 reply' : `${replyCount} replies`}
								</span>
								<span className="chat-toggle-arrow" aria-hidden="true">▸</span>
							</button>
						)}

						{appConfig.commentsOpen !== false && (
							<>
								{hasNewMessages && (
									<span
										className="chat-new-message-indicator"
										style={{
											display: 'inline-flex',
											visibility: 'visible',
											opacity: 1,
										}}
									>
										New
									</span>
								)}
								<button
									className="chat-reply-button"
									data-comment-id={comment.id}
									data-author={metadata.authorName}
									aria-label={`Reply to ${metadata.authorName}`}
									onClick={() => onReply({
										commentId: comment.id,
										authorName: metadata.authorName,
										contentHtml: metadata.contentHtml,
									})}
								>
									<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
										<path d="M8 15c4.418 0 8-3.134 8-7s-3.582-7-8-7-8 3.134-8 7c0 1.76.743 3.37 1.97 4.6-.097 1.016-.417 2.13-.771 2.966-.079.186.074.394.273.362 2.256-.37 3.597-.938 4.18-1.234A9.06 9.06 0 0 0 8 15z" />
									</svg>
									Reply
								</button>
							</>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

export default ChatMessage;

