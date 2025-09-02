

import {
  saveSettingsDebounced,
} from "../../../../script.js";
import { renderExtensionTemplateAsync, extension_settings } from "../../../extensions.js";
import { Popup, POPUP_RESULT, POPUP_TYPE} from "../../../popup.js";


function deepFreeze(o) {
  Object.freeze(o);
  if (Array.isArray(o)) o.forEach(x => typeof x === 'object' && x !== null && deepFreeze(x));
  else if (typeof o === 'object' && o !== null) Object.values(o).forEach(x => typeof x === 'object' && x !== null && deepFreeze(x));
  return o;
}


// ===== Constants =====
const EXTENSION_NAME = 'st-mode-toggles';
const DEFAULT_PRE_FRAMING = 'Current Active or now Disabled non-diegetic modifier modes:\n(ON = world rule applies. OFF = no effect; earlier mentions are non-canon.)\n\n';
const DEFAULT_MERGE_FORMAT = '[{{modeName}} {{displayStatus}}] - (Effect when ON "{{modeDescription}}", should be removed when OFF)';
const DEFAULT_POST_FRAMING = 'No reference should be made to the presence of these modifier modes inside the chat, only their effects.';
const DEFAULT_OFF_COUNTDOWN = 5; // per-message countdown once a mode is turned OFF

const schedule_html_template = `
<div id="modtog_schedule_interface">
  <div class="justifyspacebetween alignitemscenter">
      <h3>Mode Scheduling</h3>
  </div>
  <div class="justifyLeft">
    <small id="mask-help">
      Each character in the mask corresponds to one message in the cycle.  
      <div>• <strong>X</strong> = 100% (always active)</div>  
      <div>• <strong>-</strong> or <strong>0</strong> = 0% (never active)</div>  
      <div>• <strong>1–9</strong> = probability ×10% (e.g. <code>5</code> = 50%, <code>7</code> = 70%)</div>  
      <div>The mask repeats in a loop; its length sets the cycle.</div>
      <div>– <code>X--</code> = every 3rd message, always.</div>
      <div>– <code>5-5-</code> = every other message has a 50% chance.</div>  
      <div>– <code>1XXX</code> = 10% chance on first message, then 3 guaranteed active.</div>  
    </small>
  </div>

  <div>
      <table id="schedule_config_table" class="responsiveTable" style="word-break: break-all";>
          <thead>
              <tr>
                  <th>Mode</th>
                  <th>Schedule</th>
              </tr>
          </thead>
          <tbody id="mod_tod_sched_table">
          </tbody>
      </table>
  </div>
</div>
`

let DEFAULT_MODES_RAW = [];
let DEFAULT_MODES = [];

let modTogToolsMenu;
let lastClickPosition = { x: 0, y: 0 };
let extensionEnabled = true;
let accordionOpenState = {};

let modTogToolsMenuContent;
let modTogSearchInput;
let currentSearchQuery = '';

let tick = 0;

let modTogResizeObserver;

async function loadDefaultModesFromAssets() {
  const all = [];

  // Fetch files sequentially until the first failure (404 or network error)
  let failures = 0;
  for (let n = 1; ; n++) {
    const url = `/scripts/extensions/third-party/st-mode-toggles/modes/modes_${n}.txt`;
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) {
        if (n === 1) {
          console.info(`No core modes found at ${url} (status ${res.status}). Proceeding with no defaults.`);
        } else {
          console.info(`Stopped loading core modes at ${url} (status ${res.status}).`);
        }
        break;
      }

      const text = await res.text();


      if(text == 'Not Found'){
        break;
      }

      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

      // Parse lines the same way as showImportDialog
      for (const line of lines) {
        const parts = line.split(' - ');
        const name = parts[0]?.trim();

        let group, description;
        if (parts.length >= 3) {
          group = (parts[1] || '').trim() || 'Unsorted';
          description = parts.slice(2).join(' - ').trim();
        } else if (parts.length === 2) {
          group = 'Unsorted';
          description = (parts[1] || '').trim();
        } else {
          console.warn(`Skipping malformed mode line in ${url}: "${line}"`);
          continue;
        }

        if (!name || !description) {
          console.warn(`Skipping mode with missing name/description in ${url}: "${line}"`);
          continue;
        }

        all.push({ name, group, description });
      }
    } catch (err) {
      if (n === 1) {
        console.warn(`Failed to fetch ${url}:`, err);
      }
      if(failures > 5){
        console.warn(`Stopping core mode loading due to fetch error at ${url}:`, err);
        break;
      }
      failures++;
    }
  }

  // Store temporary RAW, then deepFreeze the final DEFAULT_MODES
  DEFAULT_MODES_RAW = all;
  DEFAULT_MODES = deepFreeze(DEFAULT_MODES_RAW.map(x => ({ ...x })));

  console.log(`Loaded ${DEFAULT_MODES.length} core mode(s) from assets.`);
}



function ensureExtSettings() {
  if (!extension_settings[EXTENSION_NAME]) extension_settings[EXTENSION_NAME] = {};
  return extension_settings[EXTENSION_NAME];
}

function getModeOverrides() {
  const ext = ensureExtSettings();
  if (!ext.modeOverrides) ext.modeOverrides = {}; // { [name]: { description } }
  return ext.modeOverrides;
}

function getChatStatesAll() {
  const ext = ensureExtSettings();
  if (!ext.chatStates) ext.chatStates = {}; // { [chatId]: { [modeName]: { status, countdown? } } }
  return ext.chatStates;
}

function getChatState(chatId = getCurrentChatId()) {
  const all = getChatStatesAll();
  if (!all[chatId]) all[chatId] = {};
  return all[chatId];
}

function getCountdown() {
  return ensureExtSettings().countdown ?? DEFAULT_OFF_COUNTDOWN;
}

function getCurrentChatId() {
  try {
    const context = SillyTavern.getContext();
    const chatId = context.chatId || 'default';
    const characterId = context.characterId || 'none';
    return `${characterId}_${chatId}`;
  } catch (error) {
    console.error("Error getting chat ID:", error);
    return 'fallback';
  }
}

