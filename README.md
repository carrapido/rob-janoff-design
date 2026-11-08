# rob-janoff-design

An [Agent Skill](https://agentskills.io/specification) that makes an AI agent design logos, icons and monograms with Rob Janoff's methodology from *Taking a Bite out of the Apple*:

1. Do your homework: business, audience, USP.
2. Abstract the shape: silhouette, cross-section, scale relation.
3. Add "a wink and a smile".
4. Deliver three SVG concepts, each tested in color, solid monochrome and at 256, 48 and 16 px.


## Install

Paste this prompt into your agent (Claude Code, Codex, Gemini CLI, GitHub Copilot, Cursor or any agent that supports [Agent Skills](https://agentskills.io)):

```text
Install the agent skill "rob-janoff-design" from https://github.com/carrapido/rob-janoff-design

1. Clone the repository into a temporary directory:
   git clone --depth 1 https://github.com/carrapido/rob-janoff-design.git
2. Copy its skills/rob-janoff-design/ folder into the personal skills directory of the agent you are:
   - Claude Code: ~/.claude/skills/
   - Codex: ~/.agents/skills/
   - Gemini CLI: ~/.gemini/skills/
   - GitHub Copilot: ~/.copilot/skills/
   - Cursor: ~/.cursor/skills/
   - Any other agent: the skills directory your own documentation defines.
3. Check that <skills-directory>/rob-janoff-design/SKILL.md exists, then delete the temporary clone.
4. Tell me the final path and whether I must restart you to load the skill.
```

<details>
<summary>Install with a CLI instead</summary>

| Agent | Command |
|---|---|
| Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, OpenCode and 70+ more | `npx skills add carrapido/rob-janoff-design` |
| Claude Code (plugin) | `/plugin marketplace add carrapido/rob-janoff-design`, then `/plugin install rob-janoff-design@rob-janoff-design` |
| Gemini CLI | `gemini skills install https://github.com/carrapido/rob-janoff-design.git --path skills/rob-janoff-design` |

### Manual install

Copy `skills/rob-janoff-design/` into your agent's skills directory:

| Agent | Personal | Project |
|---|---|---|
| Claude Code | `~/.claude/skills/` | `.claude/skills/` |
| Codex | `~/.agents/skills/` | `.agents/skills/` |
| Gemini CLI | `~/.gemini/skills/` | `.gemini/skills/` |
| GitHub Copilot | `~/.copilot/skills/` | `.github/skills/` |
| Cursor | `~/.cursor/skills/` | `.agents/skills/` |

</details>

## Usage

Ask your agent for a logo, for example: *"Diseña el logo de una cafetería de especialidad en Oaxaca"*. The skill triggers on requests to create a logo, design a brand icon, vectorize a concept in SVG or evaluate a visual identity.

## Repository layout

```
.
├── .claude-plugin/
│   └── marketplace.json        # Claude Code plugin marketplace
└── skills/
    └── rob-janoff-design/
        ├── SKILL.md            # Workflow the agent follows
        └── references/         # Book chapters, loaded on demand
            ├── 01-proceso-apple.md
            ├── 02-casos-estudio.md
            └── 03-reglas-y-tipografia.md
```

## Disclaimer

Unofficial project, not affiliated with or endorsed by Rob Janoff. The references are original summaries of the book with short quotations; no text or files from the book are included.

## License

[MIT](LICENSE)
