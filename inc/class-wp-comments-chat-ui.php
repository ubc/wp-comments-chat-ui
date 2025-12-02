<?php
/**
 * WP Comments Chat UI - Main Class
 * Handles all functionality for the chat UI.
 *
 * @package WP\Comments_Chat_UI
 */

namespace WP\Comments_Chat_UI;

/**
 * Main plugin class.
 */
class WP_Comments_Chat_UI {

	/**
	 * Tracks whether bootstrap data has been printed.
	 *
	 * @var bool
	 */
	private static $bootstrap_data_set = false;

	/**
	 * Default poll interval in milliseconds.
	 *
	 * @var int
	 */
	const DEFAULT_POLL_INTERVAL = 5000;

	/**
	 * Initialize the plugin.
	 */
	public function __construct() {
		// AJAX handlers.
		add_action( 'wp_ajax_chat_submit_comment', array( $this, 'ajax_submit_comment' ) );
		add_action( 'wp_ajax_chat_get_new_comments', array( $this, 'ajax_get_new_comments' ) );

		// Assets.
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_chat_assets' ) );

		// Force comments open for supported post types.
		add_filter( 'comments_open', array( $this, 'force_comments_open' ), 10, 2 );

		// Hide default comments.
		add_filter( 'comments_template', array( $this, 'return_empty_comments_template' ), 999 );
		add_filter( 'render_block', array( $this, 'remove_comments_block' ), 999, 2 );

		// Render chat UI.
		add_filter( 'the_content', array( $this, 'inject_chat_ui' ), 999 );
	}

	/**
	 * Enqueue chat app assets.
	 */
	public function enqueue_chat_assets() {
		if ( ! is_singular() || ( ! comments_open() && ! get_comments_number() ) ) {
			return;
		}

		// Only on allowed post types.
		if ( ! $this->is_post_type_allowed() ) {
			return;
		}

		// Enqueue React build files.
		$build_dir = plugin_dir_path( __DIR__ ) . 'build';
		$build_url = plugin_dir_url( __DIR__ ) . 'build';
		$src_dir   = plugin_dir_path( __DIR__ ) . 'src';
		$src_url   = plugin_dir_url( __DIR__ ) . 'src';

		// Enqueue JavaScript.
		$js_file = $build_dir . '/index.js';
		if ( file_exists( $js_file ) ) {
			wp_enqueue_script(
				'chat-comments-app-js',
				$build_url . '/index.js',
				array( 'react', 'react-dom' ),
				filemtime( $js_file ),
				true
			);
		}

		// Enqueue CSS.
		wp_enqueue_style(
			'chat-comments-app',
			$src_dir . '/chat-app.css',
			array(),
			filemtime( $src_dir . '/chat-app.css' )
		);
	}

	/**
	 * Force comments open for supported post types.
	 *
	 * @param bool $open Whether comments are open.
	 * @param int  $post_id The post ID.
	 * @return bool True if comments are open, false otherwise.
	 */
	public function force_comments_open( $open, $post_id ) {
		// Only on allowed post types.
		if ( ! $this->is_post_type_allowed() ) {
			return $open;
		}

		return true;
	}

	/**
	 * Return empty comments template to prevent default rendering.
	 *
	 * @param string $template The comments template path.
	 * @return string Path to empty template.
	 */
	public function return_empty_comments_template( $template ) {
		// Only on allowed post types.
		if ( ! $this->is_post_type_allowed() ) {
			return $template;
		}

		return __DIR__ . '/templates/empty-comments.php';
	}

	/**
	 * Remove comments block output for allowed post types.
	 *
	 * @param string $block_content The block content about to be appended.
	 * @param array  $block         The full block, including name and attributes.
	 * @return string Empty string if comments block, otherwise original content.
	 */
	public function remove_comments_block( $block_content, $block ) {
		// Only on allowed post types.
		if ( ! $this->is_post_type_allowed() ) {
			return $block_content;
		}

		// Check if this is a comments block.
		if ( isset( $block['blockName'] ) && 'core/comments' === $block['blockName'] ) {
			return '';
		}

		return $block_content;
	}

