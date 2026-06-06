---
name: clickup-mcp
description: >-
  Interact with ClickUp spaces and backlogs globally on this machine.
  Allows filtering tasks, searching tasks, creating tasks, and resolving project names.
  Use this skill whenever the user asks about ClickUp tasks, backlogs, PM queries, or project status.
---

# ClickUp MCP Integration (Global CLI Helper)

> [!IMPORTANT]
> This plugin and skill are exclusively designed and optimized for the Antigravity IDE. It should only be used by Antigravity agents.

Since native IDE process spawners can be unstable or fail on Windows when directly executing shell scripts (like `.cmd` or `.ps1`), you MUST use this direct Node-based runner to communicate with the ClickUp MCP remote server.

## Executable Locations

The global runner script is located at:
- **Windows:** `node %USERPROFILE%\.gemini\config\plugins\clickup-mcp-plugin\bin\clickup-mcp.js <toolName> '<arguments_json>'`
- **macOS / Linux:** `node $HOME/.gemini/config/plugins/clickup-mcp-plugin/bin/clickup-mcp.js <toolName> '<arguments_json>'`

This script launches the `mcp-remote` proxy connected to ClickUp, signs in using the user's stored OAuth credentials, executes the requested tool, and outputs the result as a JSON string.

## Project Mapping & Auto-Resolution

To avoid needing to remember raw ClickUp list or space IDs, a project mapping configuration file is located at:
- **Windows:** `%USERPROFILE%\.gemini\config\plugins\clickup-mcp-plugin\config\clickup-projects.json`
- **macOS / Linux:** `$HOME/.gemini/config/plugins/clickup-mcp-plugin/config/clickup-projects.json`

### Manual Resolution
You can pass the `"project": "<projectName>"` argument in your JSON arguments string, and the script will automatically resolve it to the correct list ID.

### Workspace Folder Auto-Resolution
If no `project`, `list_ids`, or `list_id` parameter is specified in the arguments, the script will automatically inspect the current directory (`process.cwd()`), extract the folder name, and look it up in the mappings (checking both keys and their `aliases` arrays). If matched, it injects the resolved `list_ids` and `list_id` parameters automatically.

## Usage Examples

Execute ClickUp tool calls by running the command in terminal:

### 1. Filter/List Tasks in a Project
`node %USERPROFILE%\.gemini\config\plugins\clickup-mcp-plugin\bin\clickup-mcp.js clickup_filter_tasks '{"project":"example-project"}'`
*Note: Add `"subtasks": true` to include subtasks in the output.*

### 2. Search Tasks in ClickUp
`node %USERPROFILE%\.gemini\config\plugins\clickup-mcp-plugin\bin\clickup-mcp.js clickup_search '{"query":"bug fix"}'`

### 3. Get Task Details
`node %USERPROFILE%\.gemini\config\plugins\clickup-mcp-plugin\bin\clickup-mcp.js clickup_get_task '{"task_id":"86c9zf6yh"}'`

### 4. Create Task
`node %USERPROFILE%\.gemini\config\plugins\clickup-mcp-plugin\bin\clickup-mcp.js clickup_create_task '{"name":"Fix styling","description":"Correct spacing on login button"}'`
*Note: In this example, if run inside the mapped project folder, the script automatically resolves and injects the target `list_id`.*

### 5. Update Task Status
`node %USERPROFILE%\.gemini\config\plugins\clickup-mcp-plugin\bin\clickup-mcp.js clickup_update_task '{"task_id":"86c9zf6yh","status":"complete"}'`

## Error Handling

- Standard output is raw JSON from the MCP server.
- If the proxy process fails, verify that `mcp-remote` is installed globally (`npm install -g mcp-remote`) and that the user's internet connection is active.
- If the user is not authenticated, they must run the setup process.
