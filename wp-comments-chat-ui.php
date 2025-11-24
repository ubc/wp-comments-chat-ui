<?php
/**
 * Plugin Name:       WP Comments Chat UI
 * Description:       Chat-style comments UI for WordPress. Works with both legacy and block themes. Mostly developed alongside with AI.
 * Requires at least: 5.9
 * Requires PHP:      7.0
 * Version:           2.0.0
 * Author:            CTLT WordPress
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       wp-comments-chat-ui
 *
 * @package           wp-comments-chat-ui
 */

namespace WP\Comments_Chat_UI;

// If this file is called directly, abort.
if ( ! defined( 'ABSPATH' ) ) {
	die;
}

/**
 * Initializes the plugin.
 *
 * @return void
 */
function init() {
	// Load the main class.
	require_once __DIR__ . '/inc/class-wp-comments-chat-ui.php';

	// Initialize the plugin.
	new WP_Comments_Chat_UI();
}

add_action( 'plugins_loaded', __NAMESPACE__ . '\\init' );
