import { useMemo } from 'react';

/**
 * Escape special regex characters.
 */
function escapeRegExp(string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Highlight @mentions in HTML content.
 * Matches against known user names for accurate highlighting.
 */
function highlightMentions(html, mentionableUsers = []) {
	if (!html) return '';
	
	// Build list of user names sorted by length (longest first for greedy matching)
	const userNames = mentionableUsers
		.map(u => u.name)
		.filter(Boolean)
		.sort((a, b) => b.length - a.length);
	
	let result = html;
	
	// Highlight @mentions by matching against known user names
	for (const name of userNames) {
		// Match @name exactly (case insensitive), followed by space, punctuation, tag, or end
		const pattern = new RegExp(`@${escapeRegExp(name)}(?=\\s|$|[.,!?;:]|<)`, 'gi');
		result = result.replace(pattern, `<span class="chat-mention">@${name}</span>`);
	}
	
	return result;
}

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
	startingHeadingLevel
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

	// Process content to highlight @mentions
	const highlightedContent = useMemo(() => {
		return highlightMentions(metadata.contentHtml, appConfig.mentionableUsers || []);
	}, [metadata.contentHtml, appConfig.mentionableUsers]);

	const commentNameString = useMemo(() => {
		const div = document.createElement('div');
		div.innerHTML = metadata.contentHtml;
		const text = div.textContent || div.innerText || '';
		const words = text.trim().split(/\s+/);
		const snippet = words.slice(0, 15).join(' ');
		const ellipsis = words.length > 15 ? '...' : '';
		return `${metadata.authorName} (${metadata.timestamp}) - "${snippet}${ellipsis}"`;
	}, [metadata.authorName, metadata.timestamp, metadata.contentHtml]);

	const HeadingTagname = ['1', '2', '3', '4', '5', '6'].includes(String(startingHeadingLevel)) ? `h${String(startingHeadingLevel)}` : 'h3';

	return (
		<div className="chat-message-content">
			<div className="chat-avatar">
				{metadata.avatarUrl && (
					<img 
						src={metadata.avatarUrl} 
						alt="" 
						width="40" 
						height="40"
						loading="lazy"
					/>
				)}
			</div>

			<div className="chat-bubble">
				<HeadingTagname
					id={`comment-${comment.id}`}
					tabindex="-1"
					className="chat-bubble-header"
				>
					<span className="chat-author-name">{metadata.authorName}</span>
					<span className="chat-timestamp"><span class="visually-hidden"> (</span>{metadata.timestamp}<span class="visually-hidden"> )</span></span>
				</HeadingTagname>

				<div
					className="chat-text"
					dangerouslySetInnerHTML={{ __html: highlightedContent }}
				/>

				<div className="chat-actions">
					{metadata.permalink && (
						<a
							href={metadata.permalink}
							class="chat-message-link"
						>Link<span class="visually-hidden">: {commentNameString}</span></a>
					)}

					{depth === 0 && (
						<>
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
									onClick={() => onReply({
										commentId: comment.id,
										authorName: metadata.authorName,
										contentHtml: metadata.contentHtml,
									})}
								>
									<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
										<path d="M8 15c4.418 0 8-3.134 8-7s-3.582-7-8-7-8 3.134-8 7c0 1.76.743 3.37 1.97 4.6-.097 1.016-.417 2.13-.771 2.966-.079.186.074.394.273.362 2.256-.37 3.597-.938 4.18-1.234A9.06 9.06 0 0 0 8 15z" />
									</svg>
									<span>Reply</span>
									<span class="visually-hidden"> to: <em>{commentNameString}</em></span>
								</button>

								{hasReplies && (
									<button
										className="chat-thread-toggle"
										data-comment-id={comment.id}
										aria-expanded={isExpanded}
										onClick={onToggleThread}
									>
										<span className="chat-reply-count">
											<span>Replies ({replyCount})</span>
											<span class="visually-hidden">: <em>{commentNameString}</em></span>
										</span>
										<span className="chat-toggle-arrow" aria-hidden="true">▸</span>
									</button>
								)}
							</>
						)}
						</>
					)}
				</div>
			</div>
		</div>
	);
}

export default ChatMessage;

