/**
 * Chat Header Component
 */
function ChatHeader({ commentCount }) {
	return (
		<div className="chat-header">
			<div className="chat-header-icon">💬</div>
			<div className="chat-header-title">
				{commentCount === 1 ? '1 Comment' : `${commentCount} Comments`}
			</div>
		</div>
	);
}

export default ChatHeader;

