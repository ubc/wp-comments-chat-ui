import { useState, useEffect, useRef } from 'react';

/**
 * Chat Form Component
 */
function ChatForm({ replyingTo, onCancelReply, onSubmitComment, appConfig }) {
	const [comment, setComment] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const textareaRef = useRef(null);

	// Auto-focus textarea when replying
	useEffect(() => {
		if (replyingTo && textareaRef.current) {
			textareaRef.current.focus();
		}
	}, [replyingTo]);

	// Auto-expand textarea as user types
	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = 'auto';
			const newHeight = Math.min(textareaRef.current.scrollHeight, 150);
			textareaRef.current.style.height = newHeight + 'px';
		}
	}, [comment]);

	const insertNewlineAtCursor = () => {
		if (!textareaRef.current) {
			return;
		}

		const { selectionStart, selectionEnd, value } = textareaRef.current;
		const before = value.slice(0, selectionStart);
		const after = value.slice(selectionEnd);
		const nextValue = `${before}\n${after}`;
		const nextCursor = selectionStart + 1;

		setComment(nextValue);

		requestAnimationFrame(() => {
			if (!textareaRef.current) {
				return;
			}
			textareaRef.current.selectionStart = nextCursor;
			textareaRef.current.selectionEnd = nextCursor;
		});
	};

	// Handle keyboard shortcuts
	const handleKeyDown = (e) => {
		if (e.key === 'Enter') {
			if (e.metaKey || e.ctrlKey) {
				e.preventDefault();
				insertNewlineAtCursor();
				return;
			}

			if (e.shiftKey) {
				// Default newline for Shift + Enter.
				return;
			}

			// Plain Enter submits the form.
			e.preventDefault();
			handleSubmit();
			return;
		}

		if (e.key === 'Escape' && replyingTo) {
			e.preventDefault();
			onCancelReply();
		}
	};

	const handleSubmit = async (event = null) => {
		if (event) {
			event.preventDefault();
		}

		if (!comment.trim() || isSubmitting || typeof onSubmitComment !== 'function') {
			return;
		}

		setIsSubmitting(true);

		try {
			await onSubmitComment({
				content: comment,
				parentId: replyingTo?.commentId || 0,
			});

			setComment('');

			if (!replyingTo || replyingTo.commentId === 0) {
				onCancelReply();
			}
		} catch (error) {
			// eslint-disable-next-line no-alert
			alert(error.message || 'Error submitting comment. Please try again.');
		} finally {
			setIsSubmitting(false);
		}
	};

	if (appConfig.commentsOpen === false) {
		return (
			<div className="chat-comments-login-required">
				<div className="chat-comments-login-card">
					<div className="chat-comments-login-icon" aria-hidden="true">🚫</div>
					<p>Comments are closed for this post.</p>
				</div>
			</div>
		);
	}

	return (
		<form id="chat-commentform" className="chat-form" onSubmit={handleSubmit}>
			{replyingTo && (
				<div className="chat-reply-indicator">
					<div className="chat-reply-indicator-text">
						<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
							<path d="M8 15c4.418 0 8-3.134 8-7s-3.582-7-8-7-8 3.134-8 7c0 1.76.743 3.37 1.97 4.6-.097 1.016-.417 2.13-.771 2.966-.079.186.074.394.273.362 2.256-.37 3.597-.938 4.18-1.234A9.06 9.06 0 0 0 8 15z" />
						</svg>
						<span>
							Replying to <strong>{replyingTo.authorName}</strong>
						</span>
					</div>
					<button
						type="button"
						className="chat-reply-cancel"
						aria-label="Cancel reply"
						onClick={onCancelReply}
					>
						Cancel
					</button>
				</div>
			)}

			<div className="chat-form-logged-in">
				<div className="chat-form-input-wrapper">
					<textarea
						ref={textareaRef}
						id="comment"
						name="comment"
						aria-label="Comment text"
						placeholder="Type your message..."
						rows="1"
						value={comment}
						onChange={(e) => setComment(e.target.value)}
						onKeyDown={handleKeyDown}
						required
					/>
					<input type="hidden" name="comment_parent" id="comment_parent_field" value={replyingTo?.commentId || 0} />
					<input type="hidden" name="comment_post_ID" value={appConfig.postId} />
				</div>
				<button
					type="submit"
					className="chat-submit-button"
					aria-label="Submit comment"
					disabled={isSubmitting || !comment.trim()}
					style={{ opacity: isSubmitting ? 0.6 : 1 }}
				>
					{isSubmitting ? (
						<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ animation: 'spin 1s linear infinite' }}>
							<circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.25" />
							<path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" fill="none" />
						</svg>
					) : (
						<svg aria-hidden="true" width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
							<path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11ZM6.636 10.07l2.761 4.338L14.13 2.576 6.636 10.07Zm6.787-8.201L1.591 6.602l4.339 2.76 7.494-7.493Z" />
						</svg>
					)}
				</button>
			</div>
		</form>
	);
}

export default ChatForm;

