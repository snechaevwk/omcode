# Oh My Code (OM Code)

<!-- fork:begin — fork-only section. Upstream's README is not kept here; resolve sync conflicts in this file by keeping ours. -->

> [!NOTE]
> **OM Code is a personal fork of [T3 Code](https://github.com/pingdotgg/t3code)** by [pingdotgg](https://github.com/pingdotgg). It is not affiliated with or supported by the T3 Code team. Please don't report OM Code issues upstream.

| Branch | Role                                                                                         |
| ------ | -------------------------------------------------------------------------------------------- |
| `main` | Byte-for-byte mirror of [`pingdotgg/t3code`](https://github.com/pingdotgg/t3code) `main`.    |
| `work` | Default branch. Upstream plus the OM Code changes below. Branch from here and open PRs here. |

Sync with upstream using [`fork/sync-fork.sh`](./fork/sync-fork.sh); see [`fork/README.md`](./fork/README.md). Fork-only tooling lives in `fork/`, never in `scripts/`.

<!-- fork:end -->

OM Code is a GUI for the coding agents on your machine, with web, desktop, and mobile clients. It works with your existing subscriptions on Claude Code, Codex, Cursor, Grok Build, OpenCode, Google Antigravity, Kiro, and fx.

## What's different from T3 Code

- **OM Code branding** — name, app icons, favicon, loading splash, and a compact, flat look on web, desktop, and mobile.
- **Project-grouped sidebar** — threads are grouped and nested under their projects, idle projects fold away, project headers show task counts per state, and each header has a new-thread button.
- **Project actions menu** — hover a sidebar project header and click **…** (or right-click it) to rename the project, copy its path, open its settings, or remove it.
- **Scheduled tasks shortcut** — a calendar icon next to Usage at the bottom of the sidebar opens **Settings → Scheduled tasks**; hover it to see each task's schedule and next run.
- **Token usage and cost** — per-thread token usage and estimated cost.

Everything else follows upstream.

## Running from source

Install and authenticate at least one provider first:

- Codex: [Codex CLI](https://developers.openai.com/codex/cli), then `codex login`
- Claude: [Claude Code](https://claude.com/product/claude-code), then `claude auth login`
- Cursor: [Cursor CLI](https://cursor.com/cli), then `agent login`
- Grok Build: [Grok Build CLI](https://x.ai/cli), then `grok login`
- OpenCode: [OpenCode](https://opencode.ai), then `opencode auth login`
- Antigravity: enable it in Settings, then use **Install Antigravity** and **Sign in with Google**
- Kiro: [Kiro CLI](https://kiro.dev/docs/cli/), then `kiro-cli login` ([setup guide](./docs/user/providers-kiro.md))
- fx: [fx](https://fx.sh), then `fx login` ([setup guide](./docs/user/providers-fx.md))

The repo uses [Vite+](https://viteplus.dev/guide/), so install the global `vp` command (`curl -fsSL https://vite.plus | bash`), then:

```bash
vp i                      # install dependencies
vp run dev                # server + web app
vp run dev:desktop        # desktop app in dev mode
vp run dist:desktop:dmg   # build a macOS desktop app
```

## Documentation

The docs in [docs/](./docs) come from upstream and still say "T3 Code"; they apply to OM Code unless a feature above says otherwise.

- [Permission modes](./docs/user/permission-modes.md)
- [Keyboard shortcuts](./docs/user/keybindings.md)
- [Project settings](./docs/user/project-settings.md)
- [Remote access from a phone or another machine](./docs/user/remote-access.md)
- [Connect outside agents over MCP](./docs/user/outside-agents.md)
- [Source control integrations](./docs/user/source-control.md)
- Multiple accounts: [Codex](./docs/user/providers-codex.md) · [Claude](./docs/user/providers-claude.md)
- Architecture: [docs/internals/overview.md](./docs/internals/overview.md)

## License

MIT, inherited from upstream. See [LICENSE](./LICENSE).
