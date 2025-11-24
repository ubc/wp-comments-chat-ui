import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import useCommentPolling from './useCommentPolling';
import {
    buildCommentsByParent,
    collectRootParentIds,
    createCommentMap,
    getLastCommentIdFromList,
    mergeUniqueComments,
    normalizeComments,
} from '../utils/comments';

/**
 * Custom hook to manage comments state and logic.
 *
 * @param {Object} initialData Initial data from server.
 * @param {Object} appConfig App configuration.
 */
export default function useComments(initialData, appConfig) {
    // --- Initialization ---
    const normalizedInitialComments = useMemo(
        () => normalizeComments(initialData?.comments || []),
        [initialData],
    );

    const derivedInitialLastCommentId = useMemo(
        () => initialData?.lastCommentId ?? getLastCommentIdFromList(normalizedInitialComments),
        [initialData?.lastCommentId, normalizedInitialComments],
    );

    const initialCommentCount = useMemo(() => {
        const count = initialData?.commentCount ?? normalizedInitialComments.length;
        const numericCount = Number(count);
        return Number.isFinite(numericCount) ? numericCount : 0;
    }, [initialData?.commentCount, normalizedInitialComments.length]);

    // --- State ---
    const [comments, setComments] = useState(() => normalizedInitialComments);
    const [lastCommentId, setLastCommentId] = useState(() => derivedInitialLastCommentId);
    const [commentCount, setCommentCount] = useState(() => initialCommentCount);
    const [expandedThreads, setExpandedThreads] = useState(() => new Set());
    const [threadsWithNewMessages, setThreadsWithNewMessages] = useState(() => new Set());

    // Refs for values needed in callbacks/effects without triggering re-renders
    const lastCommentIdRef = useRef(derivedInitialLastCommentId);

    // Sync ref with state
    useEffect(() => {
        lastCommentIdRef.current = lastCommentId;
    }, [lastCommentId]);

    // --- Helpers ---

    /**
     * Handle incoming comments from poll or submit.
     */
    const handleIncomingComments = useCallback((rawComments, { onNewComments } = {}) => {
        const normalized = normalizeComments(rawComments);

        if (!normalized.length) {
            return;
        }

        setComments(prevComments => {
            const { merged, added } = mergeUniqueComments(prevComments, normalized);

            if (!added.length) {
                return prevComments;
            }

            // Update counts
            if (added.length > 0) {
                setCommentCount(prev => {
                    const previousNumeric = Number(prev);
                    const safePrev = Number.isFinite(previousNumeric) ? previousNumeric : 0;
                    return safePrev + added.length;
                });
            }

            // Identify threads with new messages
            const commentMap = createCommentMap(merged);
            const rootParents = collectRootParentIds(added, commentMap);
            if (rootParents.size) {
                setThreadsWithNewMessages(prev => {
                    const updated = new Set(prev);
                    rootParents.forEach(id => updated.add(id));
                    return updated;
                });
            }

            // Update last comment ID
            const highestAddedId = added.reduce((max, comment) => Math.max(max, comment.id), 0);
            if (highestAddedId > lastCommentIdRef.current) {
                setLastCommentId(highestAddedId);
            }

            // Optional callback for side effects (like scrolling)
            if (onNewComments) {
                onNewComments();
            }

            return merged;
        });
    }, []);

    /**
     * Submit a new comment.
     */
    const submitComment = useCallback(async ({ content, parentId }) => {
        if (!content || !appConfig?.ajaxUrl) {
            throw new Error('Unable to submit comment.');
        }

        const formData = new FormData();
        formData.append('action', 'chat_submit_comment');
        formData.append('nonce', appConfig.nonce);
        formData.append('comment', content);
        formData.append('comment_post_ID', appConfig.postId);
        formData.append('comment_parent', parentId);

        const response = await fetch(appConfig.ajaxUrl, {
            method: 'POST',
            body: formData,
        });
        const data = await response.json();

        if (!data.success) {
            throw new Error(data?.data?.message || 'Error submitting comment.');
        }

        // Handle the new comment immediately
        handleIncomingComments([data.data], {
            onNewComments: () => {
                // Auto-expand thread if replying
                if (parentId > 0) {
                    const normalizedParentId = Number(parentId);
                    setExpandedThreads(prev => {
                        const updated = new Set(prev);
                        updated.add(normalizedParentId);
                        return updated;
                    });
                    // Remove "new message" indicator for this thread since we just replied to it
                    setThreadsWithNewMessages(prev => {
                        const updated = new Set(prev);
                        updated.delete(normalizedParentId);
                        return updated;
                    });
                }
            }
        });

        return data.data;
    }, [appConfig, handleIncomingComments]);

    /**
     * Toggle thread expansion.
     */
    const toggleThread = useCallback((commentId) => {
        const normalizedId = Number(commentId);

        if (!Number.isFinite(normalizedId)) {
            return;
        }

        setExpandedThreads(prev => {
            const updated = new Set(prev);
            if (updated.has(normalizedId)) {
                updated.delete(normalizedId);
            } else {
                updated.add(normalizedId);
            }
            return updated;
        });

        // Clear new message indicator when opening
        setThreadsWithNewMessages(prev => {
            if (!prev.has(normalizedId)) {
                return prev;
            }
            const updated = new Set(prev);
            updated.delete(normalizedId);
            return updated;
        });
    }, []);

    // --- Polling Integration ---

    const getLastCommentId = useCallback(() => lastCommentIdRef.current || 0, []);

    const handlePollResponse = useCallback((data, currentLastId) => {
        if (!data?.success) {
            return;
        }

        const payload = data.data || {};
        const newComments = payload.new_comments || [];

        if (payload.has_new && newComments.length) {
            handleIncomingComments(newComments, {
                onNewComments: () => {
                    // We can expose a flag or callback if we want to handle auto-scroll in UI
                }
            });
        }

        if (payload.last_comment_id && payload.last_comment_id > currentLastId) {
            setLastCommentId(payload.last_comment_id);
        }
    }, [handleIncomingComments]);

    useCommentPolling({
        appConfig,
        getLastCommentId,
        onResponse: handlePollResponse,
    });

    // --- Derived Data ---

    const commentsByParent = useMemo(
        () => buildCommentsByParent(comments),
        [comments],
    );

    const topLevelComments = commentsByParent[0] || [];

    return {
        comments,
        commentsByParent,
        topLevelComments,
        commentCount,
        expandedThreads,
        threadsWithNewMessages,
        submitComment,
        toggleThread,
        hasComments: comments.length > 0,
    };
}
