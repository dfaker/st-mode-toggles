# SillyTavern Mode Toggles (st-mode-toggles)

A featherweight extension that gives you a microchip button with a stack of deliciously chaotic “modes” (Noir Echo, Silent Scream, Innuendo Engine, etc.). Flip them on; the extension prepends succinct meta-lines to your next user message so your model steers into the vibe you chose. It’s fast, UI-friendly, and gloriously extra.

<img width="1713" height="745" alt="image" src="https://github.com/user-attachments/assets/004885a7-5706-4c45-aa0a-a2b210b0c431" />

## Features

- One-click vibe flips
  - A `microchip` menu button is added bext to the Guided Generations button.
  - Click to open a compact `gg-tools-menu` with all modes.

- Clear, color-coded states
  - `ON` (green), `OFF` (red), `Activating` (yellow), `Deactivating` (orange).
  - Transitional states auto-resolve on the next send:
    - `Activating` → `ON`
    - `Deactivating` → `OFF`

- Smart ordering and quick positioning
  - Active and transitioning modes bubble to the top of the list.
  - The menu opens anchored to your click, using bottom-left alignment.

- Prompt prefix injection
  - When you send a message, the extension prepends the selected modes to the last user message as short, bracketed lines:
    ```
    [Noir Echo ON] - Shadowy, cyberpunk-inspired despair. Everything is rain-slick metal and neon betrayal.
    [Innuendo Engine ON] - Dialogue tilts suggestive. Double entendres unlock alternate quest solutions and secret vendors who only respond to clever wordplay.

    <your original message here>
    ```
  - Tooltips show how many modes are currently `ON`.

- Adding new modes, and Import and Export of your customizations is avaliable at the very bottom of the menu:

<img width="509" height="519" alt="image" src="https://github.com/user-attachments/assets/02c0d416-0e9c-44e2-a7dc-c2c0fb759a54" />

## How it works

- Prompt interception:
  - `globalThis.modTogPromptInterceptor(chat, contextSize, abort, type)` finds all `ON`, `Activating`, and `Deactivating` modes.
  - It converts transitional states to their target display (`Activating` shown as `ON`, `Deactivating` as `OFF`) and prepends lines to the last user message.
  - After prepending, it finalizes transitions (`Activating` → `ON`, `Deactivating` → `OFF`) and refreshes the UI.

## Installation

Use the repo url on the Extensions -> Install extension popup.

`https://github.com/dfaker/st-mode-toggles`

Notes:
- The code waits for `#gg-menu-buttons-container` to exist and then injects the button via a `MutationObserver`.
- Styles piggyback on SillyTavern’s `gg-tools-menu` classes.

## Usage

- Click the microchip button to open the mode menu at your cursor.
- Click any mode to toggle it; colors reflect state.
- Send your next message; bracketed mode lines will be prepended to your user message.
- The tooltip on the microchip shows how many modes are currently `ON`.
- Click outside the menu to close it.

## Known quirks and limitations

- No persistence yet:
  - Mode states are not saved between reloads.
- Injection scope:
  - Only the last user message (`chat[chat.length - 1]`) gets the prefix.
- Sorting:
  - Active/transitioning modes float to the top; original order is preserved within groups.
- Title count:
  - The microchip’s tooltip counts only `ON` modes (not transitional ones).

## Dev notes

- UI helper functions:
  - `addMenuButton()`, `createModTogToolsMenu()`, `updateModTogToolsMenu()`, `repositionMenu()`, `updateMenuTitle()`.
- Prompt hook:
  - `globalThis.modTogPromptInterceptor` is the only mutator and commits transitional state changes post-injection.
- Imported-but-unused right now:
  - `Generate`, `extension_prompt_types`, `sendMessageAsUser`, `setExtensionPrompt`, `saveSettingsDebounced`, `Popup`—plumb them in if you want deeper integration later (persistence, custom prompt types, etc.).

## License

MIT — do fun things.
