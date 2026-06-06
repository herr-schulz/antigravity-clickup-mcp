import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = import.meta.dirname || path.dirname(fileURLToPath(import.meta.url));
const PROJECTS_JSON = path.join(__dirname, '..', 'config', 'clickup-projects.json');
const REMOTE_URL = 'https://mcp.clickup.com/mcp';

// Resolve the global npm installation path of mcp-remote proxy.js
function resolveProxyPath() {
  const home = os.homedir();
  const candidates = [];

  if (process.platform === 'win32') {
    if (process.env.APPDATA) {
      candidates.push(path.join(process.env.APPDATA, 'npm', 'node_modules', 'mcp-remote', 'dist', 'proxy.js'));
    }
    candidates.push(path.join(home, 'AppData', 'Roaming', 'npm', 'node_modules', 'mcp-remote', 'dist', 'proxy.js'));
  } else {
    candidates.push(
      path.join(home, '.npm-global', 'lib', 'node_modules', 'mcp-remote', 'dist', 'proxy.js'),
      path.join(home, '.npm', 'lib', 'node_modules', 'mcp-remote', 'dist', 'proxy.js'),
      '/usr/local/lib/node_modules/mcp-remote/dist/proxy.js',
      '/usr/lib/node_modules/mcp-remote/dist/proxy.js'
    );
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Fallback: Ask npm directly
  try {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const npmRoot = execSync(`${npmCommand} root -g`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (npmRoot) {
      const candidate = path.join(npmRoot, 'mcp-remote', 'dist', 'proxy.js');
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  } catch (err) {
    // Ignore error and fall through to default guess
  }

  // Final fallback guess
  return process.platform === 'win32'
    ? path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'npm', 'node_modules', 'mcp-remote', 'dist', 'proxy.js')
    : path.join(home, '.npm-global', 'lib', 'node_modules', 'mcp-remote', 'dist', 'proxy.js');
}

function openUrl(url) {
  const cmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(cmd, [url], { shell: true });
}

// Executes an MCP tool through the proxy
async function callMcpTool(toolName, toolArgs, quiet = false) {
  const proxyPath = resolveProxyPath();
  if (!fs.existsSync(proxyPath)) {
    throw new Error(`mcp-remote proxy not found at "${proxyPath}". Please ensure it is installed globally via "npm install -g mcp-remote".`);
  }

  return new Promise((resolve, reject) => {
    if (!quiet) console.error(`[Client] Starting mcp-remote proxy to ${REMOTE_URL}...`);
    const child = spawn('node', [proxyPath, REMOTE_URL], {
      stdio: ['pipe', 'pipe', 'inherit']
    });

    let idCounter = 1;
    const pendingRequests = new Map();
    let initialized = false;
    let buffer = '';

    child.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        if (!trimmed.startsWith('{')) {
          if (!quiet) console.error(`[Proxy Log] ${trimmed}`);
          continue;
        }

        try {
          const message = JSON.parse(trimmed);
          handleMessage(message);
        } catch (err) {
          if (!quiet) console.error(`[Client Error] Failed to parse message: ${trimmed}`, err);
        }
      }
    });

    child.on('close', (code) => {
      if (!quiet) console.error(`[Client] Proxy process exited with code ${code}`);
      if (!initialized) {
        reject(new Error('Process exited before initialization completed'));
      }
    });

    child.on('error', (err) => {
      console.error('[Client] Process error:', err);
      reject(err);
    });

    function send(msg) {
      child.stdin.write(JSON.stringify(msg) + '\n');
    }

    function handleMessage(msg) {
      if (msg.id !== undefined && pendingRequests.has(msg.id)) {
        const { resolveReq, rejectReq } = pendingRequests.get(msg.id);
        pendingRequests.delete(msg.id);
        if (msg.error) {
          rejectReq(msg.error);
        } else {
          resolveReq(msg.result);
        }
      }
    }

    async function makeRequest(method, params) {
      const id = idCounter++;
      return new Promise((resolveReq, rejectReq) => {
        pendingRequests.set(id, { resolveReq, rejectReq });
        send({ jsonrpc: '2.0', id, method, params });
      });
    }

    setTimeout(async () => {
      try {
        await makeRequest('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'clickup-mcp-global', version: '1.0.0' }
        });
        
        send({ jsonrpc: '2.0', method: 'notifications/initialized' });
        initialized = true;
        if (!quiet) console.error('[Client] Session initialized successfully.');

        if (!quiet) console.error(`[Client] Calling tool "${toolName}" with args:`, JSON.stringify(toolArgs));
        const toolResult = await makeRequest('tools/call', {
          name: toolName,
          arguments: toolArgs
        });

        child.stdin.end();
        resolve(toolResult);
      } catch (err) {
        child.stdin.end();
        reject(err);
      }
    }, 1500);
  });
}

