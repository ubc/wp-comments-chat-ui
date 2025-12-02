import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Mention List Component
 * Uses HTML5 dialog element for better accessibility
 */
function MentionList({
	isOpen,
	searchQuery,
	users,
	onSelect,
	onClose,
}) {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const dialogRef = useRef(null);
	const listRef = useRef(null);

	// Filter users based on search query
	const filteredUsers = users.filter(user =>
		user.name.toLowerCase().includes(searchQuery.toLowerCase())
	);

	// Reset selected index when filtered list changes
	useEffect(() => {
		setSelectedIndex(0);
	}, [searchQuery]);

	// Handle dialog open/close
	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;

		if (isOpen && filteredUsers.length > 0) {
			if (!dialog.open) {
				dialog.show(); // Use show() for non-modal dialog
			}
		} else {
			if (dialog.open) {
				dialog.close();
			}
		}
	}, [isOpen, filteredUsers.length]);

	// Handle keyboard navigation
	const handleKeyDown = useCallback((e) => {
		if (!isOpen || filteredUsers.length === 0) return;

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				e.stopPropagation();
				setSelectedIndex(prev => 
					prev < filteredUsers.length - 1 ? prev + 1 : 0
				);
				break;
			case 'ArrowUp':
				e.preventDefault();
				e.stopPropagation();
				setSelectedIndex(prev => 
					prev > 0 ? prev - 1 : filteredUsers.length - 1
				);
				break;
			case 'Enter':
			case 'Tab':
				e.preventDefault();
				e.stopPropagation();
				if (filteredUsers[selectedIndex]) {
					onSelect(filteredUsers[selectedIndex]);
				}
				break;
			case 'Escape':
				e.preventDefault();
				e.stopPropagation();
				onClose();
				break;
			default:
				break;
		}
	}, [isOpen, filteredUsers, selectedIndex, onSelect, onClose]);

	// Attach keyboard listener to document when open
	useEffect(() => {
		if (isOpen) {
			document.addEventListener('keydown', handleKeyDown, true);
			return () => document.removeEventListener('keydown', handleKeyDown, true);
		}
	}, [isOpen, handleKeyDown]);

	// Scroll selected item into view
	useEffect(() => {
		if (listRef.current && isOpen) {
			const selectedItem = listRef.current.querySelector('[data-selected="true"]');
			if (selectedItem) {
				selectedItem.scrollIntoView({ block: 'nearest' });
			}
		}
	}, [selectedIndex, isOpen]);

	// Handle click outside to close
	useEffect(() => {
		if (!isOpen) return;

		const handleClickOutside = (e) => {
			if (dialogRef.current && !dialogRef.current.contains(e.target)) {
				onClose();
			}
		};

		// Delay to avoid immediate close on @ keypress
		const timer = setTimeout(() => {
			document.addEventListener('click', handleClickOutside);
		}, 100);

		return () => {
			clearTimeout(timer);
			document.removeEventListener('click', handleClickOutside);
		};
	}, [isOpen, onClose]);

	if (filteredUsers.length === 0) {
		return null;
	}

	return (
		<dialog
			ref={dialogRef}
			className="mention-dialog"
			aria-label="Select a person to mention"
		>
			<div className="mention-dialog-header">
				<span className="mention-dialog-title">People</span>
				{searchQuery && (
					<span className="mention-dialog-search">
						Searching for "{searchQuery}"
					</span>
				)}
			</div>
			<ul
				ref={listRef}
				className="mention-list"
				role="listbox"
				aria-label="Mentionable users"
			>
				{filteredUsers.map((user, index) => (
					<li
						key={user.id}
						className={`mention-item ${index === selectedIndex ? 'mention-item-selected' : ''} ${user.type ? `mention-item-${user.type}` : ''}`}
						role="option"
						aria-selected={index === selectedIndex}
						data-selected={index === selectedIndex}
						data-user-type={user.type || 'user'}
						onClick={() => onSelect(user)}
						onMouseEnter={() => setSelectedIndex(index)}
					>
						<div className="mention-avatar-wrapper">
							{user.avatarUrl ? (
								<img 
									className="mention-avatar"
									src={user.avatarUrl} 
									alt="" 
									width="28" 
									height="28"
									loading="lazy"
								/>
							) : user.avatarIcon ? (
								<div 
									className={`mention-avatar mention-avatar-icon ${user.type ? `mention-avatar-${user.type}` : ''}`} 
									aria-hidden="true"
									dangerouslySetInnerHTML={{ __html: user.avatarIcon }}
								/>
							) : (
								<div className="mention-avatar mention-avatar-placeholder" aria-hidden="true">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
										<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
									</svg>
								</div>
							)}
						</div>
						<div className="mention-info">
							<span className="mention-name">{user.name}</span>
							{user.description && (
								<span className="mention-description">{user.description}</span>
							)}
						</div>
					</li>
				))}
			</ul>
			<div className="mention-dialog-footer">
				<span className="mention-hint">
					<kbd>↑</kbd><kbd>↓</kbd> to navigate
					<kbd>↵</kbd> to select
					<kbd>esc</kbd> to dismiss
				</span>
			</div>
		</dialog>
	);
}

export default MentionList;
