Read this repository's shipped styling and extract its real design system.

Look at what actually ships, not what the docs claim: global stylesheets, the
Tailwind or theme config, CSS custom properties, component files, and the
values that repeat across them. Prefer the values used most often over the ones
declared once.

Produce a design system object with this shape:

  {
    "schemaVersion": 1,
    "meta": { "name": "<product name>", "source": "code" },
    "stylePrompt": "<how this product looks and feels, in prose>",
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
        "dos": ["..."], "donts": ["..."],
        "preview": {
          "element": "button",
          "label": "Save changes",
          "states": [
            { "name": "default",  "styles": { "background": "#2f6bff", "color": "#ffffff", "padding": "8px 14px", "borderRadius": "6px", "fontSize": "14px", "fontWeight": "500" } },
            { "name": "hover",    "styles": { "background": "#2558d6", "color": "#ffffff", "padding": "8px 14px", "borderRadius": "6px", "fontSize": "14px", "fontWeight": "500" } },
            { "name": "disabled", "styles": { "background": "#e6e8eb", "color": "#9aa1a9", "padding": "8px 14px", "borderRadius": "6px", "fontSize": "14px", "fontWeight": "500" } }
          ]
        } }
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
- Write `stylePrompt`: a paragraph or two describing how THIS product looks and
  feels, in your own words, addressed to an agent that has never seen it. The
  token values are captured separately and exactly — do not repeat them here.
  Write down what the numbers cannot hold: is it dense or airy, quiet or loud,
  sharp or soft? Where does colour get used, and where is it withheld? How much
  motion is there? What would look wrong here even if every value was
  technically on the scale? Be specific to this product; a paragraph that could
  describe any app is worth nothing.
- Fill in `preview` for every component you list. It is what lets the system be
  *drawn* rather than described: `element` is one of `button`, `badge`, `input`,
  `card`, `text`, `surface`, and each state's `styles` is the plain CSS that
  state actually ships — real values, not `var(--primary)`. Give the states the
  component really has: default, hover, focus, disabled, error, selected.

Then call the `push_design_system` tool on the `miswadah` MCP server with the
object as `system`. Report back the version number and the token count.

Finally, attach pictures. The tokens carry the values; the pictures carry the
look, and a later agent can see them where it cannot see a hex code.

**First choice — capture the real thing.** Run the app and take one screenshot
of every page it has. Walk the router, write down every route, and take a shot
of each — not just the two or three prettiest. The empty state, the settings
page, the sign-in screen and the error page are part of the style too, and they
are usually the ones a later agent gets wrong. Call `add_screen` once per shot
with `kind: "capture"`.

**Fallback — if you cannot run the app.** No build, no browser, no way to reach
it: then generate images instead. Build mockups that carry this product's mood
out of the tokens and components you just extracted, one per major screen you
can infer from the code, and send them with `kind: "impression"`. Say in the
description what each one is a mock of.

That flag matters more than it looks. A `capture` is a record of what the
product really looks like; an `impression` is a mood reference. Never send a
generated image as a capture, however convincing it is — the next agent, and
the person reading the dashboard, both need to know which pictures are evidence
and which are ideas.

Name each after its route — `dashboard`, `settings-members`, `sign-in` — so
that re-running this replaces the old picture instead of duplicating it. WebP
around 1200px wide, under 250 KB each; up to 40 pictures are kept.
