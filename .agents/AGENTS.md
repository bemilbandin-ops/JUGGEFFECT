# JUGGEFFECT AI Agent Rules

You MUST follow these rules at all times:

## 1. Freeze Default Settings & Presets
- The default slider settings and preset values defined in [settingsDefaults.ts](file:///d:/Codexcode/JUGGEFFECT/JUGGEFFECT/src/config/settingsDefaults.ts) are strictly frozen.
- **Do NOT** change, add, or remove any key or default value in `src/config/settingsDefaults.ts` or its corresponding snapshots in [settingsDefaults.test.ts](file:///d:/Codexcode/JUGGEFFECT/JUGGEFFECT/src/config/settingsDefaults.test.ts) unless the user explicitly commands you to edit a default setting or preset.

## 2. Mandatory Test Validation
- After any code modification, you **MUST** run the test suite to ensure no silent edits or regressions occurred:
  ```bash
  rtk npm run test
  ```
- If the settings lock test fails, identify the mutated setting, revert it back to its original default, and run tests again until they pass.
