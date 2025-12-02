import { useState, useEffect, useRef, useCallback } from 'react';
import MentionList from './MentionList';

/**
 * Chat Form Component
 */
function ChatForm({ replyingTo, onCancelReply, onSubmitComment, appConfig }) {
	const [comment, setComment] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const textareaRef = useRef(null);
	const formRef = useRef(null);

	// Mention state
	const [mentionState, setMentionState] = useState({
		isOpen: false,
		startIndex: -1,
		searchQuery: '',
	});

	// Get mentionable users from localized data
	const mentionableUsers = appConfig.mentionableUsers || [];

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

	// Handle mention detection
	const handleInputChange = useCallback((e) => {
		const value = e.target.value;
		const cursorPos = e.target.selectionStart;

		setComment(value);

		// Check if we should open or update the mention popup
		const textBeforeCursor = value.slice(0, cursorPos);
		const lastAtIndex = textBeforeCursor.lastIndexOf('@');

		if (lastAtIndex !== -1) {
			// Check if @ is at start or preceded by whitespace
			const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
			const isValidMentionStart = charBeforeAt === ' ' || charBeforeAt === '\n' || lastAtIndex === 0;

			if (isValidMentionStart) {
				const searchQuery = textBeforeCursor.slice(lastAtIndex + 1);
				// Only show popup if there's no space in the search query (still typing the mention)
				if (!searchQuery.includes(' ')) {
					setMentionState({
						isOpen: true,
						startIndex: lastAtIndex,
						searchQuery,
					});
					return;
				}
			}
		}

		// Close mention popup if conditions not met
		if (mentionState.isOpen) {
			setMentionState({
				isOpen: false,
				startIndex: -1,
				searchQuery: '',
			});
		}
	}, [mentionState.isOpen]);

	// Handle mention selection
	const handleMentionSelect = useCallback((user) => {
		if (!textareaRef.current || mentionState.startIndex === -1) return;

		const before = comment.slice(0, mentionState.startIndex);
		const after = comment.slice(textareaRef.current.selectionStart);
		const mentionText = `@${user.name} `;
		const newValue = before + mentionText + after;
		const newCursorPos = before.length + mentionText.length;

		setComment(newValue);
		setMentionState({
			isOpen: false,
			startIndex: -1,
			searchQuery: '',
		});

		// Restore focus and cursor position
		requestAnimationFrame(() => {
			if (textareaRef.current) {
				textareaRef.current.focus();
				textareaRef.current.selectionStart = newCursorPos;
				textareaRef.current.selectionEnd = newCursorPos;
			}
		});
	}, [comment, mentionState.startIndex]);

	// Close mention popup
	const closeMentionPopup = useCallback(() => {
		setMentionState({
			isOpen: false,
			startIndex: -1,
			searchQuery: '',
		});
	}, []);

	// Handle keyboard shortcuts
	const handleKeyDown = (e) => {
		// If mention popup is open, let MentionList handle navigation keys
		if (mentionState.isOpen && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
			// Don't prevent default here - MentionList will handle it
			return;
		}

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

	const getPreviewText = (html) => {
		if (!html) return '';
		const tmp = document.createElement('DIV');
		tmp.innerHTML = html;
		const text = tmp.textContent || tmp.innerText || '';
		return text.length > 80 ? text.substring(0, 80) + '...' : text;
	};

	return (
		<form id="chat-commentform" className="chat-form" onSubmit={handleSubmit} ref={formRef}>
			<div className="chat-reply-indicator">
				{replyingTo ? (
					<>
						<div id="chat-reply-info" className="chat-reply-info">
							<div className="chat-reply-indicator-text">
								<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
									<path d="M8 15c4.418 0 8-3.134 8-7s-3.582-7-8-7-8 3.134-8 7c0 1.76.743 3.37 1.97 4.6-.097 1.016-.417 2.13-.771 2.966-.079.186.074.394.273.362 2.256-.37 3.597-.938 4.18-1.234A9.06 9.06 0 0 0 8 15z" />
								</svg>
								<span>
									Replying to <strong>{replyingTo.authorName}</strong>
								</span>
							</div>
							<div className="chat-reply-preview">
								{getPreviewText(replyingTo.contentHtml)}
							</div>
						</div>
						<button
							type="button"
							className="chat-reply-cancel"
							aria-label="Cancel reply"
							onClick={onCancelReply}
						>
							Cancel
						</button>
					</>
				) : (
					<div id="chat-new-message-info" className="chat-reply-indicator-text">
						<span>Sending a new message</span>
					</div>
				)}
			</div>

			<div className="chat-form-logged-in">
				<div className="chat-form-input-wrapper">
					<textarea
						ref={textareaRef}
						id="comment"
						name="comment"
						aria-describedby={replyingTo ? 'chat-reply-info' : 'chat-new-message-info'}
						placeholder="Type your message... (use @ to mention)"
						rows="1"
						value={comment}
						onChange={handleInputChange}
						onKeyDown={handleKeyDown}
						required
					/>
					<MentionList
						isOpen={mentionState.isOpen}
						searchQuery={mentionState.searchQuery}
						users={mentionableUsers}
						onSelect={handleMentionSelect}
						onClose={closeMentionPopup}
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
