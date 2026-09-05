# MTA DevDashboard

<p align="center">
  <strong>A modern, production-quality static developer dashboard</strong>
</p>

<p align="center">
  Built with <strong>HTML5</strong>, <strong>CSS3</strong> and <strong>Vanilla JavaScript</strong> — no frameworks, no backend, no external database.
</p>

---

## 📌 Overview

**MTA DevDashboard** is a complete browser-based developer dashboard designed to organize projects, tasks, developer notes, activities and calendar events in one place.

The entire application runs on the client side.

There is:

* ❌ No backend
* ❌ No external database
* ❌ No framework
* ❌ No server required

All application data is stored locally in the browser using **`localStorage`**.

> Developed by **MTA Company**.

---

## 🌐 Live Dashboard

### 🚀 Public Dashboard

**https://mta-company-dev.github.io/mta-devdashboard/**

You can open the dashboard directly in any modern browser.

### 🔐 Initial Login

```text
Username: admin
Password: admin123
```

> **Security Notice**
>
> Authentication is completely client-side and relies on browser storage.
> It is designed for private/local use and is **not a replacement for server-side authentication**.
>
> Never use real production passwords, API keys, tokens or sensitive credentials in this application.

---

# ✨ Features

## 🔐 Authentication & Security

* Login / Logout
* Session resume
* Lock screen
* Last-login tracking
* Password hashing
* Super Admin and Admin roles
* Per-section permissions
* Protected routes
* Client-side authentication system

---

## 📊 Dashboard

A centralized command center containing real data from the application.

Features include:

* Project statistics
* Task statistics
* Activity statistics
* Notes overview
* Calendar information
* Dynamic widgets
* Real-time dashboard updates
* Canvas-based charts

All statistics are generated from actual local application data.

---

## 📁 Projects

A complete project management system.

* Create projects
* Edit projects
* Delete projects
* Project details
* Favorite projects
* Grid / List views
* Filtering
* Project categories
* Project metadata
* Details drawer

---

## 📝 DevNote

A rich developer note system designed for technical documentation and personal development notes.

* Rich-text editor
* Categories
* Tags
* Pin notes
* Favorite notes
* Duplicate notes
* Autosave
* Rich HTML content
* Search and organization

---

## ✅ Tasks

Task management with multiple ways to organize work.

* Create / edit / delete tasks
* List view
* Kanban view
* Priorities
* Deadlines
* Project relationships
* Task status
* Calendar integration
* Deadline overlays

---

## 📈 Activity

Local usage analytics based on actual application activity.

Supports:

* Daily analytics
* Weekly analytics
* Monthly analytics
* Custom date ranges
* Activity history
* Local activity tracking

> No fake or generated analytics are used.

---

## 📅 Calendar

A complete calendar module with multiple views.

* Month view
* Week view
* Day view
* Calendar events
* Task deadlines
* Event management
* Event colors
* Date navigation
* Task overlays

---

## 👥 Admin Management

Manage dashboard administrators and their permissions.

* Create admins
* Edit admins
* Deactivate admins
* Delete admins
* Role management
* Per-section permissions
* Super Admin privileges

---

## ⚙️ Settings

A centralized settings system.

Includes:

* Profile settings
* Appearance
* Theme preferences
* Module preferences
* Keyboard shortcuts
* Storage management
* Security settings
* Advanced settings
* Import / Export

---

# 🎨 UI & Design

MTA DevDashboard uses a modern glass-style interface designed for both desktop and mobile.

### Themes

* 🕊️ Ivory Light
* 🌑 Charcoal Dark

The interface also supports:

* Responsive layouts
* Mobile bottom navigation
* Keyboard navigation
* Visible focus states
* ARIA labels
* Semantic HTML
* Reduced-motion preferences
* Touch-friendly controls

---

# ⌨️ Keyboard Shortcuts

The dashboard includes a customizable keyboard shortcut system.

### Default shortcuts

| Shortcut           | Action          |
| ------------------ | --------------- |
| `Ctrl + K`         | Global Search   |
| `Ctrl + Shift + P` | Command Palette |

Shortcuts can be customized from:

**Settings → Shortcuts**

The system also detects shortcut conflicts.

---

# 💾 Data & Storage

MTA DevDashboard uses browser storage instead of a remote database.

### Storage Keys

| Key            | Description                          |
| -------------- | ------------------------------------ |
| `mta_users`    | Administrator records                |
| `mta_session`  | Authentication session               |
| `mta_projects` | Projects                             |
| `mta_notes`    | Developer notes                      |
| `mta_tasks`    | Tasks                                |
| `mta_events`   | Calendar events                      |
| `mta_activity` | Activity log                         |
| `mta_settings` | Application settings                 |
| `mta_theme`    | Active theme                         |
| `mta_meta`     | Storage version & migration metadata |

