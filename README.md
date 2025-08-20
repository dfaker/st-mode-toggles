# SillyTavern Mode Toggles (st-mode-toggles)

An extension that gives you a microchip button with a stack of deliciously chaotic “modes” (Noir Echo, Silent Scream, Innuendo Engine, etc.). Flip them on; the extension prepends succinct meta-lines to your next user message so your model steers into the vibe you chose. It’s fast, UI-friendly, and gloriously extra.

<img width="1730" height="640" alt="image" src="https://github.com/user-attachments/assets/e2bbaf45-ce17-4ec3-bade-a8365098f6fb" />

## Features

- One-click vibe flips
  - A `microchip` menu button is added bext to the Guided Generations button (Alterantively in the extensions menu).
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
  - Tooltips show how many modes are currently `ON`.

- Adding new modes, and Import and Export of your customizations is avaliable at the very bottom of the menu:

<img width="485" height="546" alt="image" src="https://github.com/user-attachments/assets/bdad9f81-b4e4-441d-b08a-b5c2357f570d" />


## Installation

Use the repo url on the Extensions -> Install extension popup.

`https://github.com/dfaker/st-mode-toggles`


## Usage

- Click the microchip button to open the mode menu at your cursor.
- Click any mode to toggle it; colors reflect state.
- Send your next message; bracketed mode lines will be prepended to your user message.
- The tooltip on the microchip shows how many modes are currently `ON`.
- Click outside the menu to close it.

## Known quirks and limitations

- Injection scope:
  - Only the last user message (`chat[chat.length - 1]`) gets the prefix.
- Title count:
  - The microchip’s tooltip counts only `ON` modes (not transitional ones).

