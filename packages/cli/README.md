# tokenwell

**Serve your design system to every AI agent on every project.**

Every new agent session reinvents your brand — three near-miss blues, two
border radii, buttons that almost match. Tokenwell keeps one canonical,
versioned design system in the cloud, serves it to your agents over MCP, and
checks every generation against it before you see the result.

## Connect a repo

```bash
npx tokenwell init
```

You will be asked for a connect code — mint one on the Connect screen of your
dashboard. It works once and expires in fifteen minutes.

`init` does four things, and rolls all of them back if any step fails:

1. Registers this repo as a project and receives its API key.
2. Writes `.mcp.json` (Claude Code); pass `--cursor` to also write
   `.cursor/mcp.json`. These hold the project key, so init gitignores them.
3. Stores the project id in `.tokenwell.json` — never the key.
4. Installs the agent rules block into `CLAUDE.md` and `AGENTS.md`, between
   `<!-- tokenwell:start/end -->` markers. Idempotent; your content is left
   exactly as it was.

## What your agent gets

- **`get_design_system`** — tokens, components, and rules rendered for
  generation. Consulted before any visual work.
- **`verify`** — checks written files against the system: colours within ΔE 2
  of a token, and spacing, type, and radii exactly on their scales. Reports
  each off-brand value with the token to use instead.
- **`push_design_system`** — a new immutable version, with full history.
- **`list_versions`**, **`restore_version`**, **`export_design_system`**.

## Commands

```bash
npx tokenwell init [--code <code>] [--cursor]   # connect this repo
npx tokenwell whoami                            # show this repo's connection
npx tokenwell extract-prompt                    # the prompt that builds your system
```

## Self-hosting

`TOKENWELL_API_BASE` points the CLI at a different deployment:

```bash
TOKENWELL_API_BASE=https://your-api npx tokenwell init --code XXXX-XXXX
```

Your design system stays yours: export a clean `DESIGN.md` and W3C design
tokens from the dashboard at any time, on any plan.

MIT licensed.
