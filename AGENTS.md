# Agent guide

This file tells agents how to install [rob-janoff-design](https://github.com/carrapido/rob-janoff-design). The skill itself lives in `skills/rob-janoff-design/SKILL.md`.

Only run the commands needed for the task the user approved. Do not read secrets, unrelated files or home-directory configuration beyond the skills directory below.

## Install

1. Pick the personal skills directory of the agent you are:

   | Agent | Skills directory |
   | --- | --- |
   | Claude Code | `~/.claude/skills/` |
   | Codex | `~/.agents/skills/` |
   | Gemini CLI | `~/.gemini/skills/` |
   | GitHub Copilot | `~/.copilot/skills/` |
   | Cursor | `~/.cursor/skills/` |
   | Any other agent | The skills directory your own documentation defines. |

2. Clone the repository into a temporary directory:
   `git clone --depth 1 https://github.com/carrapido/rob-janoff-design.git <temp-dir>`
3. If `<skills-directory>/rob-janoff-design/` already exists, ask the user before replacing it.
4. Copy `<temp-dir>/skills/rob-janoff-design/` into `<skills-directory>/`.
5. Check that `<skills-directory>/rob-janoff-design/SKILL.md` exists, then delete `<temp-dir>`.
6. Tell the user the final path and whether they must restart you to load the skill.

## Update

Repeat the install steps. Step 3 replaces the old copy once the user confirms.

## Uninstall

Delete `<skills-directory>/rob-janoff-design/`.

## Repository map

| Location | Purpose |
| --- | --- |
| `skills/rob-janoff-design/SKILL.md` | The skill: workflow the agent follows. |
| `skills/rob-janoff-design/references/` | Book chapters and the ruler-and-compass method, loaded on demand. |
| `skills/rob-janoff-design/scripts/` | Node 24 commands: `series-audit.ts` checks every curve against the golden series; `scale-report.ts` gives the on-screen size of every detail. |
| `tests/` | Tests for the scripts. |
| `.claude-plugin/marketplace.json` | Claude Code plugin marketplace. |

## Verification

After changing the repository, run `claude plugin validate .`, `npm test` and `npm run typecheck`, and report the results.
