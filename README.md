# WP Comments Chat UI

A modern, chat-style interface for WordPress comments. This plugin replaces the standard comment section with a real-time, interactive chat experience.

## Features

- **Real-time Updates**: New comments appear instantly without refreshing the page (via polling).
- **Chat-Style Interface**: Familiar messaging UI with bubbles, timestamps, and avatars.
- **Threaded Replies**: Support for nested replies to keep conversations organized.
- **Modern Tech Stack**: Built with React and the WordPress REST API.
- **Theme Compatibility**: Works with both legacy (PHP) and modern block themes.

## Installation

1.  Upload the plugin files to the `/wp-content/plugins/wp-comments-chat-ui` directory, or install the plugin through the WordPress plugins screen.
2.  Activate the plugin through the 'Plugins' screen in WordPress.
3.  The standard comment form will be automatically replaced with the Chat UI on singular posts and pages.

## Development

This plugin uses `@wordpress/scripts` for building the React frontend.

### Prerequisites

- Node.js (v14 or higher recommended)
- NPM or Yarn

### Setup

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```

### Build Commands

-   **Start Development Server**: Watches for changes and rebuilds automatically.
    ```bash
    npm start
    ```

-   **Build for Production**: Minifies and optimizes the code for release.
    ```bash
    npm run build
    ```

## Configuration

### Supported Post Types

By default, the plugin does not enable the chat UI on any post types. You must explicitly allow it using the `wp_comments_to_chat_allowed_post_types` filter.

Add the following code to your theme's `functions.php` or a custom plugin:

```php
add_filter( 'wp_comments_to_chat_allowed_post_types', function( $post_types ) {
    // Add 'post' and 'page' to the allowed list.
    $post_types[] = 'post';
    $post_types[] = 'page';
    return $post_types;
} );
```

### Polling Interval

You can customize the polling interval (how often the plugin checks for new comments) using the `wp_comments_chat_ui_poll_interval` filter. The default is 5000ms (5 seconds).

```php
add_filter( 'wp_comments_chat_ui_poll_interval', function( $interval ) {
    return 10000; // Set to 10 seconds.
} );
```

## License

GPL-2.0-or-later
