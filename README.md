# OpenBot

OpenBot is a CLI and library designed to run AI prompts with specialized "skills" (based on the Agent Skills framework) and browser automation capabilities.

## Features

- 🛠️ **Skill-based Architecture**: Extend the agent's capabilities with custom skills.
- 🌐 **Browser Automation**: Full control over a headless browser for navigation, data extraction, and downloads.
- 📡 **Gateway Server**: WebSocket-based gateway for real-time interaction with web and mobile clients (mirroring Moltbot).
- 🐍 **Code Execution**: Run Python code to solve complex problems.

## Installation

```bash
npm install
npm run build
```

## CLI Usage

### Direct Prompt
```bash
$ freebot "Search for the latest research on AI agents"
```

### With Specific Skills
```bash
$ freebot -s ./my-skills "Summarize current market trends"
```

### Start Gateway Server
```bash
$ freebot gateway --port 3000
```

## Gateway API

The Gateway server uses a JSON-RPC over WebSocket protocol.

### Message Types

- **Request**: `{ "type": "request", "id": "msg-123", "method": "...", "params": { ... } }`
- **Response**: `{ "type": "response", "id": "msg-123", "result": { ... } }`
- **Event**: `{ "type": "event", "event": "...", "payload": { ... } }`

### Methods

- `connect`: Initialize a session.
- `agent.chat`: Send a message to the agent.

### Events

- `agent.chunk`: Real-time streaming of character/word chunks.
- `agent.tool`: Information about tool usage.

## Development

```bash
# Run tests
npm test

# Build
npm run build
```

## License
MIT