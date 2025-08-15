# Gemini Project Guidelines

This document outlines the development principles for our collaboration on this project.

## Core Principles

*   **Preserve Baseline:** The existing map rendering and camera functionality are our stable baseline. All changes must ensure these continue to work as expected.
*   **Modular Features:** New functionality should be built as self-contained modules or overlays (e.g., a route-finding layer). Changes should be additive and easily toggled or removed.
*   **Protected Core:** Direct modifications to the core application logic are avoided. If a core change is necessary, I will propose it and wait for your explicit approval: `CORE CHANGE OK`.
*   **Lightweight Scaffolding:** We will only add minimal, necessary code for new features, like a simple module loader. We'll favor lazy-loading where practical.
*   **Immutable Data:** Modules should treat core map data as read-only. They can read this data to render new information on top of the map, but must not alter the original data structures.

## How to Add a Module (Recipe)

This is a basic pattern for adding new, isolated features.

1.  **Create a Module File:** Add a new file in `eve-frontier-map/src/modules/`. For example, `MyNewModule.ts`.
2.  **Define the Module:** The module should export a simple object or class that conforms to a basic module interface (e.g., `{ id: 'my-new-module', name: 'My New Module', init: () => { ... }, cleanup: () => { ... } }`).
3.  **Register the Module:** In a central registry (e.g., `eve-frontier-map/src/modules/index.ts`), import and add your new module to a list of available modules.
4.  **Load the Module:** The main application will load registered modules, allowing them to draw on the map or add UI elements.

---
*This document is a living agreement and can be updated as we refine our workflow.*
