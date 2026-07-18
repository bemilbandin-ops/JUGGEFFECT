# Settings Effect Rack Design

## Goal

Make every existing effect and setting easier to find, understand, and combine. This redesign changes the control panel, not the range or behavior of the effects.

## Current problems

- The five tabs mix different concepts: presets, rendering effects, tracking, camera correction, and painting tools.
- Related controls appear in different places. For example, tracking controls live under Trails and Pixel Effect, while the look finder changes values from several sections.
- Several labels expose implementation details or reverse the underlying value, such as trail retention versus echo fade rate.
- Dependencies are hidden. A control can appear usable even when another setting prevents it from affecting the image.
- Presets, the mobile tuner, manual controls, and the look finder provide overlapping ways to change the same settings.
- The look finder produces unexplained random changes. Its Save Effect action only clears its local undo history and does not create a saved effect.

## Recommended interaction model

Replace the tab bar with one scrollable effect rack. The rack follows the image-processing flow:

1. **Input & Tracking** — sensitivity, bright-object filtering, background adaptation, and debug view.
2. **Trails** — trail length, edge smoothing, glow, blur, hue, blend mode, drift, feedback zoom, strobe, and motion blur.
3. **Pixel / POV** — pattern source, mapping, rendering, sweep, glow, dimensions, timing, and center position.
4. **Paint / Clone** — brush size, feathering, and clone offset.
5. **Camera Color** — exposure, contrast, saturation, temperature, tint, and inversion.
6. **Export** — frame rate, quality, and format.

Tracking, Trails, Pixel / POV, and Paint / Clone have independent enable switches where the current engine supports them. Enabling one must not disable another. Processing order remains fixed because the current renderer already has a fixed pipeline; the interface must not imply that users can reorder effects.

## Effect sections

Each section is a collapsible card with three levels of information:

- **Closed:** effect name, enabled state, and a generated plain-language summary such as “long cyan trail, medium glow.”
- **Open:** the small set of controls most useful during live adjustment.
- **More settings:** every remaining specialist control, with no features removed.

Open sections retain their state between sessions. Enabled sections appear before disabled sections within their fixed pipeline order. The rack does not automatically move a section while the user is adjusting it.

Each control includes:

- a plain-language name as the primary label;
- the existing technical name in supporting text where useful;
- a short description of the visible result;
- a formatted value in meaningful units;
- a reset action when its value differs from the default;
- a disabled explanation when another setting prevents it from having an effect.

Examples:

- `echoFadeRate` is presented as **Trail length** with a retention percentage.
- `motionThreshold` is presented as **Movement sensitivity** with the direction made consistent: moving right means more sensitive.
- `feedbackZoom` is presented as **Trail zoom** with 100% described as off.
- Pixel timing values are described as frames because that is how the renderer currently applies them.

## Global controls

The rack header contains only four global actions:

- **Presets:** opens the existing visual presets as multi-effect recipes.
- **Search:** filters sections and controls using both visible and technical names.
- **Undo:** restores the complete settings state before the last user action.
- **Changes:** lists every value that differs from the defaults and can reset one value, one section, or everything.

Search does not create a second settings interface. It expands and highlights the matching control in its normal section.

## Presets and experimentation

Presets remain partial settings recipes so they can activate and configure several combinable effects at once. Applying a preset must show which sections and values it changed. Any manual change after applying a preset marks the result as **Modified** instead of continuing to claim that the unchanged preset is active.

Remove the current Find a Look panel. Randomizing many unexplained settings adds another mental model without helping locate or understand controls.

If experimentation is added later, use a smaller **Try variation** action inside an individual effect section. It may change only that section, must list the changed values, and must support immediate undo. Do not implement this until the rack itself proves insufficient.

## State and data flow

Keep `TrackingSettings` as the single source of truth and retain the existing local-storage persistence. Add a small metadata description for each setting containing its section, label, description, display conversion, dependency, and default value. Both desktop cards and the mobile quick controls read from this same metadata so labels and ranges cannot drift apart.

The effect renderer continues reading the same settings fields. The redesign must not change rendering behavior or preset values.

Every settings action follows the same flow:

1. Capture the current complete settings object for undo.
2. Apply the changed field or preset fields.
3. Persist the new settings through the existing local-storage path.
4. Recompute section summaries, changed indicators, and dependency states.

Undo history is limited to the current browser session. Saved settings continue to survive a reload.

## Dependencies and error handling

- Dependent controls remain visible but disabled, accompanied by the action needed to enable them.
- Invalid saved values fall back to the corresponding default during loading rather than breaking the panel.
- A malformed saved settings object must not erase the last readable settings before defaults are available.
- Uploaded Pixel / POV images retain the current validation and error behavior.
- Resetting all settings requires confirmation; resetting one control or section does not.

## Responsive behavior

Desktop uses the full rack in the existing right sidebar. Mobile uses the same section structure in a full-height sheet. The current six-control floating tuner is removed once the rack provides equally fast access, avoiding two interfaces for the same values.

Frequently adjusted controls may be pinned to a small **Pinned** section. Pinning is local UI preference only and does not duplicate settings state.

## Accessibility

- Every enable switch and disclosure has an explicit accessible label and state.
- Disabled controls expose their dependency explanation to assistive technology.
- All controls work with a keyboard and show focus visibly.
- Color is never the only indication of enabled, changed, or disabled state.

## Validation

The implementation is complete when these checks pass:

- Existing default and preset snapshot tests remain unchanged.
- Every `TrackingSettings` field appears exactly once in the rack metadata or is explicitly identified as internal-only.
- Enabling Trails, Pixel / POV, and Paint / Clone together preserves all three enabled states.
- Search for a visible label and a technical field name opens the same control.
- Applying a preset, changing one value, and undoing restores the exact prior settings object.
- Reloading restores settings and section preferences without changing effect output.
- Keyboard-only use can open every section and adjust every control.
- A before-and-after recording made with identical settings produces the same rendered effect.

## Scope boundaries

This redesign does not add new effects, change effect mathematics, allow effect reordering, add accounts or cloud synchronization, or introduce a new component library. Those changes are unnecessary for making the current settings understandable.
