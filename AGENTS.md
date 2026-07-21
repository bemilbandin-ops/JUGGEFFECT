# AGENTS.md

## Project
JUGGEFFECT is a high-performance web application for real-time video manipulation, juggling prop tracking, object removal (clone stamp), Persistence of Vision (POV) pixel pattern synthesis, and LED motion echo trails.

### Project Structure
- `src/components/`: Viewport HUDs, interactive canvas overlays, and settings drawer tab panels.
- `src/engine/`: Dedicated 60fps Computer Vision processors, render loop step engines, strobe evaluators, motion blur processors, and clone stamp compositors.
- `src/hooks/`: Custom React hooks managing animation frame lifecycles, media recorder streams, camera stream controllers, and canvas pointer listeners.
- `src/config/`: Frozen default slider configurations (`settingsDefaults.ts`), preset definitions, and tuner UI options.
- `src/utils/`: POV math utilities, track matching algorithms, and pattern generators.

## Working on the code
- **Install Dependencies:** `npm install`
- **Run Local Dev Server:** `npm run dev`
- **TypeScript Type Check:** `rtk npx tsc --noEmit` (or `npm run lint`)
- **Run Test Suite:** `rtk npm run test`
- **Production Build:** `rtk npm run build`

## Conventions
- **Freeze Default Settings & Presets:**
  - The default slider settings and preset values defined in [settingsDefaults.ts](file:///d:/Codexcode/JUGGEFFECT/JUGGEFFECT/src/config/settingsDefaults.ts) are strictly frozen.
  - **Do NOT** change, add, or remove any key or default value in `src/config/settingsDefaults.ts` or its corresponding snapshots in [settingsDefaults.test.ts](file:///d:/Codexcode/JUGGEFFECT/JUGGEFFECT/src/config/settingsDefaults.test.ts) unless explicitly commanded by the user.
- **Render Loop & Engine Architecture:**
  - Keep 60fps Computer Vision pipeline processing inside modular engine functions under `src/engine/`.
  - Avoid inline render loops or complex state structures inside React components.
  - Use React refs (`useRef`) rather than state (`useState`) for high-frequency 60fps tracking variables to prevent component re-renders.

## Finishing a task
Before declaring any task complete, execute the following verification steps:
1. **TypeScript Check:**
   ```bash
   rtk npx tsc --noEmit
   ```
2. **Production Build:**
   ```bash
   rtk npm run build
   ```
3. **Mandatory Test Validation:**
   ```bash
   rtk npm run test
   ```
   - Verify that all unit tests and the default settings lock test pass cleanly without errors.
   - If the settings lock test fails, identify the mutated setting, revert it back to its original default, and run tests again until they pass.
