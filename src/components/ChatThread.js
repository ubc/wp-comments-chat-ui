import ChatMessages from './ChatMessages';

/**
 * Chat Thread Component - Renders nested replies
 */
function ChatThread({
	parentId,
	replies,
	commentsByParent,
	isExpanded,
	expandedThreads,
	threadsWithNewMessages,
	onToggleThread,
	onReply,
	appConfig,
}) {
	return (
		<div 
			className={`chat-thread ${isExpanded ? 'chat-thread-expanded' : ''}`}
			data-parent-id={parentId}
		>
			<h4 class="visually-hidden">Replies</h4>

			<ul>
				{replies.map(reply => (
					<ChatMessages
						key={reply.id}
						comment={reply}
						commentsByParent={commentsByParent}
						depth={1}
						expandedThreads={expandedThreads}
						threadsWithNewMessages={threadsWithNewMessages}
						onToggleThread={onToggleThread}
						onReply={onReply}
						appConfig={appConfig}
						startingHeadingLevel={5}
					/>
				))}
			</ul>
		</div>
	);
}

export default ChatThread;

