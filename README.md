# ClickUp MCP Bridge for Antigravity

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-Supported-blue.svg)](https://modelcontextprotocol.io)

A robust, platform-independent Model Context Protocol (MCP) bridge connecting **Google Antigravity IDE (Gemini Code Assist)** with **ClickUp** on Windows, macOS, and Linux.

---

## 🚀 Why This Exists

Windows process managers often fail to spawn command-based MCP servers (like `.cmd` or `.ps1` scripts) directly without a shell. 

This bridge runs a direct, lightweight Node client wrapper (`clickup-mcp.js`) to invoke the global `mcp-remote` proxy natively using `node.exe`, completely bypassing Windows process spawning restrictions.

---

## ✨ Features

- **📂 Auto-Resolution:** Automatically maps your current workspace folder name to ClickUp list IDs using project config aliases.
- **🔐 Interactive OAuth:** Automatically detects the ClickUp login URL and opens it in your default web browser.
- **🗺️ Remote Space Sync:** Syncs and browses your ClickUp spaces, folders, and lists directly from the CLI.
- **⚡ Zero Local Dependencies:** Built entirely using Node.js standard libraries for fast execution and zero security warnings.

---

## 📦 Installation & Setup

### Method A: Agent-Led (Recommended)

1. **Copy the Plugin Folder:**
   Copy this repository folder into your global Antigravity plugins directory:
   - **Windows:** `C:\Users\<Name>\.gemini\config\plugins\clickup-mcp-plugin`
   - **macOS / Linux:** `~/.gemini/config/plugins/clickup-mcp-plugin`

2. **Trigger Setup in Chat:**
   Open your Antigravity IDE and type:
   > *"Set up ClickUp for me"*
3. The agent will automatically check prerequisites, run the OAuth login, and map your workspace folders.

---

### Method B: Manual CLI Setup

1. **Install Prerequisites:**
   ```bash
   npm install -g mcp-remote
   ```
2. **Copy the Plugin Folder** to your global Antigravity plugins directory.
3. **Authenticate:**
   ```bash
   node bin/clickup-mcp.js auth
   ```
   *Note: This will launch your default web browser. Log in, authorize, then return to your terminal and press **ENTER**.*
4. **Sync & Map Projects:**
   ```bash
   # List remote ClickUp Spaces & Lists
   node bin/clickup-mcp.js projects remote

   # Map a local folder to a ClickUp List
   node bin/clickup-mcp.js projects add my-project "Backlog"
   ```

---

## 🛠️ Developer Reference

<details>
<summary><b>Project Mappings Format (clickup-projects.json)</b></summary>

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
      "example-project"
    ]
  }
}
```
</details>

<details>
<summary><b>Auto-Approved Permissions (settings.json)</b></summary>

To prevent Antigravity from prompting you for command confirmation every time, add the command prefix to the `allow` block under `command` permissions in your global settings file (`~/.gemini/antigravity/settings.json`):

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
</details>

---

## ⚖️ License

This project is licensed under the MIT License.