// Subcommand: auth
async function handleAuth() {
  const proxyPath = resolveProxyPath();
  if (!fs.existsSync(proxyPath)) {
    console.error(`[Error] mcp-remote proxy not found at "${proxyPath}". Please install it via "npm install -g mcp-remote".`);
    process.exit(1);
  }

  console.log(`[Client] Starting mcp-remote proxy in authentication mode...`);
  const child = spawn('node', [proxyPath, REMOTE_URL], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let detectedUrl = null;
  const timeout = setTimeout(() => {
    if (!detectedUrl) {
      console.log(`\n[Client] No authentication link detected after 5 seconds.`);
      console.log(`[Client] You are likely already authenticated!`);
      child.kill();
      process.exit(0);
    }
  }, 5000);

  const urlRegex = /(https?:\/\/[^\s]+)/g;

  function handleData(data) {
    const text = data.toString();
    if (!text.trim().startsWith('{')) {
      process.stderr.write(text);
    }

    const matches = text.match(urlRegex);
    if (matches && !detectedUrl) {
      const loginUrl = matches.find(url => url.includes('clickup.com') || url.includes('oauth'));
      if (loginUrl) {
        detectedUrl = loginUrl;
        clearTimeout(timeout);

        console.log('\n================================================================');
        console.log(`[Client] Authentication link detected:`);
        console.log(`\x1b[36m${detectedUrl}\x1b[0m`);
        console.log('================================================================\n');
        console.log('[Client] Opening the authentication link in your default browser...');

        openUrl(detectedUrl);

        console.log('\n[Client] Please complete the authorization in your browser.');
        console.log('[Client] Once completed, press ENTER here to finish the setup.');

        process.stdin.once('data', () => {
          console.log('[Client] Shutting down proxy...');
          child.kill();
          process.exit(0);
        });
      }
    }
  }

  child.stdout.on('data', handleData);
  child.stderr.on('data', handleData);

  child.on('close', (code) => {
    clearTimeout(timeout);
    console.log(`[Client] Proxy process exited with code ${code}`);
    process.exit(code);
  });
}

// Subcommand: projects list
function handleProjectsList() {
  if (!fs.existsSync(PROJECTS_JSON)) {
    console.log('No projects mapped yet. Create config/clickup-projects.json or run:');
    console.log('node clickup-mcp.js projects add <projectName> <clickupListNameOrId>');
    return;
  }
  try {
    const projects = JSON.parse(fs.readFileSync(PROJECTS_JSON, 'utf8'));
    console.log('\n=== Local Project Mappings ===');
    const keys = Object.keys(projects);
    if (keys.length === 0) {
      console.log('(No mapped projects found)');
      return;
    }
    for (const key of keys) {
      const config = projects[key];
      console.log(`\nProject: \x1b[32m${key}\x1b[0m`);
      console.log(`  Space Name: ${config.spaceName || 'N/A'} (ID: ${config.spaceId || 'N/A'})`);
      console.log(`  List Name:  ${config.listName || 'N/A'} (ID: ${config.listId || 'N/A'})`);
      console.log(`  Aliases:    ${config.aliases ? config.aliases.join(', ') : 'N/A'}`);
    }
    console.log('\n==============================');
  } catch (err) {
    console.error('Failed to read mappings:', err.message);
  }
}

// Subcommand: projects remote
async function handleProjectsRemote() {
  console.log('[Client] Querying remote ClickUp workspace hierarchy...');
  try {
    const result = await callMcpTool('clickup_get_workspace_hierarchy', {}, true);
    
    let hierarchyData;
    if (result.structuredContent && result.structuredContent.hierarchy) {
      hierarchyData = result.structuredContent.hierarchy;
    } else if (result.content && result.content[0] && result.content[0].text) {
      const parsed = JSON.parse(result.content[0].text);
      hierarchyData = parsed.hierarchy;
    }

    if (!hierarchyData || !hierarchyData.root) {
      console.error('[Error] Invalid hierarchy format received from ClickUp.');
      return;
    }

    const root = hierarchyData.root;
    console.log(`\n=== ClickUp Workspace: \x1b[35m${root.name || 'Workspace'}\x1b[0m (ID: ${root.id}) ===`);
    
    if (!root.children || root.children.length === 0) {
      console.log('(No spaces found)');
      return;
    }

    for (const space of root.children) {
      console.log(`\nSpace: \x1b[36m${space.name}\x1b[0m (ID: ${space.id})`);
      if (space.children && space.children.length > 0) {
        for (const child of space.children) {
          if (child.type === 'list') {
            console.log(`  ├── List: \x1b[32m${child.name}\x1b[0m (ID: ${child.id})`);
          } else if (child.type === 'folder') {
            console.log(`  ├── Folder: \x1b[33m${child.name}\x1b[0m (ID: ${child.id})`);
            if (child.children && child.children.length > 0) {
              for (const list of child.children) {
                console.log(`  │   └── List: \x1b[32m${list.name}\x1b[0m (ID: ${list.id})`);
              }
            }
          }
        }
      } else {
        console.log('  (Empty space)');
      }
    }
    console.log('\n====================================================');
  } catch (err) {
    console.error('[Error] Failed to fetch remote workspace hierarchy:', err.message);
  }
}

// Subcommand: projects add
async function handleProjectsAdd(projectName, listNameOrId) {
  if (!projectName || !listNameOrId) {
    console.log('Usage: node clickup-mcp.js projects add <projectName> <clickupListNameOrId>');
    return;
  }

  console.log(`[Client] Searching for ClickUp list "${listNameOrId}" in remote hierarchy...`);
  try {
    const result = await callMcpTool('clickup_get_workspace_hierarchy', {}, true);
    
    let hierarchyData;
    if (result.structuredContent && result.structuredContent.hierarchy) {
      hierarchyData = result.structuredContent.hierarchy;
    } else if (result.content && result.content[0] && result.content[0].text) {
      const parsed = JSON.parse(result.content[0].text);
      hierarchyData = parsed.hierarchy;
    }

    if (!hierarchyData || !hierarchyData.root) {
      console.error('[Error] Could not retrieve ClickUp hierarchy.');
      return;
    }

    let foundList = null;
    let foundSpace = null;

    const root = hierarchyData.root;
    for (const space of (root.children || [])) {
      for (const child of (space.children || [])) {
        if (child.type === 'list') {
          if (child.id === listNameOrId || child.name.toLowerCase() === listNameOrId.toLowerCase()) {
            foundList = child;
            foundSpace = space;
            break;
          }
        } else if (child.type === 'folder') {
          for (const list of (child.children || [])) {
            if (list.id === listNameOrId || list.name.toLowerCase() === listNameOrId.toLowerCase()) {
              foundList = list;
              foundSpace = space;
              break;
            }
          }
        }
      }
      if (foundList) break;
    }

    if (!foundList) {
      console.error(`[Error] ClickUp list matching "${listNameOrId}" not found in your workspace.`);
      console.log('Run "node clickup-mcp.js projects remote" to see all available lists.');
      return;
    }

    const configDir = path.dirname(PROJECTS_JSON);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    let projects = {};
    if (fs.existsSync(PROJECTS_JSON)) {
      try {
        projects = JSON.parse(fs.readFileSync(PROJECTS_JSON, 'utf8'));
      } catch (e) {
        console.warn('[Warning] Failed to parse existing clickup-projects.json, creating new.');
      }
    }

    const key = projectName.toLowerCase();
    projects[key] = {
      spaceId: foundSpace.id,
      listId: foundList.id,
      listName: foundList.name,
      spaceName: foundSpace.name,
      aliases: [projectName, key]
    };

    fs.writeFileSync(PROJECTS_JSON, JSON.stringify(projects, null, 2), 'utf8');
    console.log(`\n\x1b[32m[Success] Successfully mapped local project "${projectName}" to ClickUp:\x1b[0m`);
    console.log(`  Space: ${foundSpace.name} (ID: ${foundSpace.id})`);
    console.log(`  List:  ${foundList.name} (ID: ${foundList.id})`);
    console.log(`  Saved to: config/clickup-projects.json\n`);
  } catch (err) {
    console.error('[Error] Failed to add project mapping:', err.message);
  }
}

// CLI Routing
const args = process.argv.slice(2);
if (args.length < 1) {
  console.log('Usage:');
  console.log('  node clickup-mcp.js auth                                              - Authenticate with ClickUp');
  console.log('  node clickup-mcp.js projects list                                     - List locally mapped projects');
  console.log('  node clickup-mcp.js projects remote                                   - List remote workspace spaces & lists');
  console.log('  node clickup-mcp.js projects add <projectName> <clickupListNameOrId>  - Map a local project to ClickUp');
  console.log('  node clickup-mcp.js <toolName> [jsonArgsString]                      - Execute standard MCP tool');
  process.exit(1);
}

const subcommand = args[0];

if (subcommand === 'auth') {
  handleAuth();
} else if (subcommand === 'projects') {
  const action = args[1] || 'list';
  if (action === 'list') {
    handleProjectsList();
  } else if (action === 'remote') {
    handleProjectsRemote();
  } else if (action === 'add') {
    handleProjectsAdd(args[2], args[3]);
  } else {
    console.log(`Unknown projects action: ${action}. Use 'list', 'remote', or 'add'.`);
  }
} else {
  // Standard Tool Execution Flow
  const toolName = subcommand;
  const jsonArgsString = args[1] || '{}';
  let toolArgs = {};

  try {
    toolArgs = JSON.parse(jsonArgsString);
  } catch (e) {
    console.error('Failed to parse JSON arguments:', e.message);
    process.exit(1);
  }

  // Automatically resolve project name from directory if not present
  let resolvedProjectName = toolArgs.project;
  let isAutoResolved = false;

  if (!resolvedProjectName && !toolArgs.list_ids && !toolArgs.list_id) {
    const cwdName = path.basename(process.cwd());
    if (cwdName) {
      resolvedProjectName = cwdName;
      isAutoResolved = true;
    }
  }

  const runCall = () => {
    callMcpTool(toolName, toolArgs)
      .then((res) => {
        console.log(JSON.stringify(res, null, 2));
        process.exit(0);
      })
      .catch((err) => {
        console.error('Error during tool execution:', err);
        process.exit(1);
      });
  };

  if (resolvedProjectName) {
    try {
      if (fs.existsSync(PROJECTS_JSON)) {
        const projects = JSON.parse(fs.readFileSync(PROJECTS_JSON, 'utf8'));
        
        let projectConfig = projects[resolvedProjectName.toLowerCase()];
        if (!projectConfig) {
          for (const [key, config] of Object.entries(projects)) {
            if (Array.isArray(config.aliases)) {
              if (config.aliases.some(alias => alias.toLowerCase() === resolvedProjectName.toLowerCase())) {
                projectConfig = config;
                break;
              }
            }
          }
        }

        if (projectConfig) {
          if (projectConfig.listId) {
            toolArgs.list_ids = [projectConfig.listId];
            toolArgs.list_id = projectConfig.listId;
          }
          
          if (isAutoResolved) {
            console.error(`[Client] Auto-resolved workspace folder "${resolvedProjectName}" to ClickUp list_id: ${projectConfig.listId}`);
          } else {
            console.error(`[Client] Resolved project "${resolvedProjectName}" to ClickUp list_id: ${projectConfig.listId}`);
          }
          
          delete toolArgs.project;
        } else {
          if (!isAutoResolved) {
            console.error(`[Client Warning] Project "${resolvedProjectName}" not found in clickup-projects.json`);
          }
        }
      } else {
        if (!isAutoResolved) {
          console.error(`[Client Warning] Projects config file not found at ${PROJECTS_JSON}`);
        }
      }
    } catch (err) {
      console.error('[Client Warning] Failed to read clickup-projects.json:', err.message);
    }
  }

  runCall();
}
