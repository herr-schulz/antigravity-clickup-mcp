# Antigravity ClickUp MCP Bridge

A robust, platform-independent Model Context Protocol (MCP) bridge for Google Antigravity IDE (Gemini Code Assist), designed to integrate ClickUp workspaces, tasks, and project management natively into your agentic workflow.

---

## The Problem & The Solution

### The Windows Process Spawning Issue
Standard MCP clients and agent IDEs on Windows frequently fail to load command-based MCP servers (e.g. running `npx mcp-remote` or executing `.cmd`/`.ps1` wrapper files) because process managers spawn child processes directly without a shell wrapper (`shell: true` disabled for security/portability). Under Windows, this leads to `ENOENT` or execution blockages, resulting in "Failed to load MCP servers" errors.

### The Solution
This plugin acts as a standalone client wrapper (`clickup-mcp.js`). Since Windows can natively spawn binary files (`node.exe`) directly, the script starts Node and programmatically passes it the absolute JavaScript path of the installed global `mcp-remote` proxy. It handles JSON-RPC communication over standard I/O (stdio) and delegates session management to `mcp-remote` (using OAuth tokens stored in `~/.mcp-auth`), completely bypassing OS-level shell restrictions.

---

## Key Features

1. **Dynamic Path Resolution:** Automatically detects global npm packages and resolves the `mcp-remote/dist/proxy.js` location across Windows, macOS, and Linux, with automatic fallbacks for custom prefix setups (e.g., nvm, fnm).
2. **Interactive OAuth Launcher (`auth`):** Spawns the connection, intercepts the OAuth authorization URL, automatically opens the default browser, and prompts the user to press Enter upon completion.
3. **Hierarchy Workspace Sync (`projects remote`):** Connects to ClickUp and fetches all Spaces, Folders, and Lists in a beautifully formatted tree representation.
4. **Auto-Mapping Configuration (`projects add`):** Automatically searches ClickUp spaces for a target list, retrieves list and space IDs, and writes them with aliases directly to your local mappings config.
5. **Workspace Directory Resolution:** If no project argument is specified, the script automatically parses your current working directory name, matching it against aliases inside `clickup-projects.json` to resolve the target list ID.

---

## Installation & Setup Guide

There are two ways to install and configure this plugin: the **Recommended Agent-Led Setup** (where the AI agent configures everything automatically via chat), or the **Manual CLI Setup**.

---

### Method A: Recommended Agent-Led Setup (No Terminal Usage Required)

1. **Copy the Plugin Folder:**
   Copy this repository folder into your global Antigravity plugins directory:
   - **Windows:** `C:\Users\<YourUsername>\.gemini\config\plugins\clickup-mcp-plugin`
   - **macOS / Linux:** `~/.gemini/config/plugins/clickup-mcp-plugin`

2. **Trigger Setup in Chat:**
   Open your Antigravity IDE and simply type:
   > *"Set up ClickUp for me"*

3. **Follow the Agent's Prompts:**
   The agent will read the built-in `clickup-setup` skill and autonomously execute the following:
   - Verify and install the global `mcp-remote` dependency.
   - Start the OAuth connection and open your browser for login.
   - Query remote spaces and map your current project directories automatically.

---

### Method B: Manual CLI Setup

If you prefer to run the configuration steps yourself in the terminal:

1. **Install Prerequisites:**
   Install the `mcp-remote` package globally on your machine:
   ```bash
   npm install -g mcp-remote
   ```

2. **Copy the Plugin:**
   Copy this repository folder into the global Antigravity plugins directory:
   - **Windows:** `C:\Users\<YourUsername>\.gemini\config\plugins\clickup-mcp-plugin`
   - **macOS / Linux:** `~/.gemini/config/plugins/clickup-mcp-plugin`

3. **Authenticate:**
   Run the CLI auth helper:
   ```bash
   node bin/clickup-mcp.js auth
   ```
   *Note: This will launch your browser. Authorize the application, return to the terminal, and press **ENTER**.*

4. **Sync & Map Your Projects:**
   List all ClickUp lists on your account:
   ```bash
   node bin/clickup-mcp.js projects remote
   ```
   Map a local folder name (e.g. `my-project-site`) to a ClickUp List name or ID (e.g. `Backlog`):
   ```bash
   node bin/clickup-mcp.js projects add my-project-site "Backlog"
   ```

---

### Whitelisting Command Execution (Optional & Recommended)

To prevent Antigravity from constantly asking for permission when executing ClickUp commands, you can whitelist the specific wrapper script prefix in your global settings file (`~/.gemini/antigravity-cli/settings.json` or `~/.gemini/antigravity/settings.json`). 

This secures your system by auto-approving **only** our plugin script, while keeping general `node` execution commands under "ask" or "deny" restrictions.

Add the following prefix rule to the `allow` block under `command` permissions:

```json
{
  "permissions": {
    "command": {
      "allow": [
        "node C:\\Users\\<YourUsername>\\.gemini\\config\\plugins\\clickup-mcp-plugin\\bin\\clickup-mcp.js",
        "node /Users/<YourUsername>/.gemini/config/plugins/clickup-mcp-plugin/bin/clickup-mcp.js"
      ]
    }
  }
}
```
*(Replace `<YourUsername>` with your actual local username or use the absolute path to your home directory).*

---

## Project Mappings Format (`config/clickup-projects.json`)

The config file lists your workspace directories and aliases. When you run tools in a mapped folder, the target list ID is resolved automatically.

```json
{
  "example-project": {
    "spaceId": "12345678",
    "listId": "87654321",
    "listName": "Tasks (Master)",
    "spaceName": "Product Development",
    "aliases": [
      "example-project-site",
      "example-project-core",
      "example-project"
    ]
  }
}
```

---

## Usage for Agents & Developers

The client supports direct execution of ClickUp MCP tools. 

### CLI Syntax
```bash
node bin/clickup-mcp.js <toolName> '[jsonArgsString]'
```

### Example Calls

- **List local project mappings:**
  ```bash
  node bin/clickup-mcp.js projects list
  ```
- **Filter/List tasks in a project:**
  ```bash
  node bin/clickup-mcp.js clickup_filter_tasks '{"project":"example-project"}'
  ```
- **Filter tasks (Workspace Auto-Resolution):**
  If executed inside the directory `/projects/example-project-site`:
  ```bash
  node bin/clickup-mcp.js clickup_filter_tasks
  ```
  *The script will automatically detect the folder name, match the alias, and fetch tasks for List ID `87654321`.*

---

## License

This project is licensed under the MIT License.
