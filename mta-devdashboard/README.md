# MTA DevDashboard

A complete, production-quality **static developer dashboard** built with **HTML5, CSS3 and Vanilla JavaScript**. No frameworks, no backend, no external database — every byte of your data lives in your browser's `localStorage`.

Developed by **MTA Company**.

---

## Quick start

1. Open `index.html` in any modern browser (Chrome, Edge, Firefox, Safari).
2. Sign in with the initial Super Admin:

   ```
   Username: admin
   Password: admin123
   ```

> **Security note:** this is a *client-side* authentication built on browser storage.
> It is **not** server-grade security. It exists so the dashboard can be used
> privately on a single machine. Never store real secrets here.

## Sections

### Main
- **Dashboard** — command center with statistics, charts and widgets built from real local data.
- **Projects** — full CRUD project manager (grid/list, filters, favorites, details drawer).
- **DevNote** — rich-text developer notes with autosave, categories, tags, pin/favorite, duplicate.
- **Tasks** — task manager with List and Kanban views, priorities, deadlines, project relations.
- **Activity** — real usage analytics (no fabricated data). Daily/weekly/monthly/custom ranges.
- **Calendar** — month / week / day views, events, task deadline overlays.

### System
- **Admins** — create/edit/deactivate/delete admins, assign per-section permissions.
- **Settings** — profile, appearance, per-module preferences, shortcuts, storage, security, advanced.

## Architecture

```
mta-devdashboard/
├── index.html
├── qa/
│   └── smoke.js              # Node-based logic smoke test
├── css/
│   ├── variables.css         # design tokens
│   ├── themes.css            # Ivory Light / Charcoal Dark
│   ├── main.css              # shell, layout, auth screen
│   ├── components.css        # buttons, forms, cards, modals, tables, calendar…
│   ├── animations.css        # animation keyframes + reduced-motion
│   └── responsive.css        # tablet / mobile / touch
└── js/
    ├── utils.js              # DOM/string/date/number helpers
    ├── storage.js            # centralized localStorage layer + seed + import/export
    ├── state.js              # reactive settings/theme/user + event bus
    ├── permissions.js        # page registry + access rules
    ├── auth.js               # client-side auth, sessions, password hashing
    ├── router.js             # hash router with permission guards
    ├── app.js                # boot, shell, header, sidebar, search, shortcuts
    ├── components/
    │   ├── toasts.js
    │   ├── modals.js         # modals, drawers, confirm, prompt
    │   ├── charts.js         # hand-rolled canvas line/bar/doughnut charts
    │   └── editor.js         # rich-text editor (execCommand based)
    └── modules/
        ├── dashboard.js
        ├── projects.js
        ├── devnote.js
        ├── tasks.js
        ├── activity.js
        ├── calendar.js
        ├── admins.js
        └── settings.js
```

## localStorage keys

| Key            | Contents                          |
|----------------|-----------------------------------|
| `mta_users`    | Admin records (hashed passwords)  |
| `mta_session`  | Session token (local/sessionStorage) |
| `mta_projects` | Projects                          |
| `mta_notes`    | DevNotes (rich HTML content)      |
| `mta_tasks`    | Tasks                             |
| `mta_events`   | Calendar events                   |
| `mta_activity` | Activity log (capped at 2500)     |
| `mta_settings` | All preferences + shortcuts       |
| `mta_theme`    | Active theme                      |
| `mta_meta`     | Storage version / migration       |

The storage layer validates, recovers from corrupted JSON, migrates on version changes, and exposes full **export / import** (`Settings → Storage`). Exports include admins, projects, notes, tasks, events, activity, settings and theme.

## Features checklist

- Authenticated shell with login / logout / session resume / lock screen / last-login tracking
- Role-based access (`Super Admin` vs `Admin`) with per-section permissions
- Dashboard auto-updates on every data change
- Real charts (line, bar, doughnut) using only local data
- Global search palette (`Ctrl+K`) + command palette (`Ctrl+Shift+P`)
- Customizable keyboard shortcuts with conflict detection
- Toast notifications and a polished empty state for every section
- Ivory Light + Charcoal Dark glass UI, respecting `prefers-reduced-motion`
- Fully responsive (1920×1080 → mobile with bottom navigation)
- Accessibility: semantic HTML, ARIA labels, keyboard navigation, visible focus states

## QA

A Node smoke test exercises storage, auth, permissions, CRUD, analytics, settings and import/export with a minimal DOM shim:

```bash
node qa/smoke.js
```

## License

Internal tool — developed by MTA Company.