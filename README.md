# Tokenwell

**Serve your design system to every AI agent on every project.**
**قدِّم نظام التصميم الخاص بك لكل وكيل ذكاء اصطناعي في كل مشروع.**

---

## English

Every new agent session reinvents your brand — three near-miss blues, two border
radii, buttons that almost match. Tokenwell keeps one canonical, versioned
design system in the cloud, serves it to your agents over MCP, and checks every
generation against it before you ever see the result.

### How it works

1. **Extract** — `npx tokenwell extract-prompt` prints a prompt. Paste it into
   your agent; it reads your shipped styling and pushes the real system up.
   No Figma library, no code parser to maintain.
2. **Connect** — `npx tokenwell init` wires the repo: MCP config for Claude
   Code and Cursor, plus a rules block in `CLAUDE.md` and `AGENTS.md` that
   teaches the agent to consult before visual work and verify after.
3. **Stay on brand** — every generation is verified. Off-brand values come back
   named, with the token to use instead.

### What the agent gets

| Tool | What it does |
| --- | --- |
| `get_design_system` | Tokens, components, and rules rendered for generation. |
| `verify` | Checks written files: colours within ΔE 2, scales matched exactly. |
| `push_design_system` | A new immutable version, with full history. |
| `list_versions` / `restore_version` | Inspect and roll back. |
| `export_design_system` | `DESIGN.md` or W3C design-tokens JSON, any time. |

### Verification, precisely

- **Colour** — converted to CIELAB and compared by CIEDE2000. Under ΔE 2 passes,
  which survives hex rounding and colour-space round-trips but still catches the
  near-miss blue an agent reached for.
- **Scales** — spacing, font size, weight, line height, letter spacing, and
  radius must land *exactly* on the scale, after normalising `rem` to `px`.
- **What is read** — CSS declarations, React `style={{ … }}` objects (camelCase
  included), and Tailwind arbitrary values (`bg-[#3D7BF2]`, `p-[14px]`,
  `rounded-[7px]`). Comments, SVG path data, `data:` URIs, and `var(--token)`
  references are never reported.

### Repository layout

```
packages/core   schema, verification engine, exporters   (no I/O, fully tested)
packages/mcp    the MCP tools, over a Store interface
packages/cli    the npm package: init · whoami · extract-prompt
functions/      Firebase Cloud Functions: the API, the MCP endpoint, billing
apps/web/       the site and dashboard, in Arabic and English
scripts/        local dev server — no emulator, no Java
```

### Teams and billing

The free plan is one design system, one project, one person. Paying starts at
the second project or the second teammate. A pending invitation holds a seat,
so the refusal lands on the person doing the inviting rather than on whoever
arrives last.

Stripe drives the plan through signed webhooks — checkout succeeding is not the
event that matters. `past_due` keeps the paid features on, because a failed
card is a card problem, not a downgrade.

### Working on it

```bash
pnpm install
pnpm test                     # 105 tests, no network needed
pnpm build                    # build every package

node scripts/dev-server.mjs   # the API, in memory, on :8787
```

For the full stack — auth, Firestore, billing webhooks — run the emulators
instead, and see `apps/web/README.md` for the web app's environment:

```bash
pnpm --filter @tokenwell/functions build
npx firebase emulators:start --project demo-tokenwell --only auth,firestore,functions
pnpm --filter @tokenwell/web dev
```

Then, in any repo:

```bash
TOKENWELL_API_BASE=http://localhost:8787 \
  node packages/cli/dist/cli.js init --code DEV1-2345
```

### Deploying

See [DEPLOY.md](DEPLOY.md) for the full runbook: Firebase, Stripe, the web app,
and publishing the CLI — with the pre-launch checklist.

```bash
firebase use <your-project>
pnpm --filter @tokenwell/functions build
firebase deploy --only functions,firestore:rules,firestore:indexes
```

Firestore holds teams, systems, immutable versions, projects, and connect
codes. **Every write goes through Cloud Functions** — the rules make the client
read-only, and the two secret collections (`projectKeys`, `connectCodes`)
unreadable entirely. Project keys are returned once at connect time and stored
only as a SHA-256 hash.

---

<div dir="rtl">

## العربية

كل جلسة جديدة مع وكيل ذكاء اصطناعي تعيد اختراع هويتك البصرية — ثلاثة درجات زرقاء
متقاربة، قُطران مختلفان للحواف، أزرار «تكاد» تتطابق. Tokenwell يحتفظ بنظام تصميم
واحد مرجعي ومُصدَّر في السحابة، يقدّمه لوكلائك عبر MCP، ويتحقق من كل ما يولّدونه
قبل أن تراه أنت.

### كيف يعمل

1. **الاستخراج** — `npx tokenwell extract-prompt` يطبع برومبتًا. الصقه في وكيلك؛
   يقرأ أنماط مشروعك الفعلية ويرفع النظام الحقيقي. بلا مكتبة Figma وبلا محلل كود
   تصونه بنفسك.
2. **التوصيل** — `npx tokenwell init` يجهّز المستودع: إعدادات MCP لـ Claude Code
   و Cursor، وكتلة قواعد داخل `CLAUDE.md` و `AGENTS.md` تعلّم الوكيل أن يستشير
   النظام قبل أي عمل بصري وأن يتحقق بعده.
3. **البقاء على الهوية** — كل توليد يُفحص. القيم الخارجة عن الهوية تعود مُسمّاة،
   ومعها التوكن الذي يجب استخدامه بدلاً منها.

### آلية التحقق بدقّة

- **الألوان** — تُحوَّل إلى فضاء CIELAB وتُقارن بمعادلة CIEDE2000. ما دون ΔE 2 يمرّ
  (وهذا يتحمّل تقريب الـ hex وتحويلات فضاءات الألوان) بينما يُمسك باللون الأزرق
  «القريب» الذي اخترعه الوكيل.
- **السلالم** — المسافات وأحجام الخط وأوزانه وارتفاع السطر وتباعد الحروف والأقطار
  يجب أن تقع **تمامًا** على السلّم، بعد تطبيع `rem` إلى `px`.
- **ما يُقرأ** — تعريفات CSS، وكائنات `style={{ … }}` في React (بصيغة camelCase
  أيضًا)، وقيم Tailwind العشوائية مثل `bg-[#3D7BF2]` و `p-[14px]`. أمّا التعليقات
  وبيانات مسارات SVG وروابط `data:` ومراجع `var(--token)` فلا يُبلَّغ عنها أبدًا.

### الحالة الحالية

المشروع مكتمل بمراحله الأربع: المحرك (الـ CLI وخادم MCP والتحقق والتصدير)،
والداشبورد، والفرق والفوترة عبر Stripe، وموقع التسويق وتدفّق الإعداد. الموقع
**ثنائي اللغة (عربي/إنجليزي) مع دعم كامل لاتجاه RTL** — التفاصيل في
`apps/web/README.md`، وخطوات النشر في [DEPLOY.md](DEPLOY.md).

</div>

---

## License

MIT
