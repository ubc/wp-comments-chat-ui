const DEFAULT_META = Object.freeze({
	authorName: '',
	timestamp: '',
	contentHtml: '',
	avatarUrl: '',
	avatarAlt: '',
	isPostAuthor: false,
	permalink: '',
});

const normalizeMeta = (meta = {}) => {
	if (!meta || typeof meta !== 'object') {
		return { ...DEFAULT_META };
	}

	const normalized = {
		authorName: meta.authorName ?? meta.author_name ?? DEFAULT_META.authorName,
		timestamp: meta.timestamp ?? meta.time ?? DEFAULT_META.timestamp,
		contentHtml: meta.contentHtml ?? meta.content_html ?? DEFAULT_META.contentHtml,
		avatarUrl: meta.avatarUrl ?? meta.avatar_url ?? DEFAULT_META.avatarUrl,
		avatarAlt: meta.avatarAlt ?? meta.avatar_alt ?? DEFAULT_META.avatarAlt,
		isPostAuthor: Boolean(
			meta.isPostAuthor ?? meta.is_post_author ?? DEFAULT_META.isPostAuthor
		),
		permalink: meta.permalink ?? meta.link ?? DEFAULT_META.permalink,
	};

	return normalized;
};

/**
 * Normalize a single comment object received from the server.
 *
 * @param {Object} raw Comment payload.
 * @return {Object|null} Normalized comment.
 */
export function normalizeComment(raw) {
	if (!raw) {
		return null;
	}

	const rawId = raw.comment_id ?? raw.comment_ID ?? raw.id;
	const id = Number.parseInt(rawId, 10);

	if (!Number.isFinite(id)) {
		return null;
	}

	const rawParent = raw.comment_parent ?? raw.parent ?? 0;
	const parentId = Number.parseInt(rawParent, 10) || 0;
	const meta = normalizeMeta(raw.comment_meta ?? raw.meta);

	return {
		id,
		parentId,
		meta,
	};
}

/**
 * Normalize a list of comments.
 *
 * @param {Array} comments Raw comments.
 * @return {Array} Normalized comments.
 */
export function normalizeComments(comments = []) {
	return comments
		.map(normalizeComment)
		.filter(Boolean);
}

/**
 * Merge unique comments into the existing list.
 *
 * @param {Array} existing Current comments.
 * @param {Array} incoming New comments.
 * @return {{merged: Array, added: Array}} Result.
 */
export function mergeUniqueComments(existing, incoming) {
	if (!incoming.length) {
		return { merged: existing, added: [] };
	}

	const existingIds = new Set(existing.map(comment => comment.id));
	const added = incoming.filter(comment => !existingIds.has(comment.id));

	if (!added.length) {
		return { merged: existing, added: [] };
	}

	return {
		merged: [...existing, ...added],
		added,
	};
}

/**
 * Build a lookup of comments grouped by parent ID.
 *
 * @param {Array} comments Comment collection.
 * @return {Object} Lookup object.
 */
export function buildCommentsByParent(comments = []) {
	return comments.reduce((acc, comment) => {
		const key = comment.parentId || 0;

		if (!acc[key]) {
			acc[key] = [];
		}

		acc[key].push(comment);

		return acc;
	}, {});
}

/**
 * Create a map of comment ID to comment.
 *
 * @param {Array} comments Comment list.
 * @return {Map<number, Object>} Comment map.
 */
export function createCommentMap(comments = []) {
	return new Map(comments.map(comment => [comment.id, comment]));
}

/**
 * Find root parent IDs (top-level comments) for a set of replies.
 *
 * @param {Array} comments Comments to inspect.
 * @param {Map<number, Object>} commentMap Lookup map.
 * @return {Set<number>} Root parent IDs.
 */
export function collectRootParentIds(comments = [], commentMap = new Map()) {
	const rootIds = new Set();

	for (const comment of comments) {
		if (!comment.parentId) continue;

		let currentId = comment.parentId;
		let guard = 0;

		while (currentId && commentMap.has(currentId) && guard < 50) {
			const parent = commentMap.get(currentId);
			if (!parent) break;

			if (parent.parentId === 0) {
				rootIds.add(parent.id);
				break;
			}

			currentId = parent.parentId;
			guard++;
		}
	}

	return rootIds;
}

/**
 * Determine the highest comment ID from a list.
 *
 * @param {Array} comments Comment collection.
 * @return {number} Highest ID.
 */
export function getLastCommentIdFromList(comments = []) {
	return comments.reduce((max, comment) => Math.max(max, comment.id || 0), 0);
}