function getEffectiveModes() {
  const settings = extension_settings[EXTENSION_NAME] || {};
  const baseMap = new Map();

  if (settings.loadCoreModes ?? true) {
    for (const m of DEFAULT_MODES) {
      baseMap.set(m.name, { name: m.name, description: m.description, group: m.group || 'Unsorted' });
    }
  }

  // Apply overrides and custom additions (include group if provided)
  const overrides = getModeOverrides();
  for (const [name, ov] of Object.entries(overrides)) {
    baseMap.set(name, { name, description: ov.description, group: ov.group || 'Unsorted' });
  }
  return Array.from(baseMap.values());
}


function getEffectiveModesMap() {
  const map = new Map();
  for (const m of getEffectiveModes()) map.set(m.name, m);
  return map;
}

// Merge effective modes with per-chat status/countdown to build view used by UI and prompt
function getModesView(chatId = getCurrentChatId()) {
  const effective = getEffectiveModes();
  const state = getChatState(chatId);
  return effective.map(m => {
    const s = state[m.name];
    return {
      name: m.name,
      description: m.description,
      group: m.group || 'Unsorted',
      status: s?.status ?? 'OFF',
      countdown: (s && s.countdown !== undefined) ? s.countdown : undefined,
    };
  });
}

// ===== Extension Enable/Disable =====
function enableExtension() {
  extensionEnabled = true;

  const menuButton = document.getElementById('modtog_menu_button');
  if (menuButton) menuButton.style.display = 'block';

  const extensionMenuItem = document.querySelector('[data-extension="mode-toggles"]');
  if (extensionMenuItem) extensionMenuItem.style.display = 'flex';

  saveExtensionSettings();

  console.log("Mode toggles extension enabled");
  
}

function disableExtension() {
  extensionEnabled = false;

  const menuButton = document.getElementById('modtog_menu_button');
  if (menuButton) menuButton.style.display = 'none';

  if (modTogToolsMenu) modTogToolsMenu.style.display = 'none';

  const extensionMenuItem = document.querySelector('[data-extension="mode-toggles"]');
  if (extensionMenuItem) extensionMenuItem.style.display = 'none';

  saveExtensionSettings();

  console.log("Mode toggles extension disabled");
  if (window.toastr) toastr.info('Mode Toggles disabled', 'Mode Toggle');
}

// ===== Persist Extension UI Settings =====
function saveExtensionSettings() {
  try {
    const ext = ensureExtSettings();
    ext.enabled = extensionEnabled;
    ext.guidedGenerations = document.getElementById('mode_toggles_guided_generations')?.checked || false;
    ext.preFraming = document.getElementById('mode_toggles_framing')?.value || DEFAULT_PRE_FRAMING;
    ext.mergeFormat = document.getElementById('mode_toggles_merge')?.value || DEFAULT_MERGE_FORMAT;
    ext.postFraming = document.getElementById('mode_toggles_framing_post')?.value || DEFAULT_POST_FRAMING;
    ext.countdown = parseInt(document.getElementById('mode_toggles_countdown')?.value) || DEFAULT_OFF_COUNTDOWN;
    ext.loadCoreModes = document.getElementById('mode_toggles_load_core')?.checked ?? true;

    saveSettingsDebounced();
    console.log('Extension settings saved:', { enabled: extensionEnabled });
  } catch (error) {
    console.error("Error saving extension settings:", error);
  }
}

function loadExtensionSettings() {
  try {
    const settings = extension_settings[EXTENSION_NAME] || {};
    extensionEnabled = settings.hasOwnProperty('enabled') ? settings.enabled : true;

    const guidedGenerationsCheckbox = document.getElementById('mode_toggles_guided_generations');
    if (guidedGenerationsCheckbox) guidedGenerationsCheckbox.checked = settings.guidedGenerations || false;

    const preFramingTextarea = document.getElementById('mode_toggles_framing');
    if (preFramingTextarea) preFramingTextarea.value = settings.preFraming ?? DEFAULT_PRE_FRAMING;

    const mergeFormatTextarea = document.getElementById('mode_toggles_merge');
    if (mergeFormatTextarea) mergeFormatTextarea.value = settings.mergeFormat ?? DEFAULT_MERGE_FORMAT;

    const postFramingTextarea = document.getElementById('mode_toggles_framing_post');
    if (postFramingTextarea) postFramingTextarea.value = settings.postFraming ?? DEFAULT_POST_FRAMING;

    const countdownInput = document.getElementById('mode_toggles_countdown');
    if (countdownInput) countdownInput.value = settings.countdown || DEFAULT_OFF_COUNTDOWN;

    const checkbox = document.getElementById('mode_toggles_enabled');
    if (checkbox) checkbox.checked = extensionEnabled;

    const loadCoreCheckbox = document.getElementById('mode_toggles_load_core');
    if (loadCoreCheckbox) loadCoreCheckbox.checked = settings.hasOwnProperty('loadCoreModes') ? settings.loadCoreModes : true;

    if (extensionEnabled) enableExtension();
    else disableExtension();

    console.log('Extension settings loaded:', settings);
  } catch (error) {
    console.error("Error loading extension settings:", error);
  }
}

function setupSettingsListeners() {
  const checkbox = document.getElementById('mode_toggles_enabled');
  if (checkbox) {
    checkbox.addEventListener('change', (e) => e.target.checked ? enableExtension() : disableExtension());
    checkbox.checked = extensionEnabled;
  }

  const guidedGenerationsCheckbox = document.getElementById('mode_toggles_guided_generations');
  if (guidedGenerationsCheckbox) guidedGenerationsCheckbox.addEventListener('change', saveExtensionSettings);

  const preFramingTextarea = document.getElementById('mode_toggles_framing');
  if (preFramingTextarea) preFramingTextarea.addEventListener('input', saveExtensionSettings);

  const mergeFormatTextarea = document.getElementById('mode_toggles_merge');
  if (mergeFormatTextarea) mergeFormatTextarea.addEventListener('input', saveExtensionSettings);

  const postFramingTextarea = document.getElementById('mode_toggles_framing_post');
  if (postFramingTextarea) postFramingTextarea.addEventListener('input', saveExtensionSettings);

  const countdownInput = document.getElementById('mode_toggles_countdown');
  if (countdownInput) countdownInput.addEventListener('input', saveExtensionSettings);

  const removeAllButton = document.getElementById('mode_toggles_remove_all');
  if (removeAllButton) removeAllButton.addEventListener('click', removeAllCustomModes);

  const resetDefaultsButton = document.getElementById('mode_toggles_reset_defaults');
  if (resetDefaultsButton) resetDefaultsButton.addEventListener('click', resetToDefaults);

  const loadCoreCheckbox = document.getElementById('mode_toggles_load_core');
  if (loadCoreCheckbox) loadCoreCheckbox.addEventListener('change', saveExtensionSettings);

}

