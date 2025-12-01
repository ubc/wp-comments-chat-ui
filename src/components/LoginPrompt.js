/**
 * Login Prompt Component
 */
function LoginPrompt({ loginUrl }) {
	return (
		<div className="chat-comments-login-required">
			<div className="chat-comments-login-card">
				<div className="chat-comments-login-icon" aria-hidden="true">🔒</div>
				<p>
					You must be <a href={loginUrl}>logged in</a> to view comments.
				</p>
				<a className="chat-comments-login-button" href={loginUrl}>
					Log In
				</a>
			</div>
		</div>
	);
}

export default LoginPrompt;

