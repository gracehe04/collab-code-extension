const vscode = require('vscode');
const CollaborativeEditor = require('./collaborativeEditor');

let collaborativeEditor;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	console.log('Congratulations, your extension "collab-code" is now active!');

	collaborativeEditor = new CollaborativeEditor();
	collaborativeEditor.initialize().catch(error => {
		console.error('Failed to initialize collaborative editor:', error);
	});

	const chatCommand = vscode.commands.registerCommand('collab-code.helloWorld', function () {
		const panel = vscode.window.createWebviewPanel(
			'collabChat',
			'CollabCode Chat',
			vscode.ViewColumn.Two,
			{
				enableScripts: true
			}
		);

		panel.webview.html = getWebviewContent();

		panel.webview.onDidReceiveMessage(
			message => {
				if (message.type === 'chat') {
					const timestamp = new Date().toLocaleTimeString([], {
						hour: '2-digit',
						minute: '2-digit'
					});

					panel.webview.postMessage({
						type: 'chat',
						text: message.text,
						timestamp: timestamp,
						user: 'You'
					});
					
					if (collaborativeEditor) {
						collaborativeEditor.sendChatMessage(message.text);
					}
				} else if (message.type === 'reaction') {
					vscode.window.showInformationMessage(`You reacted with ${message.reaction}`);
				}
			},
			undefined,
			context.subscriptions
		);
	});
	
	const connectCommand = vscode.commands.registerCommand('collab-code.connect', async function () {
		const serverUrl = await vscode.window.showInputBox({
			placeHolder: 'Enter server URL (e.g., ws://192.168.1.5:8080)',
			prompt: 'Enter the WebSocket server URL to connect to'
		});
		
		if (serverUrl) {
			await vscode.workspace.getConfiguration('collab-code').update('serverUrl', serverUrl, true);
			if (collaborativeEditor) {
				collaborativeEditor.dispose();
			}
			collaborativeEditor = new CollaborativeEditor();
			collaborativeEditor.initialize().catch(error => {
				console.error('Failed to initialize collaborative editor:', error);
			});
		}
	});
	
	const startServerCommand = vscode.commands.registerCommand('collab-code.startServer', function () {
		const terminal = vscode.window.createTerminal('CollabCode Server');
		terminal.sendText('node server.js');
		terminal.show();
		
		const ip = require('ip');
		const localIP = ip.address();
		vscode.window.showInformationMessage(`Server started. Share this address with collaborators: ws://${localIP}:8080`);
	});

	context.subscriptions.push(chatCommand, connectCommand, startServerCommand);
}

function getWebviewContent() {
	return `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<style>
				:root {
					--background: #1e1e1e;
					--panel-bg: #252526;
					--border-color: #3c3c3c;
					--button-bg: #0e639c;
					--button-hover: #1177bb;
					--font-color: #d4d4d4;
					--input-bg: #3c3c3c;
				}

				body {
					margin: 0;
					padding: 16px;
					background-color: var(--background);
					font-family: 'Segoe UI', sans-serif;
					color: var(--font-color);
				}

				h3 {
					margin-bottom: 12px;
					color: #3794ff;
				}

				#chat {
					background-color: var(--panel-bg);
					border: 1px solid var(--border-color);
					border-radius: 8px;
					padding: 10px;
					height: 300px;
					overflow-y: auto;
					box-shadow: 0 2px 4px rgba(0,0,0,0.3);
					margin-bottom: 14px;
				}

				.message.user {
					display: flex;
					justify-content: flex-end;
					padding-right: 12px;
					margin-bottom: 12px;
				}

				.bubble {
					background-color: #2d2d2d;
					border-radius: 10px;
					padding: 10px;
					max-width: 75%;
					box-shadow: 0 2px 4px rgba(0,0,0,0.2);
				}

				.bubble-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: 4px;
					color: #d4d4d4;
					font-size: 0.85em;
				}

				.bubble-user {
					font-weight: bold;
				}

				.bubble-time {
					font-size: 0.75em;
					color: gray;
					margin-left: 10px;
				}

				.bubble-text {
					font-size: 1em;
					margin-bottom: 6px;
					word-wrap: break-word;
					text-align: left;
				}

				.reactions {
					display: flex;
					justify-content: flex-end;
					gap: 10px;
					margin-top: 6px;
				}

				.reaction {
					cursor: pointer;
					font-size: 16px;
					user-select: none;
					padding: 4px 6px;
					border-radius: 5px;
					transition: transform 0.1s, background-color 0.2s;
				}

				.reaction:hover {
					transform: scale(1.2);
					background-color: #444;
				}

				.reaction.clicked {
					background-color: #3794ff;
					color: white;
					font-weight: bold;
				}

				input {
					width: 78%;
					padding: 8px;
					border-radius: 6px;
					border: 1px solid var(--border-color);
					background-color: var(--input-bg);
					color: white;
					outline: none;
				}

				input::placeholder {
					color: #888;
				}

				button {
					width: 20%;
					margin-left: 2%;
					padding: 8px;
					background-color: var(--button-bg);
					color: white;
					border: none;
					border-radius: 6px;
					cursor: pointer;
					font-weight: 500;
				}

				button:hover {
					background-color: var(--button-hover);
				}

				#input-row {
					display: flex;
					justify-content: space-between;
					align-items: center;
				}
			</style>
		</head>
		<body>
			<h3>Live Chat 💬</h3>
			<div id="chat"></div>
			<div id="input-row">
				<input id="message" placeholder="Say something..." />
				<button onclick="sendMessage()">Send</button>
			</div>

			<script>
				const vscode = acquireVsCodeApi();

				function sendMessage() {
					const input = document.getElementById('message');

					if (input.value.trim() !== '') {
						vscode.postMessage({ type: 'chat', text: input.value });
						input.value = '';
					}
				}
				document.getElementById('message').addEventListener('keydown', function(event) {
					if (event.key === 'Enter') {
						sendMessage();
					}
				});

				window.addEventListener('message', event => {
					const message = event.data;
					if (message.type === 'chat') {
						const chat = document.getElementById('chat');
						const messageHTML = \`
							<div class="message user">
								<div class="bubble"> 
									<div class="bubble-header"> 
										<span class="bubble-user">\${message.user}</span>
										<span class="bubble-time">\${message.timestamp}</span>
									</div>
									<div class="bubble-text">\${message.text}</div>
									<div class="reactions">
										<span class="reaction">👍</span>
										<span class="reaction">❤️</span>
										<span class="reaction">😂</span>
									</div>
								</div>
							</div>
						\`;
						chat.innerHTML += messageHTML;
						chat.scrollTop = chat.scrollHeight;
					}
				});

				document.addEventListener('click', function (e) {
					if (e.target.classList.contains('reaction')) {
						const reaction = e.target.textContent;
						e.target.classList.toggle('clicked');
						vscode.postMessage({ type: 'reaction', reaction });
					}
				});
			</script>
		</body>
		</html>
	`;
}

function deactivate() {
	if (collaborativeEditor) {
		collaborativeEditor.dispose();
	}
}

module.exports = {
	activate,
	deactivate
};