	/**
	 * Inject custom chat UI after post content.
	 *
	 * @param string $content Post content.
	 * @return string Modified content with chat UI.
	 */
	public function inject_chat_ui( $content ) {
		// Only on singular posts with comments enabled.
		if ( ! is_singular() || ( ! comments_open() && ! get_comments_number() ) ) {
			return $content;
		}

		// Only on allowed post types.
		if ( ! $this->is_post_type_allowed() ) {
			return $content;
		}

		// Get the chat UI HTML.
		ob_start();
		$this->render_chat_ui();
		$chat_ui = ob_get_clean();

		return $content . $chat_ui;
	}

	/**
	 * Render the custom chat UI - React root element with initial data.
	 */
	public function render_chat_ui() {
		global $post;

		$is_logged_in = is_user_logged_in();
		$comments     = array();

		// Only fetch comments if user is logged in.
		if ( $is_logged_in ) {
			$comments = get_comments(
				array(
					'post_id' => $post->ID,
					'status'  => 'approve',
					'order'   => 'ASC',
				)
			);
		}

		// Prepare initial comments data for React.
		$initial_comments = array();
		foreach ( $comments as $comment ) {
			$initial_comments[] = array(
				'comment_id'     => $comment->comment_ID,
				'comment_parent' => (int) $comment->comment_parent,
				'comment_meta'   => $this->build_comment_meta_payload( $comment ),
			);
		}

		// Get last comment ID.
		$last_comment_id = 0;
		if ( ! empty( $comments ) ) {
			$last_comment    = end( $comments );
			$last_comment_id = $last_comment->comment_ID;
		}

		// Prepare initial data for React.
		$initial_data = array(
			'comments'      => $initial_comments,
			'lastCommentId' => $last_comment_id,
			'commentCount'  => get_comments_number(),
		);

		// Prepare app config for React.
		$app_config = array(
			'postId'          => $post->ID,
			'userId'          => get_current_user_id(),
			'isLoggedIn'      => $is_logged_in,
			'nonce'           => wp_create_nonce( 'chat-comments-app' ),
			'ajaxUrl'         => admin_url( 'admin-ajax.php' ),
			'commentsOpen'    => comments_open(),
			'loginUrl'        => wp_login_url( get_permalink() ),
			'pollInterval'    => apply_filters( 'wp_comments_chat_ui_poll_interval', self::DEFAULT_POLL_INTERVAL ),
			'mentionableUsers' => $is_logged_in ? $this->get_mentionable_users( $post->ID, $comments ) : array(),
		);

		$this->set_bootstrap_data( $initial_data, $app_config );
		?>
		<div 
			id="chat-comments-app" 
			class="chat-comments-wrapper"
		></div>
		<?php
	}



	/**
	 * Build structured metadata for a comment.
	 *
	 * @param WP_Comment $comment Comment object.
	 * @return array
	 */
	private function build_comment_meta_payload( $comment ) {
		$post      = get_post( $comment->comment_post_ID );
		$is_author = ( $post && (int) $comment->user_id === (int) $post->post_author );
		$time_diff = human_time_diff( get_comment_time( 'U', false, true, $comment ), time() );
		$timestamp = sprintf(
			/* translators: %s: Human-readable time difference. */
			__( '%s ago', 'wp-comments-chat-ui' ),
			$time_diff
		);

		// Process content for display.
		$normalized_content         = preg_replace( '/\r\n?/', "\n", $comment->comment_content );
		$preserved_newlines_content = preg_replace_callback(
			"/\n{3,}/",
			static function ( $matches ) {
				$newline_count = strlen( $matches[0] );
				$replacement   = "\n\n";
				for ( $i = 0; $i < $newline_count - 2; $i++ ) {
					$replacement .= "&nbsp;\n\n";
				}
				return $replacement;
			},
			$normalized_content
		);
		$formatted_content          = wpautop( $preserved_newlines_content );

		// Get avatar data.
		$avatar_data = get_avatar_data( $comment->user_id ?: $comment->comment_author_email, array( 'size' => 40 ) );

		return array(
			'authorName'   => get_comment_author( $comment ),
			'isPostAuthor' => $is_author,
			'avatarUrl'    => $avatar_data['url'],
			'avatarAlt'    => sprintf(
				/* translators: %s: Author name. */
				__( 'Avatar for %s', 'wp-comments-chat-ui' ),
				get_comment_author( $comment )
			),
			'contentHtml'  => wp_kses_post( $formatted_content ),
			'timestamp'    => $timestamp,
			'permalink'    => get_comment_link( $comment ),
		);
	}

