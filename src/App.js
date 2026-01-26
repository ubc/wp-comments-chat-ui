import { useState, useCallback, useRef, useEffect } from 'react';
import ChatHeader from './components/ChatHeader';
import ChatMessages from './components/ChatMessages';
import ChatForm from './components/ChatForm';
import EmptyState from './components/EmptyState';
import LoginPrompt from './components/LoginPrompt';
import useComments from './hooks/useComments';

/**
 * Main Chat App Component
 */
function App({ initialData, appConfig }) {
	const {
		commentsByParent,
		topLevelComments,
		commentCount,
		expandedThreads,
		threadsWithNewMessages,
		submitComment,
		toggleThread,
		hasComments,
	} = useComments(initialData, appConfig);

	const [replyingTo, setReplyingTo] = useState(null);
	const messagesContainerRef = useRef(null);

	const scrollToBottom = useCallback((smooth = false) => {
		if (messagesContainerRef.current) {
			messagesContainerRef.current.scrollTo({
				top: messagesContainerRef.current.scrollHeight,
				behavior: smooth ? 'smooth' : 'auto'
			});
		}
	}, []);

	// Initial scroll to bottom
	useEffect(() => {
		setTimeout(() => scrollToBottom(false), 100);
	}, [scrollToBottom]);

	const handleSubmitComment = useCallback(async ({ content, parentId }) => {
		try {
			await submitComment({ content, parentId });

			// If it's a top-level comment, scroll to bottom
			if (!parentId) {
				setTimeout(() => scrollToBottom(true), 100);
			}
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(error);
			// Ideally show a toast or error message here
		}
	}, [submitComment, scrollToBottom]);

	if (!appConfig.isLoggedIn) {
		return (
			<div className="chat-comments-container">
				<ChatHeader commentCount={commentCount} />
				<LoginPrompt loginUrl={appConfig.loginUrl} />
			</div>
		);
	}

	return (
		<div className="chat-comments-container">
			<ChatHeader commentCount={commentCount} />

			<ul
				className="chat-messages"
				ref={messagesContainerRef}
			>
				{hasComments ? (
					topLevelComments.map(comment => (
						<ChatMessages
							key={comment.id}
							comment={comment}
							commentsByParent={commentsByParent}
							depth={0}
							expandedThreads={expandedThreads}
							threadsWithNewMessages={threadsWithNewMessages}
							onToggleThread={toggleThread}
							onReply={setReplyingTo}
							appConfig={appConfig}
							startingHeadingLevel={3}
						/>
					))
				) : (
					<EmptyState />
				)}
			</ul>

			<div className="chat-form-container">
				<ChatForm
					replyingTo={replyingTo}
					onCancelReply={() => setReplyingTo(null)}
					onSubmitComment={handleSubmitComment}
					appConfig={appConfig}
				/>
			</div>
		</div>
	);
}


export default App;

