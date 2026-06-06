---
name: clickup-setup
description: >-
  Guides the agent through the process of automatically installing, authenticating,
  and configuring the ClickUp MCP bridge. Use this skill when the user asks to
  "setup clickup", "authenticate clickup", "login to clickup", or "map clickup projects".
---

# ClickUp MCP Setup and Configuration Guide

This skill enables you (the AI agent) to automatically guide the user through the installation, authentication, and mapping of the ClickUp MCP bridge. When a user requests setup or configuration, do not ask them to read the README or run terminal commands themselves. Instead, follow the automated recipe below to perform the setup on their behalf.

---

## Automated Setup Recipe

When the user says "set up clickup" or "authenticate clickup", execute these steps in order:

### Step 1: Verify and Install the Global Proxy
1. Search the system for the global `mcp-remote` package by trying to resolve its location or executing `npm root -g`.
2. If the command fails or `mcp-remote` is missing, tell the user:
   *"I detected that the global dependency `mcp-remote` is missing. I will run the installation command now."*
3. Propose and execute the command:
   `npm install -g mcp-remote`

---

### Step 2: Trigger OAuth Authentication
1. Once `mcp-remote` is installed, initiate the authentication flow by executing the `auth` subcommand:
   - **Windows:** `node %USERPROFILE%\.gemini\config\plugins\clickup-mcp-plugin\bin\clickup-mcp.js auth`
   - **macOS / Linux:** `node $HOME/.gemini/config/plugins/clickup-mcp-plugin/bin/clickup-mcp.js auth`
2. **Handle the link output:**
   - The script will spawn the proxy and output the login URL.
   - It will automatically attempt to open this URL in the user's default browser.
   - Provide the URL in the chat: *"I've opened the ClickUp login page. If it didn't open automatically, please click this link to authenticate: [ClickUp Login Link](<URL>)"*
3. **Wait for completion:**
   - Keep the process running in the background. Tell the user: *"Once you have successfully logged in and authorized ClickUp in your browser, please reply here to let me know."*
4. **Send input to finish:**
   - When the user replies, use the `manage_task` tool to send an `ENTER` key input (value: `"\n"`) to the running task. The script will save the credentials locally to `~/.mcp-auth/` and exit.

---

### Step 3: Fetch ClickUp Spaces & Folders
1. Query the remote ClickUp workspace structure to show the user what lists are available:
   - **Windows:** `node %USERPROFILE%\.gemini\config\plugins\clickup-mcp-plugin\bin\clickup-mcp.js projects remote`
   - **macOS / Linux:** `node $HOME/.gemini/config/plugins/clickup-mcp-plugin/bin/clickup-mcp.js projects remote`
2. Parse the output and present the Space/List names and IDs in a clean bulleted list in the chat.
3. Ask the user: *"Here is your ClickUp hierarchy. Which ClickUp List would you like to map to this workspace folder? Please provide the name or ID."*

---

### Step 4: Map the Local Workspace Folder
1. Once the user provides the list name or ID, retrieve the name of the current workspace directory (e.g. `my-project-site`).
2. Run the mapping subcommand:
   - **Windows:** `node %USERPROFILE%\.gemini\config\plugins\clickup-mcp-plugin\bin\clickup-mcp.js projects add <folderName> <listNameOrId>`
   - **macOS / Linux:** `node $HOME/.gemini/config/plugins/clickup-mcp-plugin/bin/clickup-mcp.js projects add <folderName> <listNameOrId>`
3. The script will search the remote hierarchy, fetch the IDs, and write the mapping directly into `clickup-projects.json`.
4. Inform the user: *"I've mapped this project directory to ClickUp successfully! Task filtering and creation in this workspace will now target this list automatically."*
