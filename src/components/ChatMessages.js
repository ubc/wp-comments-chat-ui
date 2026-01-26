import ChatMessage from './ChatMessage';
import ChatThread from './ChatThread';

/**
 * Chat Messages Component - Recursively renders messages and threads
 */
function ChatMessages({
	comment,
	commentsByParent,
	depth = 0,
	expandedThreads,
	threadsWithNewMessages,
	onToggleThread,
	onReply,
	appConfig,
	startingHeadingLevel = 3
}) {
	const replies = commentsByParent[comment.id] || [];
	const hasReplies = replies.length > 0;
	const commentIdNum = comment.id;
	const isExpanded = expandedThreads.has(commentIdNum);
	const hasNewMessages = threadsWithNewMessages.has(commentIdNum);

	return (
		<li
			className={`chat-message ${depth > 0 ? 'chat-message-reply' : ''}`}
			data-comment-id={comment.id}
		>
			<ChatMessage
				comment={comment}
				depth={depth}
				hasReplies={hasReplies}
				replyCount={replies.length}
				isExpanded={isExpanded}
				hasNewMessages={hasNewMessages}
				onToggleThread={() => onToggleThread(comment.id)}
				onReply={onReply}
				appConfig={appConfig}
				startingHeadingLevel={startingHeadingLevel}
			/>

			{hasReplies && depth === 0 && (
				<ChatThread
					parentId={comment.id}
					replies={replies}
					commentsByParent={commentsByParent}
					isExpanded={isExpanded}
					expandedThreads={expandedThreads}
					threadsWithNewMessages={threadsWithNewMessages}
					onToggleThread={onToggleThread}
					onReply={onReply}
					appConfig={appConfig}
				/>
			)}
		</li>
	);
}

export default ChatMessages;

