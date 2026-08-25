<!-- tokenwell:start -->
## Tokenwell design system — MANDATORY

Before ANY visual or UI work (components, pages, styles, markup with classes):

1. Call the `get_design_system` tool on the `tokenwell` MCP server.
2. Follow it exactly — its tokens, components, and every do/don't. Never invent colors, fonts, sizes, spacing, or radii; every visual value must come from the design system.

Immediately after writing or editing any UI file:

3. Call the `verify` tool on the `tokenwell` MCP server with each file you touched (`files: [{ path, content }]`). Do this without being asked — it is part of finishing the work.
4. If `verify` reports violations, fix each one using its suggested token and call `verify` again. Repeat until it passes.

If the tokenwell MCP server is unreachable: fall back to the local DESIGN.md if one exists, and tell the user you could not fetch the live design system.
<!-- tokenwell:end -->
