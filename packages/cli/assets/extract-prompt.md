Read this repository's shipped styling and extract its real design system.

Look at what actually ships, not what the docs claim: global stylesheets, the
Tailwind or theme config, CSS custom properties, component files, and the
values that repeat across them. Prefer the values used most often over the ones
declared once.

Produce a design system object with this shape:

  {
    "schemaVersion": 1,
    "meta": { "name": "<product name>", "source": "code" },
    "tokens": {
      "color":   { "<name>": { "value": "<css color>", "usage": "<where it is used>" } },
      "typography": {
        "families":      { "<name>": { "value": "<font stack>" } },
        "sizes":         { "<name>": { "value": "<length>" } },
        "weights":       { "<name>": { "value": "<number>" } },
        "lineHeights":   { "<name>": { "value": "<number or length>" } },
        "letterSpacing": { "<name>": { "value": "<length>" } }
      },
      "spacing": { "<name>": { "value": "<length>" } },
      "radius":  { "<name>": { "value": "<length>" } },
      "shadow":  { "<name>": { "value": "<box-shadow>" } },
      "border":  { "<name>": { "value": "<length>" } }
    },
    "components": [
      { "name": "Button", "description": "...", "anatomy": "...",
        "variants": ["primary"], "tokensUsed": ["color.primary"],
        "dos": ["..."], "donts": ["..."] }
    ],
    "rules": [ { "id": "no-raw-color", "statement": "...", "severity": "must" } ]
  }

Rules for the extraction itself:

- Name tokens for their role, not their appearance: `primary`, `ink`, `muted`,
  `surface` — never `blue600`.
- Collapse near-duplicate values into one token. Three near-miss blues in the
  codebase are one `primary` plus two mistakes; pick the one that ships most.
- Keep scales small and even. A spacing scale of seven steps beats one of
  nineteen.
- Write the usage note for a stranger: where this token belongs, in a phrase.
- Record the rules the code already follows, even unwritten ones — one primary
  button per view, cards never nest, headings never skip a level.

Then call the `push_design_system` tool on the `miswadah` MCP server with the
object as `system`. Report back the version number and the token count.

Finally, attach screenshots. The tokens carry the values; the screenshots carry
the look, and a later agent can see them where it cannot see a hex code. Run
the app, capture the two to four screens that carry the most of its character,
and call `add_screen` for each — WebP around 1200px wide, under 400 KB.

If you cannot run the app, skip this step. Do not invent screenshots.
