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

## License

GPL-2.0-or-later