	/**
	 * Localize bootstrap data for the React app once per request.
	 *
	 * @param array $initial_data Initial comment data.
	 * @param array $app_config   App configuration.
	 */
	private function set_bootstrap_data( $initial_data, $app_config ) {
		if ( self::$bootstrap_data_set ) {
			return;
		}

		$payload = array(
			'initialData' => $initial_data,
			'appConfig'   => $app_config,
		);

		wp_localize_script( 'chat-comments-app-js', 'WPCommentsChatUIBootstrap', $payload );

		self::$bootstrap_data_set = true;
	}

	/**
	 * Handle AJAX comment submission.
	 */
	public function ajax_submit_comment() {
		// Verify nonce.
		check_ajax_referer( 'chat-comments-app', 'nonce' );

		// Check if user is logged in.
		if ( ! is_user_logged_in() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'You must be logged in to comment.', 'wp-comments-chat-ui' ) ) );
		}

		// Get and sanitize data.
		$comment_post_id = isset( $_POST['comment_post_ID'] ) ? absint( $_POST['comment_post_ID'] ) : 0;
		$comment_content = isset( $_POST['comment'] ) ? wp_kses_post( wp_unslash( $_POST['comment'] ) ) : '';
		$comment_parent  = isset( $_POST['comment_parent'] ) ? absint( $_POST['comment_parent'] ) : 0;

		// Validate post ID.
		if ( ! $comment_post_id ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Invalid post ID.', 'wp-comments-chat-ui' ) ) );
		}

		// Get the post to check its type.
		$post = get_post( $comment_post_id );
		if ( ! $post ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Post not found.', 'wp-comments-chat-ui' ) ) );
		}

		// Check if post type is allowed.
		if ( ! $this->is_post_type_allowed( $post->ID ) ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Comments are not enabled for this post type.', 'wp-comments-chat-ui' ) ) );
		}

		// Validate comment content.
		if ( empty( trim( $comment_content ) ) ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Comment content is required.', 'wp-comments-chat-ui' ) ) );
		}

		// Validate comment parent if provided.
		if ( $comment_parent > 0 ) {
			$parent_comment = get_comment( $comment_parent );
			if ( ! $parent_comment ) {
				wp_send_json_error( array( 'message' => esc_html__( 'Invalid parent comment.', 'wp-comments-chat-ui' ) ) );
			}
			// Ensure parent comment belongs to the same post.
			if ( (int) $parent_comment->comment_post_ID !== (int) $comment_post_id ) {
				wp_send_json_error( array( 'message' => esc_html__( 'Parent comment does not belong to this post.', 'wp-comments-chat-ui' ) ) );
			}
		}

		// Prepare comment data.
		$current_user = wp_get_current_user();
		$comment_data = wp_slash( array(
			'comment_post_ID'      => $comment_post_id,
			'comment_content'      => $comment_content,
			'comment_parent'       => $comment_parent,
			'user_id'              => $current_user->ID,
			'comment_author'       => $current_user->display_name,
			'comment_author_email' => $current_user->user_email,
			'comment_author_url'   => $current_user->user_url,
		) );

		// Insert comment.
		// Force approval for chat comments from logged-in users.
		add_filter( 'pre_comment_approved', array( $this, 'force_comment_approval' ) );
		// Disable flood protection for chat.
		add_filter( 'comment_flood_filter', array( $this, 'disable_comment_flood' ) );
		
		$comment_id = wp_new_comment( $comment_data, true );
		
		remove_filter( 'comment_flood_filter', array( $this, 'disable_comment_flood' ) );
		remove_filter( 'pre_comment_approved', array( $this, 'force_comment_approval' ) );

		if ( is_wp_error( $comment_id ) ) {
			error_log( 'WP Comments Chat UI Error: ' . $comment_id->get_error_message() );
			wp_send_json_error( array( 'message' => esc_html( $comment_id->get_error_message() ) ) );
		}

		if ( ! $comment_id ) {
			error_log( 'WP Comments Chat UI Error: wp_new_comment returned false/0 for post ID ' . $comment_post_id );
			wp_send_json_error( array( 'message' => esc_html__( 'Error saving comment.', 'wp-comments-chat-ui' ) ) );
		}

		// Get the comment object.
		$comment = get_comment( $comment_id );

		// Return success with comment data.
		wp_send_json_success(
			array(
				'comment_id'     => $comment_id,
				'comment_parent' => $comment_parent,
				'comment_meta'   => $this->build_comment_meta_payload( $comment ),
			)
		);
	}

	/**
	 * Handle AJAX request to fetch new comments.
	 */
	public function ajax_get_new_comments() {
		// Verify nonce.
		check_ajax_referer( 'chat-comments-app', 'nonce' );

		if ( ! is_user_logged_in() ) {
			wp_send_json_error( array( 'message' => esc_html__( 'You must be logged in to view comments.', 'wp-comments-chat-ui' ) ) );
		}

		// Get and sanitize data.
		$post_id         = isset( $_POST['post_id'] ) ? absint( $_POST['post_id'] ) : 0;
		$last_comment_id = isset( $_POST['last_comment_id'] ) ? absint( $_POST['last_comment_id'] ) : 0;

		// Validate post ID.
		if ( ! $post_id ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Invalid post ID.', 'wp-comments-chat-ui' ) ) );
		}

		// Get the post to check its type.
		$post = get_post( $post_id );
		if ( ! $post ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Post not found.', 'wp-comments-chat-ui' ) ) );
		}

		// Check if post type is allowed.
		if ( ! $this->is_post_type_allowed( $post->ID ) ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Comments are not enabled for this post type.', 'wp-comments-chat-ui' ) ) );
		}

		// Get all comments for this post.
		$comments = get_comments(
			array(
				'post_id' => $post_id,
				'status'  => 'approve',
				'order'   => 'ASC',
				'type'    => 'comment',
			)
		);

		// Filter to only get comments newer than last_comment_id.
		$new_comments = array();
		if ( $last_comment_id > 0 ) {
			foreach ( $comments as $comment ) {
				if ( $comment->comment_ID > $last_comment_id ) {
					$new_comments[] = $comment;
				}
			}
		} else {
			// If last_comment_id is 0, it means the client has no comments.
			// If we found comments, they are all new.
			$new_comments = $comments;
		}

		// Prepare response data.
		$response_data = array(
			'new_comments'    => array(),
			'last_comment_id' => $last_comment_id,
			'has_new'         => ! empty( $new_comments ),
		);

		// Prepare new comments data.
		if ( ! empty( $new_comments ) ) {
			foreach ( $new_comments as $comment ) {
				$response_data['new_comments'][] = array(
					'comment_id'     => $comment->comment_ID,
					'comment_parent' => (int) $comment->comment_parent,
					'comment_meta'   => $this->build_comment_meta_payload( $comment ),
				);

				// Update last_comment_id to the highest ID.
				if ( $comment->comment_ID > $response_data['last_comment_id'] ) {
					$response_data['last_comment_id'] = $comment->comment_ID;
				}
			}
		} elseif ( ! empty( $comments ) ) {
			// Update last_comment_id to the latest comment ID if no new comments.
			$latest_comment                   = end( $comments );
			$response_data['last_comment_id'] = $latest_comment->comment_ID;
		}

		wp_send_json_success( $response_data );
	}

	/**
	 * Force comment approval to '1'.
	 *
	 * @param mixed $approved The current approval status.
	 * @return int|string '1' to approve the comment.
	 */
	public function force_comment_approval( $approved ) {
		return 1;
	}

	/**
	 * Disable comment flood protection.
	 *
	 * @return bool False to disable flood checking.
	 */
	public function disable_comment_flood() {
		return false;
	}

	/**
	 * Get mentionable users for a post.
	 *
	 * @param int   $post_id  The post ID.
	 * @param array $comments Optional. Pre-fetched comments (unused, kept for compatibility).
	 * @return array List of mentionable users.
	 */
	private function get_mentionable_users( $post_id, $comments = null ) {
		$mentionable_users = array();
		$current_user_id   = get_current_user_id();

		// Add AI assistance option first.
		$mentionable_users[] = array(
			'id'        => 'ai',
			'name'      => __( 'AI Assistance', 'wp-comments-chat-ui' ),
			'avatarUrl' => '',
			'isAi'      => true,
		);

		/**
		 * Filter the user query arguments for fetching mentionable users.
		 *
		 * Plugins can use this filter to restrict which users are fetched.
		 * For example, to limit to specific roles or to users in a group.
		 *
		 * @param array $args    The WP_User_Query arguments.
		 * @param int   $post_id The current post ID.
		 */
		$user_query_args = apply_filters(
			'wp_comments_chat_ui_mentionable_users_query_args',
			array(
				'number'  => 100, // Limit for performance.
				'orderby' => 'display_name',
				'order'   => 'ASC',
				'exclude' => array( $current_user_id ),
			),
			$post_id
		);

		// Get users.
		$users = get_users( $user_query_args );

		foreach ( $users as $user ) {
			$avatar_data = get_avatar_data( $user->ID, array( 'size' => 32 ) );

			$mentionable_users[] = array(
				'id'        => $user->ID,
				'name'      => $user->display_name,
				'avatarUrl' => $avatar_data['url'],
				'isAi'      => false,
			);
		}

		/**
		 * Filter the final list of mentionable users.
		 *
		 * Plugins can use this filter to add, remove, or modify users in the list.
		 *
		 * @param array $mentionable_users The list of mentionable users.
		 * @param int   $post_id           The current post ID.
		 */
		return apply_filters( 'wp_comments_chat_ui_mentionable_users', $mentionable_users, $post_id );
	}

	/**
	 * Check if the current post type is allowed for chat UI.
	 *
	 * @param int|null $post_id Optional. Post ID to check. Defaults to global post.
	 * @return bool True if post type is allowed, false otherwise.
	 */
	private function is_post_type_allowed( $post_id = null ) {
		// Get allowed post types from constant.
		$allowed_post_types = defined( 'WP_COMMENTS_TO_CHAT_ALLOWED_POST_TYPES' ) ? WP_COMMENTS_TO_CHAT_ALLOWED_POST_TYPES : array();
		$allowed_post_types = apply_filters( 'wp_comments_to_chat_allowed_post_types', $allowed_post_types );

		// Ensure it's an array.
		if ( ! is_array( $allowed_post_types ) ) {
			return false;
		}

		// Get current post type.
		$current_post_type = get_post_type( $post_id );

		// Check if current post type is in allowed list.
		return in_array( $current_post_type, $allowed_post_types, true );
	}
}