function addModeOverride(name, description, group = 'Unsorted') {
  try {
    const overrides = getModeOverrides();
    overrides[name] = { description, group: group || 'Unsorted' };
    saveSettingsDebounced();
  } catch (error) {
    console.error("Error adding mode override:", error);
  }
}

function removeModeOverride(name) {
  try {
    const overrides = getModeOverrides();
    if (overrides[name]) {
      delete overrides[name];
      // If this mode does not exist in defaults, also clear any chat state entries
      const isDefault = DEFAULT_MODES.some(m => m.name === name);
      if (!isDefault) {
        const all = getChatStatesAll();
        Object.keys(all).forEach(chatId => {
          if (all[chatId][name]) delete all[chatId][name];
        });
      }
      saveSettingsDebounced();
    }
  } catch (error) {
    console.error("Error removing mode override:", error);
  }
}

// This exists for parity with older code paths; now it just ensures overrides object exists.
function loadModeOverrides() {
  try {
    getModeOverrides();
    console.log('Mode overrides ready:', extension_settings[EXTENSION_NAME]?.modeOverrides || {});
  } catch (error) {
    console.error("Error loading mode overrides:", error);
  }
}

// Remove all custom modes (overrides only), keep defaults
async function removeAllCustomModes() {
  if (!extensionEnabled) return;
  try {
    const result = await Popup.show.confirm(
      'Remove All Custom Modes',
      'This will remove all custom modes you have added. Default modes will remain unchanged. This action cannot be undone.',
      { okButton: 'Remove All', cancelButton: 'Cancel' }
    );
    if (result === POPUP_RESULT.AFFIRMATIVE) {
      const overrides = getModeOverrides();
      const defaultNames = new Set(DEFAULT_MODES.map(m => m.name));
      const toRemoveFromStates = new Set();

      for (const name of Object.keys(overrides)) {
        if (!defaultNames.has(name)) toRemoveFromStates.add(name);
        delete overrides[name];
      }

      // Clean chat states of custom-only modes
      const all = getChatStatesAll();
      for (const chatId of Object.keys(all)) {
        for (const name of toRemoveFromStates) {
          if (all[chatId][name]) delete all[chatId][name];
        }
      }

      saveSettingsDebounced();
      updateMenuTitle();
      updateModTogToolsMenu();

      if (window.toastr) toastr.success('All custom modes removed', 'Mode Toggle');
    }
  } catch (error) {
    console.error("Error removing custom modes:", error);
  }
}

// Reset entire extension to defaults (no reload)
async function resetToDefaults() {
  if (!extensionEnabled) return;
  try {
    const result = await Popup.show.confirm(
      'Reset to Defaults',
      'This will reset all extension settings to their default values and remove all custom modes and per-chat states. This action cannot be undone.',
      { okButton: 'Reset All', cancelButton: 'Cancel' }
    );
    if (result === POPUP_RESULT.AFFIRMATIVE) {
      delete extension_settings[EXTENSION_NAME];
      saveSettingsDebounced();

      // Re-init with defaults in-memory
      extensionEnabled = true;
      loadExtensionSettings(); // reload UI fields into defaults
      updateMenuTitle();
      updateModTogToolsMenu();

      if (window.toastr) toastr.success('Extension reset to defaults', 'Mode Toggle');
    }
  } catch (error) {
    console.error("Error resetting to defaults:", error);
  }
}

async function showAddEditModeDialog(initialName = '', initialGroup = '', initialDescription = '') {
  if (!extensionEnabled) return;
  try {
    const defaultValue = initialName
      ? `${initialName} - ${initialGroup || 'Unsorted'} - ${initialDescription || ''}`.replace(/\s+-\s+$/, '')
      : '';

    const result = await Popup.show.input(
      'Add/Edit Mode',
      'Enter: "Name - Group - Description"<br>Also accepts "Name - Description" (uses group "Unsorted").<br>Leave description blank to remove custom mode.',
      defaultValue,
      { rows: 6, okButton: 'Save', cancelButton: 'Cancel' }
    );

    if (result !== null && result !== '') {
      const parts = result.split(' - ');
      const name = (parts[0] || '').trim();

      let group, description;
      if (parts.length >= 3) {
        group = (parts[1] || '').trim() || 'Unsorted';
        description = parts.slice(2).join(' - ').trim();
      } else if (parts.length === 2) {
        group = 'Unsorted';
        description = (parts[1] || '').trim();
      } else {
        group = 'Unsorted';
        description = '';
      }

      if (!name) {
        if (window.toastr) toastr.error('Mode name cannot be empty', 'Mode Toggle');
        return;
      }

      if (description === '') {
        // Remove override if description is blank
        const wasOverridden = !!getModeOverrides()[name];
        removeModeOverride(name);

        if (window.toastr) {
          if (wasOverridden) toastr.success(`Mode "${name}" override removed`, 'Mode Toggle');
          else toastr.info(`No custom override for "${name}" to remove`, 'Mode Toggle');
        }
      } else {
        addModeOverride(name, description, group);
        if (window.toastr) toastr.success(`Mode "${name}" saved`, 'Mode Toggle');
      }

      updateMenuTitle();
      updateModTogToolsMenu();
      saveSettingsDebounced();
    }
  } catch (error) {
    console.error("Error in add/edit mode dialog:", error);
    if (window.toastr) toastr.error('Error processing mode changes', 'Mode Toggle');
  }
}



function exportModes() {
  if (!extensionEnabled) return;
  try {
    const overrides = getModeOverrides();
    if (Object.keys(overrides).length === 0) {
      if (window.toastr) toastr.info('No custom modes to export', 'Mode Toggle');
      return;
    }
    const exportLines = Object.keys(overrides).map(name => {
      const ov = overrides[name] || {};
      const group = ov.group || 'Unsorted';
      const description = ov.description || '';
      return `${name} - ${group} - ${description}`;
    });
    const exportText = exportLines.join('\n');

    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mode-toggles-export.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (window.toastr) toastr.success(`Exported ${Object.keys(overrides).length} custom mode(s)`, 'Mode Toggle');
  } catch (error) {
    console.error("Error exporting modes:", error);
    if (window.toastr) toastr.error('Error exporting modes', 'Mode Toggle');
  }
}


