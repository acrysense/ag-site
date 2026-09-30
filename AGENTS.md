# AGENTS.md

Instructions for Codex and other AI agents working in this repository.

Project: markup for the new corporate site my.apteka-group.by (separate build, new Bitrix template).
Backend is Bitrix. Context and open questions: `HANDOFF.md` (kept locally, not in the repository).

The main requirement of the spec: everything the admin edits must not be hard-coded.

## Main rules

- Do not change design, HTML structure, text, images or project SCSS without an explicit task.
- Use `vite-starter` only as the build architecture reference.
- Do not bring back `vite-plugin-imagemin`, `vite-plugin-svg-icons`, `vite-plugin-handlebars` or
  `vite-plugin-static-copy` without a specific reason.
- Do not run `npm audit fix --force`.
- Do not make major migrations without separate approval (Vite stays on 7.x).
- Do not remove dependencies before checking real imports and usage.
- Do not add libraries "just in case".
- Do not change visual behavior for internal "cleanliness".
- Do not start markup of a block before its markup contract with the backend is agreed: stable
  classes, `data-` attributes for JS, admin fields.

## JS and lifecycle

- Every new interactive module must return a disposer (or set `el.__dispose`).
- Every `addEventListener` must have a matching `removeEventListener`.
- Timers must be cleared.
- RAF handles must be cancelled.
- Observers must be disconnected.
- Fetch and async operations must not update DOM after unmount.
- Swiper, Inputmask and other instances must be destroyed in dispose.
- Repeated mount must not duplicate listeners. Do not add own `__bound` flags: `mount.js` guards it.
- Blocks added or removed after load (Bitrix AJAX, composite) are mounted/unmounted by the
  `MutationObserver` in `app.js`. A moved node is not re-initialised.
- Scroll-lock must stay compatible with nested modals: release exactly the lock you took.
- User text (comments, search) goes to DOM via `textContent`. `innerHTML` only with escaping.
- Every form is sent with `bitrix_sessid`.

## SCSS and components

- Colors, spacing, radii, shadows, fonts, durations come only from tokens declared once in
  `_vars.scss`. The color is taken from the mockup exactly, not a "similar" token.
- One styling approach. Inline `style` for color, spacing and typography is forbidden.
- Icons come from one source (SVG sprite), color via `currentColor`, no hard-coded `fill`, no inline
  `<svg>` in block markup.
- `components/` is shared UI without a domain (card, modal, field). `sections/` are page blocks.
  If the name contains an entity (News, Vacancy), it is not a shared component.
- Breakpoints come from one set in `_mixins.scss`. Check at the minimum width (320px).
- Do not change reset/base/layout without checking visual consequences.
- Do not add global styles that can affect the whole project.
- Add new styles next to the corresponding component or section.
- Library styles go to `@layer vendor`.
- `overflow-x: clip`, never `hidden`, on page-level containers (sticky header).
- Never `outline: none` without a replacement. Recolor the ring via `--focus-ring-color`.
- Form fields are never below 16px (iOS zoom). Do not forbid zoom in the viewport.
- HTML from the Bitrix visual editor goes inside `.content`; do not require wrappers from the admin.

## Blocks and Bitrix

- Every block survives 0, 1 and N items. A block hidden by the admin leaves no gap.
- Every block gets a story in the component showcase (`app/pages/dev/canvas.html`, viewed at
  `/dev/ui.html`) in all states: normal, loading, empty, error, long content. Check it at 360px.
  A state that cannot happen is marked explicitly with `note`.
- `#bx-panel` and edit-mode buttons must not break the fixed header and menu.
- Lists (news, gallery, documents, directory) load in portions.
- Images: resize on the backend, `srcset` for 2x, fixed aspect ratio.
- Hover submenus open by tap on touch devices and from the keyboard.
- The UI element that looks like a button either does something or does not look clickable.

## Forms

- Validate on submit for short forms, on blur for long ones. No errors on every keystroke.
- While sending: button disabled, `aria-busy` on the form, spinner with the button label unchanged.
- Server field errors go to their fields, the rest to the form level. No silently swallowed errors.
- Error is not only color: color, icon, text; `aria-invalid`, `aria-describedby`, announced via
  `aria-live`. Success is announced too.
- A filled form in a modal asks for confirmation on close.

## Accessibility and security

- Everything interactive is reachable from the keyboard. Icon buttons have `aria-label`.
- WCAG AA contrast.
- Every `button` has `type`.
- Images have `alt`, `width`/`height` (or `aspect-ratio`), `loading="lazy"` below the first screen.
- `target="_blank"` always with `rel="noopener noreferrer"`.

## Assets

- Do not delete images, icons or fonts without checking references.
- SVG sprite sources must use a regular `<svg>...</svg>` structure.
- Icons that should inherit color must be prepared for `currentColor`.
- Raw assets can be duplicated in `dist` for CMS/raw links; this is expected.
- Optimize images separately, not during the Vite build.

## Required checks

After code or build changes, run:

```sh
npm run build
BASE=/demo/ npm run build
BASE=/bitrix/templates/<template>/ npm run build -- --mode cms
npm audit --omit=dev
npm audit
npm ls
git diff --check
```

If only `README.md` or `AGENTS.md` changed, the full build matrix can be skipped, but the final answer
must explicitly say that runtime code did not change. Check in Safari: many bugs reproduce only in
WebKit.

## Git hygiene

- Check `git status`, `git diff --stat` and `git diff --check` before committing.
- Do not commit `dist`, `node_modules`, logs, caches or sandbox artifacts.
- Inspect `git diff --cached --stat` before every commit.
- Keep build, lifecycle and documentation commits separate when practical.

## Final report format

Always report:

- what changed;
- which files changed;
- which commands ran, with their output (not just "checked");
- whether runtime code changed;
- what still needs manual browser verification.
