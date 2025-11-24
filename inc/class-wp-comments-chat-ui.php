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

		// Restrict viewing to logged-in users.
		if ( ! is_user_logged_in() ) {
			?>
			<div class="chat-comments-login-required">
				<div class="chat-comments-login-card">
					<div class="chat-comments-login-icon" aria-hidden="true">🔒</div>
					<p>
						<?php
						printf(
							wp_kses_post(
								/* translators: %s: Login URL. */
								__( 'You must be <a href="%s">logged in</a> to view comments.', 'wp-comments-chat-ui' )
							),
							esc_url( wp_login_url( get_permalink() ) )
						);
						?>
					</p>
					<a class="chat-comments-login-button" href="<?php echo esc_url( wp_login_url( get_permalink() ) ); ?>">
						<?php esc_html_e( 'Log In', 'wp-comments-chat-ui' ); ?>
					</a>
				</div>
			</div>
			<?php
			return;
		}

		// Get all comments for this post.
		$comments = get_comments(
			array(
				'post_id' => $post->ID,
				'status'  => 'approve',
				'order'   => 'ASC',
			)
		);

		// Organize comments into parent/child structure.
		$comments_by_parent = array();
		foreach ( $comments as $comment ) {
			$parent_id                          = (int) $comment->comment_parent;
			$comments_by_parent[ $parent_id ][] = $comment;
		}

		// Prepare initial comments data for React.
		$initial_comments = array();
		foreach ( $comments as $comment ) {
			ob_start();
			$this->render_chat_message( $comment, $comments_by_parent, (int) $comment->comment_parent > 0 ? 1 : 0 );
			$comment_html = ob_get_clean();

			$initial_comments[] = array(
				'comment_id'     => $comment->comment_ID,
				'comment_parent' => (int) $comment->comment_parent,
				'comment_html'   => $comment_html,
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
			'postId'       => $post->ID,
			'userId'       => get_current_user_id(),
			'nonce'        => wp_create_nonce( 'chat-comments-app' ),
			'ajaxUrl'      => admin_url( 'admin-ajax.php' ),
			'commentsOpen' => comments_open(),
			'loginUrl'     => wp_login_url( get_permalink() ),
			'pollInterval' => apply_filters( 'wp_comments_chat_ui_poll_interval', self::DEFAULT_POLL_INTERVAL ),
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
	 * Render a single chat message.
	 *
	 * @param object $comment Comment object.
	 * @param array  $comments_by_parent All comments organized by parent.
	 * @param int    $depth Current depth level.
	 */
	public function render_chat_message( $comment, $comments_by_parent, $depth = 0 ) {
		$comment_id  = $comment->comment_ID;
		$meta        = $this->build_comment_meta_payload( $comment );
		$has_replies = ! empty( $comments_by_parent[ $comment_id ] );
		$reply_count = $has_replies ? count( $comments_by_parent[ $comment_id ] ) : 0;

		$classes = array( 'chat-message' );
		if ( $depth > 0 ) {
			$classes[] = 'chat-message-reply';
		}
		?>
		<div id="comment-<?php echo esc_attr( $comment_id ); ?>" class="<?php echo esc_attr( implode( ' ', $classes ) ); ?>" data-comment-id="<?php echo esc_attr( $comment_id ); ?>">
			
			<div class="chat-message-content">
				
				<!-- Avatar -->
				<div class="chat-avatar">
					<?php echo wp_kses_post( $meta['avatarHtml'] ); ?>
				</div>

				<!-- Bubble -->
				<div class="chat-bubble">
					
					<!-- Header -->
					<div class="chat-bubble-header">
						<span class="chat-author-name">
							<?php echo esc_html( $meta['authorName'] ); ?>
							<?php if ( ! empty( $meta['isPostAuthor'] ) ) : ?>
								<span class="chat-author-badge"><?php esc_html_e( 'Author', 'wp-comments-chat-ui' ); ?></span>
							<?php endif; ?>
						</span>
						<span class="chat-timestamp">
							<a href="<?php echo esc_url( $meta['permalink'] ); ?>">
								<?php echo esc_html( $meta['timestamp'] ); ?>
							</a>
						</span>
					</div>

					<!-- Comment Text -->
					<div class="chat-text">
						<?php
						echo wp_kses_post( $meta['contentHtml'] );
						?>
					</div>

					<!-- Actions -->
					<div class="chat-actions">
						<?php if ( 0 === $depth ) : ?>
							
							<?php if ( $has_replies ) : ?>
								<button class="chat-thread-toggle" data-comment-id="<?php echo esc_attr( $comment_id ); ?>" aria-expanded="false">
									<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
										<path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
									</svg>
									<span class="chat-reply-count">
										<?php
										printf(
											/* translators: %s: Number of replies. */
											esc_html( _n( '%s reply', '%s replies', $reply_count, 'wp-comments-chat-ui' ) ),
											esc_html( number_format_i18n( $reply_count ) )
										);
										?>
									</span>
									<span class="chat-toggle-arrow">▸</span>
								</button>
							<?php endif; ?>

							<?php if ( comments_open() ) : ?>
								<button class="chat-reply-button" data-comment-id="<?php echo esc_attr( $comment_id ); ?>" data-author="<?php echo esc_attr( $meta['authorName'] ); ?>">
									<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
										<path d="M8 15c4.418 0 8-3.134 8-7s-3.582-7-8-7-8 3.134-8 7c0 1.76.743 3.37 1.97 4.6-.097 1.016-.417 2.13-.771 2.966-.079.186.074.394.273.362 2.256-.37 3.597-.938 4.18-1.234A9.06 9.06 0 0 0 8 15z"/>
									</svg>
									<?php esc_html_e( 'Reply', 'wp-comments-chat-ui' ); ?>
								</button>
							<?php endif; ?>

						<?php endif; ?>
					</div>

				</div>

			</div>

			<!-- Nested Replies -->
			<?php if ( $has_replies && 0 === $depth ) : ?>
				<div class="chat-thread" data-parent-id="<?php echo esc_attr( $comment_id ); ?>" style="display: none;">
					<?php foreach ( $comments_by_parent[ $comment_id ] as $reply ) : ?>
						<?php $this->render_chat_message( $reply, $comments_by_parent, $depth + 1 ); ?>
					<?php endforeach; ?>
				</div>
			<?php endif; ?>

		</div>
		<?php
	}

	/**
	 * Render the chat comment form.
	 */
	public function render_chat_form() {
		global $post;

		if ( ! comments_open() ) {
			?>
			<div class="chat-form-closed">
				<p><?php esc_html_e( 'Comments are closed.', 'wp-comments-chat-ui' ); ?></p>
			</div>
			<?php
			return;
		}

		$user = wp_get_current_user();

		if ( ! $user->exists() ) {
			?>
			<div class="chat-form-login-required">
				<p>
					<?php
					printf(
						/* translators: %s: Login URL. */
						wp_kses_post( __( 'You must be <a href="%s">logged in</a> to comment.', 'wp-comments-chat-ui' ) ),
						esc_url( wp_login_url( get_permalink() ) )
					);
					?>
				</p>
			</div>
			<?php
			return;
		}

		?>
		<form id="chat-commentform" action="<?php echo esc_url( site_url( '/wp-comments-post.php' ) ); ?>" method="post" class="chat-form">
			<div class="chat-form-logged-in">
				<div class="chat-form-input-wrapper">
					<textarea 
						id="comment" 
						name="comment" 
						placeholder="<?php esc_attr_e( 'Type your message...', 'wp-comments-chat-ui' ); ?>"
						rows="1"
						required
					></textarea>
					<input type="hidden" name="comment_parent" id="comment_parent_field" value="0" />
					<input type="hidden" name="comment_post_ID" value="<?php echo esc_attr( $post->ID ); ?>" />
					<?php wp_nonce_field( 'unfiltered-html-comment_' . $post->ID, '_wp_unfiltered_html_comment_disabled', false ); ?>
				</div>
				<button type="submit" class="chat-submit-button">
					<svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
						<path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11ZM6.636 10.07l2.761 4.338L14.13 2.576 6.636 10.07Zm6.787-8.201L1.591 6.602l4.339 2.76 7.494-7.493Z"/>
					</svg>
				</button>
			</div>
			<?php do_action( 'comment_form', $post->ID ); ?>
		</form>
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

		return array(
			'authorName'   => get_comment_author( $comment ),
			'isPostAuthor' => $is_author,
			'avatarHtml'   => wp_kses_post( get_avatar( $comment, 40 ) ),
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

		// Check if comments are open.
		if ( ! comments_open( $comment_post_id ) ) {
			wp_send_json_error( array( 'message' => esc_html__( 'Comments are closed for this post.', 'wp-comments-chat-ui' ) ) );
		}

		// Check if post type is allowed.
		$allowed_post_types = defined( 'WP_COMMENTS_TO_CHAT_ALLOWED_POST_TYPES' ) ? WP_COMMENTS_TO_CHAT_ALLOWED_POST_TYPES : null;
		if ( null !== $allowed_post_types && is_array( $allowed_post_types ) && ! in_array( $post->post_type, $allowed_post_types, true ) ) {
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

		// Sanitize comment content.
		$comment_content = wp_kses_post( $comment_content );

		// Prepare comment data.
		$current_user = wp_get_current_user();
		$comment_data = array(
			'comment_post_ID'      => $comment_post_id,
			'comment_content'      => $comment_content,
			'comment_parent'       => $comment_parent,
			'user_id'              => $current_user->ID,
			'comment_author'       => $current_user->display_name,
			'comment_author_email' => $current_user->user_email,
			'comment_author_url'   => $current_user->user_url,
		);

		// Insert comment.
		$comment_id = wp_new_comment( $comment_data, true );

		if ( is_wp_error( $comment_id ) ) {
			wp_send_json_error( array( 'message' => esc_html( $comment_id->get_error_message() ) ) );
		}

		// Get the comment object.
		$comment = get_comment( $comment_id );

		// Get all comments to rebuild structure.
		$comments = get_comments(
			array(
				'post_id' => $comment_post_id,
				'status'  => 'approve',
				'order'   => 'ASC',
			)
		);

		// Organize comments.
		$comments_by_parent = array();
		foreach ( $comments as $c ) {
			$parent_id                          = (int) $c->comment_parent;
			$comments_by_parent[ $parent_id ][] = $c;
		}

		// Render the new comment HTML.
		ob_start();
		$this->render_chat_message( $comment, $comments_by_parent, $comment_parent > 0 ? 1 : 0 );
		$comment_html = ob_get_clean();

		// Return success with comment data.
		wp_send_json_success(
			array(
				'comment_id'     => $comment_id,
				'comment_parent' => $comment_parent,
				'comment_html'   => $comment_html,
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
		$allowed_post_types = defined( 'WP_COMMENTS_TO_CHAT_ALLOWED_POST_TYPES' ) ? WP_COMMENTS_TO_CHAT_ALLOWED_POST_TYPES : null;
		if ( null !== $allowed_post_types && is_array( $allowed_post_types ) && ! in_array( $post->post_type, $allowed_post_types, true ) ) {
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

		// Organize comments into parent/child structure.
		$comments_by_parent = array();
		foreach ( $comments as $comment ) {
			$parent_id                          = (int) $comment->comment_parent;
			$comments_by_parent[ $parent_id ][] = $comment;
		}

		// Prepare response data.
		$response_data = array(
			'new_comments'    => array(),
			'last_comment_id' => $last_comment_id,
			'has_new'         => ! empty( $new_comments ),
		);

		// Render new comments HTML.
		if ( ! empty( $new_comments ) ) {
			foreach ( $new_comments as $comment ) {
				$parent_id = (int) $comment->comment_parent;
				$depth     = $parent_id > 0 ? 1 : 0;

				ob_start();
				$this->render_chat_message( $comment, $comments_by_parent, $depth );
				$comment_html = ob_get_clean();

				$response_data['new_comments'][] = array(
					'comment_id'     => $comment->comment_ID,
					'comment_parent' => $parent_id,
					'comment_html'   => $comment_html,
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
	 * Check if the current post type is allowed for chat UI.
	 *
	 * @return bool True if post type is allowed, false otherwise.
	 */
	private function is_post_type_allowed() {
		// Get allowed post types from constant.
		$allowed_post_types = defined( 'WP_COMMENTS_TO_CHAT_ALLOWED_POST_TYPES' ) ? WP_COMMENTS_TO_CHAT_ALLOWED_POST_TYPES : array();
		$allowed_post_types = apply_filters( 'wp_comments_to_chat_allowed_post_types', $allowed_post_types );

		// Ensure it's an array.
		if ( ! is_array( $allowed_post_types ) ) {
			return false;
		}

		// Get current post type.
		$current_post_type = get_post_type();

		// Check if current post type is in allowed list.
		return in_array( $current_post_type, $allowed_post_types, true );
	}
}

