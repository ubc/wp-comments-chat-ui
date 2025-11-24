import { createRoot } from 'react-dom/client';
import './chat-app.css';
import App from './App';

// Initialize the app when DOM is ready
function getBootstrapData(container) {
	if (window.WPCommentsChatUIBootstrap) {
		const payload = window.WPCommentsChatUIBootstrap;
		return payload;
	}

	const initialDataStr = container?.dataset?.initialData || '{}';
	const appConfigStr = container?.dataset?.appConfig || '{}';

	return {
		initialData: JSON.parse(initialDataStr),
		appConfig: JSON.parse(appConfigStr),
	};
}

// Initialize the app when DOM is ready
function initChatApp() {
	const container = document.getElementById('chat-comments-app');
	if (!container) {
		return;
	}

	// Check if already initialized
	if (container.dataset.initialized === 'true') {
		return;
	}

	try {
		const { initialData = {}, appConfig = {} } = getBootstrapData(container);

		// Mark as initialized
		container.dataset.initialized = 'true';
		
		const root = createRoot(container);
		root.render(<App initialData={initialData} appConfig={appConfig} />);
	} catch (error) {
		console.error('Error initializing chat app:', error);
	}
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initChatApp);
} else {
	// DOM is already ready
	initChatApp();
}