async function showImportDialog() {
  if (!extensionEnabled) return;
  try {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.txt,.text,text/plain';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    const filePromise = new Promise((resolve, reject) => {
      fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsText(file);
        } else {
          resolve(null);
        }
      });
      setTimeout(() => resolve(null), 30000);
    });

    fileInput.click();
    const result = await filePromise;
    document.body.removeChild(fileInput);

    if (result !== null && result.trim() !== '') {
      const lines = result.split('\n').map(line => line.trim()).filter(Boolean);
      let importedCount = 0;
      let errorCount = 0;

      lines.forEach(line => {
        const parts = line.split(' - ');
        const name = parts[0]?.trim();

        let group, description;
        if (parts.length >= 3) {
          group = (parts[1] || '').trim() || 'Unsorted';
          description = parts.slice(2).join(' - ').trim();
        } else if (parts.length === 2) {
          group = 'Unsorted';
          description = (parts[1] || '').trim();
        } else {
          // not enough parts to create or remove meaningfully
          errorCount++;
          return;
        }

        if (!name || !description) {
          errorCount++;
          return;
        }

        addModeOverride(name, description, group);
        importedCount++;
      });

      updateMenuTitle();
      updateModTogToolsMenu();
      saveSettingsDebounced();

      if (window.toastr) {
        if (importedCount > 0) toastr.success(`Imported ${importedCount} mode(s) from file`, 'Mode Toggle');
        if (errorCount > 0) toastr.warning(`${errorCount} line(s) skipped due to format errors`, 'Mode Toggle');
      }
    } else if (result === null) {
      if (window.toastr) toastr.info('Import cancelled', 'Mode Toggle');
    }
  } catch (error) {
    console.error("Error importing modes:", error);
    if (window.toastr) toastr.error('Error importing modes from file', 'Mode Toggle');
  }
}





// ===== Per-Chat State: Toggle / Load / Save =====
function toggleModeStatus(modeName) {
  if (!extensionEnabled) return;

  const effectiveMap = getEffectiveModesMap();
  if (!effectiveMap.has(modeName)) return; // ignore non-existent mode

  const chatId = getCurrentChatId();
  const state = getChatState(chatId);
  const curr = state[modeName]?.status ?? 'OFF';

  let next, nextCountdown;
  switch (curr) {
    case 'OFF':
      next = 'Activating'; nextCountdown = undefined; break;
    case 'ON':
      next = 'Deactivating'; nextCountdown = undefined; break;
    case 'Activating':
      next = 'OFF'; nextCountdown = undefined; break;
    case 'Deactivating':
      next = 'ON'; nextCountdown = undefined; break;
    default:
      next = 'OFF'; nextCountdown = getCountdown();
  }

  state[modeName] = { status: next };
  if (nextCountdown !== undefined) state[modeName].countdown = nextCountdown;
  if (state[modeName].schedule === undefined) state[modeName].schedule = 'X';


  saveSettingsDebounced();
  updateMenuTitle();
  updateModTogToolsMenu();
}

// For compatibility with older calls; saving is immediate on change now.
function saveModeStates() {
  if (!extensionEnabled) return;
  try {
    saveSettingsDebounced();
  } catch (error) {
    console.error("Error saving mode states:", error);
  }
}

function loadModeStates() {
  if (!extensionEnabled) return;
  try {
    const chatId = getCurrentChatId();
    const state = getChatState(chatId);
    console.log(`Loaded mode states for chat ${chatId}:`, state);

    updateMenuTitle();
    updateModTogToolsMenu();

    const activeCount = Object.values(state).filter(s => s.status === 'ON').length;
    if (activeCount > 0 && window.toastr) {
      toastr.info(`Restored ${activeCount} active mode(s)`, 'Mode Toggle');
    }
  } catch (error) {
    console.error("Error loading mode states:", error);
  }
}

function repositionMenu() {
  if (!modTogToolsMenu || modTogToolsMenu.style.display !== 'block') return;

  const padding = 8;

  // Keep max-height within viewport
  const maxH = Math.min(500, window.innerHeight - padding * 2);
  modTogToolsMenu.style.maxHeight = `${maxH}px`;

  // Measure after maxHeight applied
  const menuRect = modTogToolsMenu.getBoundingClientRect();

  let left = lastClickPosition.x;
  let top;

  const spaceAbove = lastClickPosition.y - padding;
  const spaceBelow = window.innerHeight - lastClickPosition.y - padding;

  // Prefer placing fully above; else fully below; else clamp the best we can
  if (menuRect.height <= spaceAbove) {
    top = lastClickPosition.y - menuRect.height - padding;
  } else if (menuRect.height <= spaceBelow) {
    top = lastClickPosition.y + padding;
  } else {
    if (spaceBelow >= spaceAbove) {
      top = Math.max(padding, Math.min(lastClickPosition.y + padding, window.innerHeight - menuRect.height - padding));
    } else {
      top = Math.max(padding, Math.min(lastClickPosition.y - menuRect.height - padding, window.innerHeight - menuRect.height - padding));
    }
  }

  // Horizontal clamp
  if (left + menuRect.width + padding > window.innerWidth) {
    left = Math.max(padding, window.innerWidth - menuRect.width - padding);
  } else {
    left = Math.max(padding, left);
  }

  modTogToolsMenu.style.left = `${left}px`;
  modTogToolsMenu.style.top = `${top}px`;
}

function updateMenuTitle() {
  if (!extensionEnabled) return;
  const menuButton = document.getElementById('modtog_menu_button');
  if (menuButton) {
    const activeCount = getModesView().filter(m => m.status === 'ON').length;
    menuButton.title = `${activeCount} Mode${activeCount !== 1 ? 's' : ''} active.`;
    menuButton.firstChild.innerText=`${activeCount}`

  }
}

