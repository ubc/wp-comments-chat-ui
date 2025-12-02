/**
 * Chat Header Component
 */
function ChatHeader({ commentCount }) {
	return (
		<div className="chat-header">
			<div className="chat-header-icon" aria-hidden="true">💬</div>
			<h2 className="chat-header-title">
				{commentCount === 1 ? '1 Message' : `${commentCount} Messages`}
			</h2>
		</div>
	);
}

export default ChatHeader;
