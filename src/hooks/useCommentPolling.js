import { useCallback, useEffect } from 'react';

/**
 * Handle polling for new comments.
 *
 * @param {Object} params Hook parameters.
 * @param {Object} params.appConfig App configuration.
 * @param {Function} params.getLastCommentId Function that returns the latest comment ID.
 * @param {Function} params.onResponse Callback invoked with poll results.
 * @param {number} params.pollInterval Polling interval in milliseconds.
 * @return {Function} Polling function (can be called manually).
 */
export default function useCommentPolling({
	appConfig,
	getLastCommentId,
	onResponse,
	pollInterval = appConfig?.pollInterval || 5000,
}) {
	const pollForNewComments = useCallback(async () => {
		if (!appConfig?.postId || !appConfig?.ajaxUrl || !appConfig?.nonce) {
			return;
		}

		const currentLastId = typeof getLastCommentId === 'function'
			? getLastCommentId()
			: 0;

		const formData = new FormData();
		formData.append('action', 'chat_get_new_comments');
		formData.append('nonce', appConfig.nonce);
		formData.append('post_id', appConfig.postId);
		formData.append('last_comment_id', currentLastId);

		try {
			const response = await fetch(appConfig.ajaxUrl, {
				method: 'POST',
				body: formData,
			});
			const data = await response.json();

			if (typeof onResponse === 'function') {
				onResponse(data, currentLastId);
			}
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error('Error polling for new comments:', error);
		}
	}, [appConfig, getLastCommentId, onResponse]);

	useEffect(() => {
		if (!appConfig?.postId) {
			return undefined;
		}

		const initialPollTimeout = setTimeout(() => {
			pollForNewComments();
		}, 1000);

		const intervalId = setInterval(() => {
			if (!document.hidden) {
				pollForNewComments();
			}
		}, pollInterval);

		const handleVisibilityChange = () => {
			if (!document.hidden) {
				pollForNewComments();
			}
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);

		return () => {
			clearTimeout(initialPollTimeout);
			clearInterval(intervalId);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	}, [appConfig?.postId, pollForNewComments, pollInterval]);

	return pollForNewComments;
}