function updateModTogToolsMenu() {
  if (!modTogToolsMenu || !extensionEnabled) return;

  const root = modTogToolsMenuContent || modTogToolsMenu;
  root.innerHTML = '';

  const view = getModesView();

  const q = (currentSearchQuery || '').trim();
  const filterFn = q
    ? (m) => {
        const hay = `${m.name} ${m.group || 'Unsorted'} ${m.description}`.toLowerCase();
        return hay.includes(q);
      }
    : () => true;

  const filtered = view.filter(filterFn);

  const isActiveish = (m) => (m.status === 'ON' || m.status === 'Activating' || m.status === 'Deactivating');

  // Enabled section (only if any after filter)
  const enabled = filtered.filter(isActiveish).sort((a, b) => a.name.localeCompare(b.name));
  if (enabled.length > 0) {
    const { section, content } = createAccordionSection('Enabled', enabled);
    enabled.forEach(mode => content.appendChild(makeModeButton(mode)));
    root.appendChild(section);
  }

  // Group sections (apply filter)
  const groupsMap = new Map();
  for (const mode of filtered) {
    const g = mode.group || 'Unsorted';
    if (!groupsMap.has(g)) groupsMap.set(g, []);
    groupsMap.get(g).push(mode);
  }

  const groupNames = Array.from(groupsMap.keys()).sort((a, b) => a.localeCompare(b));

  for (const gName of groupNames) {
    const items = groupsMap.get(gName).slice().sort((a, b) => a.name.localeCompare(b.name));
    if (items.length === 0) continue;
    const { section, content } = createAccordionSection(gName, items);
    items.forEach(mode => content.appendChild(makeModeButton(mode)));
    root.appendChild(section);
  }

  // Separator
  const separator = document.createElement('div');
  separator.style.borderTop = '2px solid #555';
  separator.style.margin = '5px 0';
  root.appendChild(separator);

  // Add/Edit, Import/Export
  root.appendChild(makeAddEditButton());
  root.appendChild(makeImportExportButtons());
}



function addMenuButton() {
  let menupresent = document.getElementById('modtog_menu_button');
  if (!menupresent) {
    const container = document.getElementById('gg-menu-buttons-container');
    if (container) {
      const menuButton = document.createElement('div');
      menuButton.id = 'modtog_menu_button';
      menuButton.className = 'gg-menu-button fa-solid fa-microchip interactable';
      menuButton.title = '0 Modes active.';
      menuButton.tabIndex = 0;
      menuButton.innerHTML='<span id="modtog_counter_span" class="pg-guide-counter">0</span>';


      if (!extensionEnabled) menuButton.style.display = 'none';

      menuButton.addEventListener('click', (e) => {
        if (!extensionEnabled) return;
        e.stopPropagation();

        lastClickPosition.x = e.clientX;
        lastClickPosition.y = e.clientY;

        if (!modTogToolsMenu) createModTogToolsMenu();

        if (modTogToolsMenu.style.display === 'block') {
          modTogToolsMenu.style.display = 'none';
        } else {
          document.querySelectorAll('.gg-tools-menu').forEach(menu => {
            if (menu !== modTogToolsMenu) menu.style.display = 'none';
          });

          modTogToolsMenu.style.display = 'block';
          modTogToolsMenu.style.position = 'fixed';
          modTogToolsMenu.style.zIndex = '99999';

          updateModTogToolsMenu();
          repositionMenu();

          modTogSearchInput?.focus();
          modTogSearchInput?.select();
        }
      });

      container.appendChild(menuButton);
      updateMenuTitle();
      return true;
    }
  }
  return false;
}

function addExtensionMenuButton() {
  const $extensions_menu = $('#extensionsMenu');
  if (!$extensions_menu.length) return;

  if ($extensions_menu.find('[data-extension="mode-toggles"]').length > 0) return;

  let $button = $(`
    <div class="list-group-item flex-container flexGap5 interactable" 
         title="Open Mode Toggles Menu" 
         data-i18n="[title]Open Mode Toggles Menu" 
         data-extension="mode-toggles"
         tabindex="0">
        <i class="fa-solid fa-microchip"></i>
        <span>Mode Toggles</span>
    </div>
  `);

  if (!extensionEnabled) $button.hide();
  $button.appendTo($extensions_menu);

  $button.click((e) => {
    if (!extensionEnabled) return;
    e.stopPropagation();

    const extensionsButton = document.querySelector('#extensionsMenuButton');
    if (extensionsButton) {
      const rect = extensionsButton.getBoundingClientRect();
      lastClickPosition.x = rect.right;
      lastClickPosition.y = rect.bottom;
    } else {
      lastClickPosition.x = window.innerWidth / 2;
      lastClickPosition.y = window.innerHeight / 2;
    }

    if (!modTogToolsMenu) createModTogToolsMenu();

    $('#extensionsMenu').removeClass('show');

    document.querySelectorAll('.gg-tools-menu').forEach(menu => {
      if (menu !== modTogToolsMenu) menu.style.display = 'none';
    });

    modTogToolsMenu.style.display = 'block';
    modTogToolsMenu.style.position = 'fixed';
    modTogToolsMenu.style.zIndex = '99999';

    updateModTogToolsMenu();
    repositionMenu();
    modTogSearchInput?.focus();
    modTogSearchInput?.select();

  });
}

function createAccordionSection(title, items = []) {
  const section = document.createElement('div');
  section.className = 'accordion-section';

  const header = document.createElement('div');
  header.className = 'accordion-header';
  header.textContent = `${title} (${items.length})`;
  header.style.cursor = 'pointer';
  header.style.padding = '6px 10px';
  header.style.background = '#222';
  header.style.color = '#ccc';
  header.style.fontWeight = 'bold';
  header.style.userSelect = 'none';

  const content = document.createElement('div');
  content.className = 'accordion-content';

  // Restore persisted state (default collapsed)
  const key = String(title);
  const isOpen = !!accordionOpenState[key];
  content.style.display = isOpen ? 'block' : 'none';
  content.style.paddingLeft = '8px';

  header.addEventListener('click', () => {
    const nowOpen = content.style.display === 'none';
    content.style.display = nowOpen ? 'block' : 'none';
    accordionOpenState[key] = nowOpen;
    repositionMenu();
  });

  section.appendChild(header);
  section.appendChild(content);
  return { section, header, content };
}



