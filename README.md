# SillyTavern Mode Toggles (st-mode-toggles)

A featherweight extension that gives you a microchip button with a stack of deliciously chaotic “modes” (Noir Echo, Silent Scream, Innuendo Engine, etc.). Flip them on; the extension prepends succinct meta-lines to your next user message so your model steers into the vibe you chose. It’s fast, UI-friendly, and gloriously extra.

<img width="1713" height="745" alt="image" src="https://github.com/user-attachments/assets/004885a7-5706-4c45-aa0a-a2b210b0c431" />

## Features

- One-click vibe flips
  - A floating `fa-microchip` menu button is added to the SillyTavern top bar.
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

- Click-outside-to-close behavior
  - The menu dismisses cleanly when you click elsewhere.

## Included modes (handpicked chaos)

- `Noir Echo ON`: Rain-slick metal and neon betrayal.
- `Silent Scream`: Slow-burn psychological dread.
- `Dialogue Cheese`: Purposefully terrible one-liners.
- `Terminal Logic`: Unseen AI announces mortality odds.
- `Veil of Shadows`: Whispers, relics, half-seen figures.
- `Rashomon Effect`: Conflicting perspectives per scene.
- `Gravitas Lock`: Zero quips. All weight.
- `Echoed Futures`: Brief premonitions overlay action.
- `Glitch-Veil`: Rendering errors bleed into reality.
- `Bureaucracy Ascendant`: Stamps, queues, bribes, progress.
- `Murmur Net`: Rumors rewrite the world.
- `The Sun Is Sick`: Day length wobbles scramble minds/tech.
- `Dreamwalk Threshold`: Shared dream commons with bleed-through.
- `Blood Debt Ledger`: Harm accrues cosmic interest.
- `Knife of Ockham`: Simplicity rewarded, overcomplication punished.
- `Velvet Hour`: Candlelit lounges and social buffs.
- `Innuendo Engine`: Suggestive dialogue unlocks paths.
- `Censor Pixies`: Mosaic sprites as slapstick hazards.
- `Blush Meter`: Visible blush as social crit/awk gauge.
- `Gag Reel Spillover`: Outtakes become exploitable “props.”
- `Developer Commentary`: Floating notes with togglable modifiers.
- `Subtitle Saboteur`: Captions that lie and react.
- `Save-Scum Echo`: World remembers reloads.
- `UI Made Flesh`: Health bars and markers become objects.
- `Narrator Hot Mic`: Banter the narrator for buffs/debuffs.
- `Red Curtain Interlude`: Intermission acts for tailored buffs.
- `Chekhov’s Arsenal`: Spotlighted items will matter later.
- `Bardic Reality`: Music selection changes mechanics.
- `Mirror Law`: Reflective portals with delayed doubles.
- `Palimpsest Layers`: Past maps bleed through; stitch and peel.
- `Trial by Gossip`: Crowd-sourced tribunals after major beats.
- `Mask Census`: Masks define roles and access.
- `Stormglass Morality`: Weather mirrors your choices.
- `Echo of Names`: Naming alters entities and places.
- `Split-Screen Fate`: Two timelines you can cross-influence.

## How it works

- UI:
  - A `div#modtog_menu_button.gg-menu-button.fa-solid.fa-microchip` is injected into `#gg-menu-buttons-container`.
  - Clicking it opens a `div#modtog_tools_menu.gg-tools-menu` listing all modes.
  - Each mode click cycles: `OFF` → `Activating` → `OFF` … and `ON` → `Deactivating` → `ON` …

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
