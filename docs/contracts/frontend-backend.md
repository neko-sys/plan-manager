# Frontend/Backend Contract (Planned)

## Runtime boundary

Frontend talks to:

1. Tauri commands (Rust)
2. Ollama HTTP API (`http://127.0.0.1:11434`)

## Tauri commands

### `list_ollama_models`

- Input: none
- Output: `string[]` model names
- Error: string message

### `greet`

- Input: `{ name: string }`
- Output: `string`

## Ollama API usage

### `POST /api/generate`

- Request:

```json
{
  "model": "string",
  "prompt": "string",
  "system": "string?",
  "stream": "boolean?",
  "options": {
    "temperature": "number?",
    "num_predict": "number?"
  }
}
```

- Response (non-stream):

```json
{ "response": "string", "done": true }
```

- Response (stream): newline-delimited JSON chunks with `response` and `done`.

## Compatibility notes

- Local storage keys remain unchanged:
  - `plan-manager-workspace-v1`
  - `plan-manager-chat-v1`
  - `plan-manager-pomodoro-v1`
- Rust implementation remains unchanged in this phase.