// NEW: builds a single mode button (moved out of updateModTogToolsMenu)
function makeModeButton(mode) {
  const button = document.createElement('div');
  button.className = 'gg-tools-menu-item interactable';

  let statusDisplay = mode.status;
  if (mode.status === 'OFF' && mode.countdown !== undefined) {
    statusDisplay = `OFF(${mode.countdown})`;
  }

  button.innerHTML = `<strong>${mode.name} ${statusDisplay}</strong><div>${mode.description}</div>`;
  button.style.cursor = 'pointer';
  button.style.padding = '8px 12px';
  button.style.borderBottom = '1px solid #333';
  button.style.fontSize = 'small';
  button.title = 'Click to toggle, Ctrl-Click to Edit';

  button.addEventListener('click', (e) => {
    e.stopPropagation();
    if (e.ctrlKey) {
      // Ctrl+Click → open prefilled edit dialog
      modTogToolsMenu.style.display = 'none';
      showAddEditModeDialog(mode.name, mode.group, mode.description);
    } else {
      // Normal click → toggle status
      toggleModeStatus(mode.name);
      setTimeout(repositionMenu, 0);
    }
  });

  if (mode.status === 'ON') {
    button.style.backgroundColor = 'rgba(0, 255, 0, 0.1)';
    button.style.color = '#90EE90';
  } else if (mode.status === 'OFF') {
    if (mode.countdown !== undefined) {
      button.style.backgroundColor = 'rgba(255, 165, 0, 0.1)';
      button.style.color = '#FFD700';
    } else {
      button.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
      button.style.color = '#FFB6C1';
    }
  } else if (mode.status === 'Activating') {
    button.style.backgroundColor = 'rgba(255, 255, 0, 0.1)';
    button.style.color = '#FFD700';
  } else if (mode.status === 'Deactivating') {
    button.style.backgroundColor = 'rgba(255, 165, 0, 0.1)';
    button.style.color = '#FFA500';
  }

  return button;
}

// NEW: builds the "+ Add/Edit Mode" menu button
function makeAddEditButton() {
  const addEditButton = document.createElement('div');
  addEditButton.className = 'gg-tools-menu-item interactable';
  addEditButton.innerHTML = '<strong>+ Add/Edit Mode</strong>';
  addEditButton.style.cursor = 'pointer';
  addEditButton.style.padding = '8px 12px';
  addEditButton.style.fontSize = 'small';
  addEditButton.style.backgroundColor = 'rgba(0, 0, 255, 0.1)';
  addEditButton.style.color = '#87CEEB';
  addEditButton.style.textAlign = 'center';

  addEditButton.addEventListener('click', (e) => {
    e.stopPropagation();
    modTogToolsMenu.style.display = 'none';
    showAddEditModeDialog();
  });

  return addEditButton;
}

function disableAllModes() {
  if (!extensionEnabled) return;
  
  const chatId = getCurrentChatId();
  const state = getChatState(chatId);
  const view = getModesView(chatId);
  
  // Find all currently active modes (ON, Activating, or Deactivating)
  const activeModes = view.filter(m => 
    m.status === 'ON' || m.status === 'Activating' || m.status === 'Deactivating'
  );
  
  if (activeModes.length === 0) {
    if (window.toastr) toastr.info('No active modes to disable', 'Mode Toggle');
    return;
  }
  
  // Set all active modes to 'Deactivating' status
  let disabledCount = 0;
  for (const mode of activeModes) {
    if (state[mode.name]) {
      state[mode.name].status = 'Deactivating';
      delete state[mode.name].countdown; // Clear any existing countdown
      disabledCount++;
    }
  }
  
  // Save and update UI
  saveSettingsDebounced();
  updateMenuTitle();
  updateModTogToolsMenu();
  
  if (window.toastr && disabledCount > 0) {
    toastr.success(`Disabled ${disabledCount} mode${disabledCount !== 1 ? 's' : ''}`, 'Mode Toggle');
  }
}

function activateRandomMode() {
  if (!extensionEnabled) return;
  
  const chatId = getCurrentChatId();
  const state = getChatState(chatId);
  const view = getModesView(chatId);
  
  // Find all currently inactive modes (OFF status only)
  const inactiveModes = view.filter(m => m.status === 'OFF');
  
  if (inactiveModes.length === 0) {
    if (window.toastr) toastr.info('No inactive modes available to activate', 'Mode Toggle');
    return;
  }
  
  // Pick a random mode from the inactive ones
  const randomIndex = Math.floor(Math.random() * inactiveModes.length);
  const selectedMode = inactiveModes[randomIndex];
  
  // Set the selected mode to 'Activating' status
  if (!state[selectedMode.name]) {
    state[selectedMode.name] = {};
  }
  state[selectedMode.name].status = 'Activating';
  delete state[selectedMode.name].countdown; // Clear any existing countdown
  
  // Save and update UI
  saveSettingsDebounced();
  updateMenuTitle();
  updateModTogToolsMenu();
  
  if (window.toastr) {
    toastr.success(`Randomly activated: ${selectedMode.name}`, 'Mode Toggle');
  }
}


function scheduleOnClosing(popup){
  console.log(popup);
  const chatId = getCurrentChatId();
  const state = getChatState(chatId);

  jQuery(popup.content).find('input').each(function(i,e){
    if(e.dataset.mode in state){

      let val = e.value.toUpperCase().replace(/[^\-X0-9]/g, '');
      if(!val){
        val = 'X';
      }

      state[e.dataset.mode].schedule = val;
    }
  })

  return true;
}


function editSchedules(){
  let popup = new Popup(schedule_html_template, POPUP_TYPE.TEXT, undefined, {wider: true, okButton: 'Save', cancelButton: 'Cancel', onClose: scheduleOnClosing});

  let content = jQuery(popup.content)

  const chatId = getCurrentChatId();
  const state = getChatState(chatId);  
  const view = getModesView(chatId);
  const modesToInclude = view.filter(m => {
    return (m.status === 'ON' || m.status === 'Activating');;
  });

  let row_html =`
  <tr>
    <td>
        <div class="justifyLeft">
            <strong>{{modeName}} ({{displayStatus}})</strong>
            <div>{{modeDescription}}</div>
        </div>
    </td>
    <td>
        <div class="flex-container flexFlowColumn">
            <input type="text" data-mode="{{modeName}}" class="text_pole" value="{{schedule}}">
        </div>
    </td>
  </tr>`

  

  const lines = modesToInclude.map(m => {
    return row_html
      .replaceAll('{{modeName}}', m.name)
      .replaceAll('{{displayStatus}}', m.status)
      .replaceAll('{{modeDescription}}', m.description)
      .replaceAll('{{schedule}}', state[m.name].schedule || 'X');
  });

  globalThis.modcontent = content
  globalThis.modlines   = lines

  content.find('#mod_tod_sched_table').html(jQuery(lines.join('\n')));

  content.find('input').on('input', function() {
    let inputValue = $(this).val().toUpperCase();
    let cleanedValue = inputValue.replace(/[^\-X0-9]/g, '');
    $(this).val(cleanedValue);
  });

  popup.show();
}