The storage layer provides:

* JSON validation
* Corrupted-data recovery
* Storage migrations
* Version management
* Import / Export
* Activity log limits

The activity history is capped at **2500 records**.

---

# 📦 Import & Export

The complete application state can be exported from:

**Settings → Storage**

Exports can contain:

* Administrators
* Projects
* DevNotes
* Tasks
* Calendar events
* Activity history
* Settings
* Theme configuration

This makes it possible to back up or move dashboard data between browsers.

---

# 🏗️ Project Architecture

```text
mta-devdashboard/
│
├── index.html
├── README.md
│
├── qa/
│   └── smoke.js
│
├── css/
│   ├── variables.css
│   ├── themes.css
│   ├── main.css
│   ├── components.css
│   ├── animations.css
│   └── responsive.css
│
└── js/
    ├── utils.js
    ├── storage.js
    ├── state.js
    ├── permissions.js
    ├── auth.js
    ├── router.js
    ├── app.js
    │
    ├── components/
    │   ├── toasts.js
    │   ├── modals.js
    │   ├── charts.js
    │   └── editor.js
    │
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

---

# 🛠️ Technology Stack

| Technology         | Usage                          |
| ------------------ | ------------------------------ |
| HTML5              | Application structure          |
| CSS3               | UI, themes & responsive design |
| Vanilla JavaScript | Application logic              |
| Canvas API         | Charts                         |
| Web Storage API    | Local data persistence         |
| `execCommand`      | Rich-text editor               |
| GitHub Pages       | Public deployment              |

No external JavaScript framework is required.

---

# 🚀 Quick Start

## 1. Clone the repository

```bash
git clone https://github.com/mta-company-dev/mta-devdashboard.git
```

## 2. Enter the project

```bash
cd mta-devdashboard
```

## 3. Open the application

Simply open:

```text
index.html
```

in a modern browser.

Alternatively, run the project using a local development server.

For example, with VS Code Live Server or any static HTTP server.

---

# 🧪 Quality Assurance

The project includes a Node.js-based smoke test covering the main application logic.

Run:

```bash
node qa/smoke.js
```

The test covers areas such as:

* Storage
* Authentication
* Permissions
* CRUD operations
* Analytics
* Settings
* Import / Export

The smoke test uses a minimal DOM shim so the core logic can be tested without a browser.

---

# 📱 Responsive Design

The dashboard is designed to work across a wide range of screen sizes.

Supported layouts include:

* 🖥️ Large desktop
* 💻 Desktop
* 📱 Tablet
* 📱 Mobile
* 🔄 Landscape mobile

The interface automatically adapts navigation, grids, cards, tables, forms, modals and calendar views to smaller screens.

---

# 🔒 Security Considerations

This project is intentionally **client-side**.

Because all authentication and data storage happen inside the browser:

* Users can inspect localStorage.
* Stored application data is not protected like server-side database data.
* Client-side permissions cannot provide true server security.
* Password hashing does not make the application suitable for sensitive credentials.
* Anyone with sufficient access to the browser environment may potentially inspect or modify stored data.

Therefore, this project should be considered a **local/private developer dashboard**, not a production authentication system.

For a real multi-user production environment, authentication, authorization and data storage should be moved to a secure backend.

---

# 🎯 Project Goals

MTA DevDashboard was built with several goals:

1. Create a useful developer workspace without requiring a backend.
2. Demonstrate advanced Vanilla JavaScript architecture.
3. Keep the application lightweight and portable.
4. Store all data locally.
5. Provide a polished modern UI.
6. Support desktop and mobile devices.
7. Demonstrate modular JavaScript development.
8. Provide a realistic CRUD application using only browser technologies.

---

# 🗺️ Roadmap

Possible future improvements include:

* [ ] PWA / Offline installation
* [ ] Advanced project statistics
* [ ] More calendar features
* [ ] Improved rich-text editor
* [ ] More dashboard widgets
* [ ] Additional themes
* [ ] Enhanced accessibility
* [ ] Advanced data backup options
* [ ] Optional backend version
* [ ] Multi-device synchronization

---

# 📄 License

**Internal Tool — Developed by MTA Company**

This project is intended for internal use and demonstration purposes.

---

<p align="center">
  <strong>MTA Company</strong>
  <br>
  Developer Tools • Web Development • Software
</p>

<p align="center">
  <a href="https://mta-company-dev.github.io/mta-devdashboard/">
    🚀 Open MTA DevDashboard
  </a>
</p>
