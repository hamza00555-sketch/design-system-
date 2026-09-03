# Miswadah

**Serve your design system to every AI agent on every project.**
**قدِّم نظام التصميم الخاص بك لكل وكيل ذكاء اصطناعي في كل مشروع.**

---

## English

Every new agent session reinvents your brand — three near-miss blues, two border
radii, buttons that almost match. Miswadah keeps one canonical, versioned
design system in the cloud, serves it to your agents over MCP, and checks every
generation against it before you ever see the result.

### How it works

1. **Extract** — `npx miswadah extract-prompt` prints a prompt. Paste it into
   your agent; it reads your shipped styling and pushes the real system up.
   No Figma library, no code parser to maintain.
2. **Connect** — `npx miswadah init` wires the repo: MCP config for Claude
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
packages/api    the HTTP API and MCP endpoint, host-agnostic
packages/cli    the npm package: init · whoami · extract-prompt
apps/web/       the site, the dashboard, and the API — Arabic and English
functions/      the same API on Firebase, for anyone on the Blaze plan
scripts/        local dev server — no emulator, no Java
```

### Private by default

The first person to sign in claims the instance; after that, sign-up is refused
and the only way in is an invitation. No configuration, and it fails closed.
`ALLOWED_EMAILS` admits more addresses, `OPEN_SIGNUPS=1` runs it as a public
product, and `NEXT_PUBLIC_PUBLIC_SITE=1` puts the landing page back in front of
the dashboard.

### Teams and billing

**Billing is off by default.** The deployment is open: unlimited projects,
teammates, and generations, with no plan to choose. The limits and the Stripe
path are present but dormant — `BILLING_ENABLED=1` on the functions and
`NEXT_PUBLIC_BILLING_ENABLED=1` on the web app turn them on, and nothing else
changes. They are kept rather than deleted because "open for now" is a decision
that reverses, and rebuilding seat counting the second time is the same work as
the first.

With billing on: one design system, one project, one person on free; paying
starts at the second project or the second teammate. A pending invitation holds
a seat, so the refusal lands on the person doing the inviting rather than on
whoever arrives last. Stripe drives the plan through signed webhooks —
checkout succeeding is not the event that matters — and `past_due` keeps the
paid features on, because a failed card is a card problem, not a downgrade.

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
pnpm --filter @miswadah/functions build
npx firebase emulators:start --project demo-miswadah --only auth,firestore,functions
pnpm --filter @miswadah/web dev
```

Then, in any repo:

```bash
MISWADAH_API_BASE=http://localhost:8787 \
  node packages/cli/dist/cli.js init --code DEV1-2345
```

### Deploying

Vercel runs the site and the API; Firebase provides sign-in and the database.
Both on their free plans — deploying Cloud Functions would need Firebase's paid
Blaze plan, so the API lives with the site instead. The runbook is in
[DEPLOY.md](DEPLOY.md).

Firestore holds teams, systems, immutable versions, projects, and connect
codes. **Every write goes through Cloud Functions** — the rules make the client
read-only, and the two secret collections (`projectKeys`, `connectCodes`)
unreadable entirely. Project keys are returned once at connect time and stored
only as a SHA-256 hash.

---

<div dir="rtl">

## العربية

كل جلسة جديدة مع وكيل ذكاء اصطناعي تعيد اختراع هويتك البصرية — ثلاثة درجات زرقاء
متقاربة، قُطران مختلفان للحواف، أزرار «تكاد» تتطابق. Miswadah يحتفظ بنظام تصميم
واحد مرجعي ومُصدَّر في السحابة، يقدّمه لوكلائك عبر MCP، ويتحقق من كل ما يولّدونه
قبل أن تراه أنت.

### كيف يعمل

1. **الاستخراج** — `npx miswadah extract-prompt` يطبع برومبتًا. الصقه في وكيلك؛
   يقرأ أنماط مشروعك الفعلية ويرفع النظام الحقيقي. بلا مكتبة Figma وبلا محلل كود
   تصونه بنفسك.
2. **التوصيل** — `npx miswadah init` يجهّز المستودع: إعدادات MCP لـ Claude Code
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
والداشبورد، والفرق والفوترة، وموقع التسويق وتدفّق الإعداد. الموقع **ثنائي اللغة
(عربي/إنجليزي) مع دعم كامل لاتجاه RTL** — التفاصيل في `apps/web/README.md`.

**الفوترة مُطفأة افتراضيًا**: النشر مفتوح — مشاريع وأعضاء وتوليدات بلا حدود، وبلا
خطة تختارها. وآلية الخطط موجودة لكنها نائمة، يوقظها متغيّر بيئة واحد على كل جانب.
وخطوات النشر (Firebase و Vercel) في [DEPLOY.md](DEPLOY.md).

</div>

---

## License

MIT