function makeImportExportButtons() {
  const importExportContainer = document.createElement('div');
  importExportContainer.style.display = 'flex';
  importExportContainer.style.flexDirection = 'column';
  importExportContainer.style.gap = '2px';
  
  // First row: Import/Export buttons
  const firstRow = document.createElement('div');
  firstRow.style.display = 'flex';
  firstRow.style.gap = '2px';
  
  const exportButton = document.createElement('div');
  exportButton.className = 'gg-tools-menu-item interactable';
  exportButton.innerHTML = '<strong>📤 Export</strong>';
  exportButton.style.cursor = 'pointer';
  exportButton.style.padding = '4px 8px';
  exportButton.style.fontSize = 'small';
  exportButton.style.backgroundColor = 'rgba(0, 128, 0, 0.1)';
  exportButton.style.color = '#90EE90';
  exportButton.style.textAlign = 'center';
  exportButton.style.flex = '1';
  exportButton.addEventListener('click', (e) => {
    e.stopPropagation();
    modTogToolsMenu.style.display = 'none';
    exportModes();
  });
  
  const importButton = document.createElement('div');
  importButton.className = 'gg-tools-menu-item interactable';
  importButton.innerHTML = '<strong>📥 Import</strong>';
  importButton.style.cursor = 'pointer';
  importButton.style.padding = '4px 8px';
  importButton.style.fontSize = 'small';
  importButton.style.backgroundColor = 'rgba(255, 165, 0, 0.1)';
  importButton.style.color = '#FFA500';
  importButton.style.textAlign = 'center';
  importButton.style.flex = '1';
  importButton.addEventListener('click', (e) => {
    e.stopPropagation();
    modTogToolsMenu.style.display = 'none';
    showImportDialog();
  });
  
  firstRow.appendChild(exportButton);
  firstRow.appendChild(importButton);
  
  // Second row: Disable All/Activate Random buttons
  const secondRow = document.createElement('div');
  secondRow.style.display = 'flex';
  secondRow.style.gap = '2px';
  
  const disableAllButton = document.createElement('div');
  disableAllButton.className = 'gg-tools-menu-item interactable';
  disableAllButton.innerHTML = '<strong>🚫 Disable All</strong>';
  disableAllButton.style.cursor = 'pointer';
  disableAllButton.style.padding = '4px 8px';
  disableAllButton.style.fontSize = 'small';
  disableAllButton.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
  disableAllButton.style.color = '#FF6B6B';
  disableAllButton.style.textAlign = 'center';
  disableAllButton.style.flex = '1';
  disableAllButton.addEventListener('click', (e) => {
    disableAllModes();
    e.stopPropagation();
  });
  
  const activateRandomButton = document.createElement('div');
  activateRandomButton.className = 'gg-tools-menu-item interactable';
  activateRandomButton.innerHTML = '<strong>🎲 Add Random</strong>';
  activateRandomButton.style.cursor = 'pointer';
  activateRandomButton.style.padding = '4px 8px';
  activateRandomButton.style.fontSize = 'small';
  activateRandomButton.style.backgroundColor = 'rgba(128, 0, 128, 0.1)';
  activateRandomButton.style.color = '#DA70D6';
  activateRandomButton.style.textAlign = 'center';
  activateRandomButton.style.flex = '1';
  activateRandomButton.addEventListener('click', (e) => {
    activateRandomMode();
    e.stopPropagation();
  });
  
  const scheduleButton = document.createElement('div');
  scheduleButton.className = 'gg-tools-menu-item interactable';
  scheduleButton.innerHTML = '<strong>📅 Schedule</strong>';
  scheduleButton.style.cursor = 'pointer';
  scheduleButton.style.padding = '4px 8px';
  scheduleButton.style.fontSize = 'small';
  scheduleButton.style.backgroundColor = 'rgba(137, 112, 218, 0.1)';
  scheduleButton.style.color = '#8970da';
  scheduleButton.style.textAlign = 'center';
  scheduleButton.style.flex = '1';
  scheduleButton.addEventListener('click', (e) => {
    editSchedules();
    e.stopPropagation();
  });

  secondRow.appendChild(disableAllButton);
  secondRow.appendChild(activateRandomButton);
  secondRow.appendChild(scheduleButton);
  
  // Add both rows to the container
  importExportContainer.appendChild(firstRow);
  importExportContainer.appendChild(secondRow);
  
  return importExportContainer;
}




function createModTogToolsMenu() {
  modTogToolsMenu = document.createElement('div');
  modTogToolsMenu.id = 'modtog_tools_menu';
  modTogToolsMenu.className = 'gg-tools-menu';
  modTogToolsMenu.style.display = 'none';
  modTogToolsMenu.style.maxWidth = '400px';
  modTogToolsMenu.style.minWidth = '400px';
  modTogToolsMenu.style.maxHeight = '500px';
  modTogToolsMenu.style.overflowY = 'auto';

  // Sticky header with search
  const header = document.createElement('div');
  header.style.position = 'sticky';
  header.style.top = '0';
  header.style.background = '#111';
  header.style.zIndex = '1';
  header.style.padding = '6px';
  header.style.borderBottom = '1px solid #333';
  header.style.boxShadow = '0 2px 4px rgba(0,0,0,0.4)';

  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Search modes... (name, group, description)';
  search.style.width = '100%';
  search.style.padding = '6px 8px';
  search.style.borderRadius = '4px';
  search.style.border = '1px solid #444';
  search.style.background = '#222';
  search.style.color = '#ddd';

  search.addEventListener('input', () => {
    currentSearchQuery = (search.value || '').trim().toLowerCase();
    updateModTogToolsMenu();
    repositionMenu();
  });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      search.value = '';
      currentSearchQuery = '';
      updateModTogToolsMenu();
      repositionMenu();
      e.stopPropagation();
    }
  });

  header.appendChild(search);
  modTogToolsMenu.appendChild(header);
  modTogSearchInput = search;

  // Content container below sticky header
  modTogToolsMenuContent = document.createElement('div');
  modTogToolsMenu.appendChild(modTogToolsMenuContent);

  document.body.appendChild(modTogToolsMenu);

  document.addEventListener('click', (e) => {
    if (!modTogToolsMenu.contains(e.target) && e.target.id !== 'modtog_menu_button') {
      modTogToolsMenu.style.display = 'none';
    }
  });
}



// ===== Event Listeners =====
function setupEventListeners() {
  try {
    const context = SillyTavern.getContext();
    const { eventSource, event_types } = context;
    if (!eventSource || !event_types) {
      console.error("EventSource or event_types not available");
      return;
    }

    eventSource.on(event_types.CHAT_CHANGED, () => {
      console.log("Chat changed - loading mode states");
      tick=0;
      setTimeout(loadModeStates, 100);
    });

    eventSource.on(event_types.APP_READY, () => {
      console.log("App ready - initial load");
      tick=0;
      setTimeout(() => {
        loadModeOverrides();
        loadModeStates();
      }, 500);
    });

    console.log("Mode toggles event listeners registered");
  } catch (error) {
    console.error("Error setting up event listeners:", error);
  }
}




// ===== Prompt Interceptor =====
globalThis.modTogPromptInterceptor = async function(chat, contextSize, abort, type) {
  if (!extensionEnabled) return;

  const chatId = getCurrentChatId();
  const state = getChatState(chatId);
  const view = getModesView(chatId);
  const settings = extension_settings[EXTENSION_NAME] || {};

  // Decide which modes to include in the prefix
  const modesToInclude = view.filter(m => {
    const activeish = (m.status === 'ON' || m.status === 'Activating' || m.status === 'Deactivating');
    const wasActiveButOff = (state[m.name] && m.status === 'OFF');
    return activeish || wasActiveButOff;
  });

  if (modesToInclude.length > 0 && chat.length > 0) {
    const mergeFormat = settings.mergeFormat || '[{{modeName}} {{displayStatus}}] - {{modeDescription}}';
    const lines = modesToInclude.map(m => {
      let displayStatus = m.status;
      if (displayStatus === 'Activating') displayStatus = 'ON';
      if (displayStatus === 'Deactivating') displayStatus = 'OFF';

      let schedule = m.schedule || 'X';
      let tickValue = schedule[tick%schedule.length]
      let prob = tickValue.replace('X','10').replace('-','0')*10;
      let active = Math.round(Math.random()*100) <= prob;

      if(displayStatus === 'ON' && !active){
        displayStatus = 'OFF';
      }

      return mergeFormat
        .replaceAll('{{modeName}}', m.name)
        .replaceAll('{{displayStatus}}', displayStatus)
        .replaceAll('{{modeDescription}}', m.description);
    });

    const pre = (settings.preFraming ?? DEFAULT_PRE_FRAMING).trim();
    const post = (settings.postFraming ?? DEFAULT_POST_FRAMING).trim();
    const prefix = '\n' + pre +'\n\n'+ lines.join('\n') + '\n\n' + post + '\n\n';

    const lastMessage = chat[chat.length - 1];
    if (lastMessage?.is_user) {
      lastMessage.mes = prefix + lastMessage.mes;
      tick++;
    }
  }

  // Apply transitions and countdowns
  const countdownDefault = getCountdown();
  const removed = [];
  for (const [name, st] of Object.entries(state)) {
    if (st.status === 'Activating') {
      st.status = 'ON'; delete st.countdown;
    } else if (st.status === 'Deactivating') {
      st.status = 'OFF'; st.countdown = countdownDefault;
    } else if (st.status === 'OFF' && st.countdown !== undefined) {
      st.countdown--;
      if (st.countdown <= 0) {
        delete state[name];
        removed.push(name);
      }
    }
  }

  if (removed.length && window.toastr) {
    toastr.info(`Cleared ${removed.length} mode(s) from memory`, 'Mode Toggle');
  }

  updateMenuTitle();
  updateModTogToolsMenu();
  saveSettingsDebounced();
};


modTogResizeObserver = new ResizeObserver(() => {
  if (modTogToolsMenu.style.display === 'block') {
    repositionMenu();
  }
});


window.addEventListener('resize', () => {
  if (modTogToolsMenu?.style.display === 'block') repositionMenu();
});


// ===== Settings init =====
async function initSettings() {

  await loadDefaultModesFromAssets();

  const html = await renderExtensionTemplateAsync("third-party/st-mode-toggles", "settings");
  jQuery(document.getElementById("extensions_settings")).append(html);

  console.log("Mode toggle extension initialized (immutable defaults + overrides + per-chat state)");

  setTimeout(() => {
    setupSettingsListeners();
    loadExtensionSettings();
  }, 100);

  setTimeout(setupEventListeners, 1000);

  // Add extension menu button
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addExtensionMenuButton);
  } else {
    addExtensionMenuButton();
  }

  // Observe for menu container creation
  const observer = new MutationObserver((mutations) => {
    for (let mutation of mutations) {
      if (mutation.type === 'childList') {
        for (let node of mutation.addedNodes) {
          if (node.nodeType === 1) {
            if (node.id === 'gg-menu-buttons-container' ||
                node.querySelector?.('#gg-menu-buttons-container')) {
              if (addMenuButton()) {
                observer.disconnect();
                return;
              }
            }
            if (node.id === 'extensionsMenu' ||
                node.querySelector?.('#extensionsMenu')) {
              setTimeout(addExtensionMenuButton, 100);
            }
          }
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  modTogResizeObserver.observe(modTogToolsMenu);

}

// ===== Expose for manual testing =====
globalThis.saveModeStates = saveModeStates;
globalThis.loadModeStates = loadModeStates;
globalThis.showAddEditModeDialog = showAddEditModeDialog;
globalThis.exportModes = exportModes;
globalThis.showImportDialog = showImportDialog;
globalThis.addExtensionMenuButton = addExtensionMenuButton;
globalThis.enableExtension = enableExtension;
globalThis.disableExtension = disableExtension;

// ===== Main =====
jQuery(() => {
  initSettings();

});
