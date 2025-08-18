
let modes = [
    { name: 'Noir Echo', description: "Shadowy, cyberpunk-inspired despair. Everything is rain-slick metal and neon betrayal.", status: "OFF" },

    { name: 'Silent Scream', description: "Psychological horror, isolation, and unseen threats. Fear is slow-burning and deeply personal.", status: "OFF" },

    { name: 'Dialogue Cheese', description: "Purposely bad one-liners (\"I'd flirt, but your ship's hotter than plasma exhaust.\").", status: "OFF" },

    { name: 'Terminal Logic', description: "Unseen AI calculates mortality rates aloud during crises.", status: "OFF" },

    { name: 'Veil of Shadows', description: "Supernatural mystery: half-seen figures, whispering winds, and cursed relics.", status: "OFF" },

    { name: 'Rashomon Effect', description: "Perspectives fracture, each scene retold from conflicting viewpoints.", status: "OFF" },

    { name: 'Echoed Futures', description: "Brief premonitions overlay scenes with probable outcomes. Ignoring them risks self-fulfilling disasters.", status: "OFF" },

    { name: 'Bureaucracy Ascendant', description: "Permits, stamps, and queue tickets govern everything. Timed forms, bribes, and rubber stamps unlock progress.", status: "OFF" },

    { name: 'Dreamwalk Threshold', description: "Sleep opens a shared dream commons. Actions there echo into waking terrain and relationships.", status: "OFF" },

    { name: 'Velvet Hour', description: "Lighting shifts to candlelit and velvet hues. Social hubs sprout lounges; flirting and dancing abound.", status: "OFF" },

    { name: 'Innuendo Engine', description: "Dialogue tilts suggestive. Double entendres unlock alternate quest solutions and secret vendors who only respond to clever wordplay.", status: "OFF" },

    { name: 'Censor Pixies', description: "Mischievous black bars and mosaic sprites flit about. They transform wardrobe malfunctions into slapstick hazards and can be herded to reveal secrets.", status: "OFF" },

    { name: 'Blush Meter', description: "Characters manifest visible blush gauges. High blush adds social crit chance and awkward fumbles; controlling it becomes a minigame.", status: "OFF" },

    { name: 'Gag Reel Spillover', description: "Outtakes bleed into reality. NPCs break, laugh, reset, and drop items labeled ‘prop’. These props have odd, exploitable rules.", status: "OFF" },

    { name: 'Developer Commentary', description: "Floating dev-notes appear near set pieces, revealing hints, cut content, and togglable challenge modifiers hidden behind commentary badges.", status: "OFF" },

    { name: 'Subtitle Saboteur', description: "Subtitles editorialize, spoil, or contradict the scene. Believing the captions alters encounter stats; ignoring them angers the captions.", status: "OFF" },

    { name: 'Narrator Hot Mic', description: "The narrator can hear you—and vice versa. Compliment them for boons, sass them and get roasted debuffs and fourth-wall hazards.", status: "OFF" },

    { name: 'Chekhov’s Arsenal', description: "Any item prominently introduced in a scene will forcibly matter later. Ignoring it spawns escalating set-piece payoffs.", status: "OFF" },

    { name: 'Trial by Gossip', description: "Rumor tribunals form after major beats. Crowd sentiment passes sentence: fines, favors, or other punishments.", status: "OFF" },

    { name: 'Split-Screen Fate', description: "Two timelines run concurrently, visible side-by-side. Swap items, body-block disasters, or let one future bait traps for the other.", status: "OFF" },

    { name: 'Dual-Process Undercurrent', description: "Silent Mode1/Mode2 metacognition powers every major character. Fast hunches steer snap checks; slow reasoning accrues ‘insight ticks’ between scenes. Starving one system builds pressure that bursts as either brilliant leaps or panic stalls.", status: "OFF" },

    { name: 'Desire Gradient', description: "Hidden desire vectors (belonging, novelty, mastery, status, safety) tug characters toward choices. Nudge axes via gifts, scenes, or rumors; aligned vectors reduce DCs, crossed vectors spawn sabotage and delicious mess.", status: "OFF" },

    { name: 'Goal Manifold', description: "Each character tracks a private goal stack with priorities and horizons. You can reorder it indirectly (deadlines, omens, rituals). Collisions generate emergent side quests instead of straight conflict.", status: "OFF" },

    { name: 'Rumination Threads', description: "Characters think offscreen. Between scenes, they integrate clues, revise loyalties, and hatch plans. Longer ruminations yield deeper insights—but risk outdated conclusions if the world moves on.", status: "OFF" },

    { name: 'Temptation Hooks', description: "Each character carries bespoke temptations (flattery, shortcuts, rival offers). Accept for immediate juice and arc drift; refuse to earn bankable ‘integrity’ for a single dramatic veto.", status: "OFF" },

    { name: 'Shadow Intent', description: "Beneath stated goals lies a quiet ‘true want’. Infer it from patterns; meeting it earns fanatic loyalty for one ask, after which the intent reshapes.", status: "OFF" },

    { name: 'Inner Committee', description: "Key NPCs host archetypal voices (Pragmatist, Romantic, Cynic, Caretaker). Address the right voice for bonuses; elevating one voice yields predictable allies—or monomaniacs.", status: "OFF" },

    { name: 'Bias Surfacing', description: "Characters periodically reveal a cognitive bias as flavor. Exploit it to lower DCs when framing choices that flatter the bias—or cure it for a long-term competence boost.", status: "OFF" },

    { name: 'Plot Immunity Auction', description: "At chapter breaks, characters secretly bid scarce plot armor. Influence bids via morale, leverage, or blackmail. Winners survive reckoning scenes; losers become stakes with better loot.", status: "OFF" }

];



import {
  Generate,
  extension_prompt_types,
  sendMessageAsUser,
  setExtensionPrompt,
  saveSettingsDebounced,
} from "../../../../script.js";
import { renderExtensionTemplateAsync, extension_settings } from "../../../extensions.js";
import { Popup, POPUP_TYPE, POPUP_RESULT } from "../../../popup.js";

let modTogToolsMenu;
let lastClickPosition = { x: 0, y: 0 };

// ===== NEW: Track which modes have been toggled =====
let toggledModes = new Set(); // Track modes that have been explicitly toggled

// ===== NEW: Persistence System =====
const EXTENSION_NAME = 'st-mode-toggles';

function getCurrentChatId() {
  try {
    const context = SillyTavern.getContext();
    // Create a unique identifier for this chat/character combination
    const chatId = context.chatId || 'default';
    const characterId = context.characterId || 'none';
    return `${characterId}_${chatId}`;
  } catch (error) {
    console.error("Error getting chat ID:", error);
    return 'fallback';
  }
}

// ===== NEW: Mode Override System =====
function saveModeOverrides() {
  try {
    // Initialize extension settings if needed
    if (!extension_settings[EXTENSION_NAME]) {
      extension_settings[EXTENSION_NAME] = {};
    }
    if (!extension_settings[EXTENSION_NAME].modeOverrides) {
      extension_settings[EXTENSION_NAME].modeOverrides = {};
    }
    
    saveSettingsDebounced();
    console.log('Mode overrides saved:', extension_settings[EXTENSION_NAME].modeOverrides);
  } catch (error) {
    console.error("Error saving mode overrides:", error);
  }
}

function loadModeOverrides() {
  try {
    const overrides = extension_settings[EXTENSION_NAME]?.modeOverrides || {};
    
    // Apply overrides to existing modes and add new custom modes
    Object.keys(overrides).forEach(modeName => {
      const override = overrides[modeName];
      const existingMode = modes.find(m => m.name === modeName);
      
      if (existingMode) {
        // Update existing mode
        existingMode.description = override.description;
      } else {
        // Add new custom mode
        modes.push({
          name: modeName,
          description: override.description,
          status: 'OFF'
        });
      }
    });
    
    console.log('Mode overrides loaded:', overrides);
  } catch (error) {
    console.error("Error loading mode overrides:", error);
  }
}

function addModeOverride(name, description) {
  try {
    if (!extension_settings[EXTENSION_NAME]) {
      extension_settings[EXTENSION_NAME] = {};
    }
    if (!extension_settings[EXTENSION_NAME].modeOverrides) {
      extension_settings[EXTENSION_NAME].modeOverrides = {};
    }
    
    extension_settings[EXTENSION_NAME].modeOverrides[name] = {
      description: description
    };
    
    saveModeOverrides();
  } catch (error) {
    console.error("Error adding mode override:", error);
  }
}

function removeModeOverride(name) {
  try {
    if (extension_settings[EXTENSION_NAME]?.modeOverrides?.[name]) {
      delete extension_settings[EXTENSION_NAME].modeOverrides[name];
      saveModeOverrides();
      
      // Remove custom mode from modes array if it was a custom addition
      const defaultModeNames = []; // This would contain your default mode names
      if (!defaultModeNames.includes(name)) {
        const modeIndex = modes.findIndex(m => m.name === name);
        if (modeIndex !== -1) {
          modes.splice(modeIndex, 1);
        }
      }
    }
  } catch (error) {
    console.error("Error removing mode override:", error);
  }
}

// ===== NEW: Add/Edit Mode Functionality =====
async function showAddEditModeDialog() {
  try {
    const result = await Popup.show.input(
      'Add/Edit Mode',
      'Enter mode in format: "Name - description"<br>Leave description blank to remove custom modes.',
      '',
      {
        rows: 2,
        okButton: 'Save',
        cancelButton: 'Cancel'
      }
    );
    
    if (result !== null && result !== '') {
      const parts = result.split(' - ');
      const name = parts[0]?.trim();
      const description = parts.slice(1).join(' - ').trim();
      
      if (!name) {
        if (window.toastr) {
          toastr.error('Mode name cannot be empty', 'Mode Toggle');
        }
        return;
      }
      
      if (description === '') {
        // Remove override if description is blank
        removeModeOverride(name);
        
        // Reset mode to default if it exists in default modes
        const existingMode = modes.find(m => m.name === name);
        if (existingMode) {
          // You would need to restore the original description here
          // For now, we'll just remove it if it was a custom mode
          const modeIndex = modes.findIndex(m => m.name === name);
          if (modeIndex !== -1) {
            modes.splice(modeIndex, 1);
          }
        }
        
        if (window.toastr) {
          toastr.success(`Mode "${name}" removed`, 'Mode Toggle');
        }
      } else {
        // Add or update mode
        const existingMode = modes.find(m => m.name === name);
        
        if (existingMode) {
          // Update existing mode
          existingMode.description = description;
        } else {
          // Add new mode
          modes.push({
            name: name,
            description: description,
            status: 'OFF'
          });
        }
        
        // Save override
        addModeOverride(name, description);
        
        if (window.toastr) {
          toastr.success(`Mode "${name}" ${existingMode ? 'updated' : 'added'}`, 'Mode Toggle');
        }
      }
      
      // Update UI
      updateMenuTitle();
      updateModTogToolsMenu();
      saveModeStates(); // Save current states including any new modes
    }
  } catch (error) {
    console.error("Error in add/edit mode dialog:", error);
    if (window.toastr) {
      toastr.error('Error processing mode changes', 'Mode Toggle');
    }
  }
}

// ===== NEW: Import/Export Functionality =====
function exportModes() {
  try {
    const overrides = extension_settings[EXTENSION_NAME]?.modeOverrides || {};
    
    if (Object.keys(overrides).length === 0) {
      if (window.toastr) {
        toastr.info('No custom modes to export', 'Mode Toggle');
      }
      return;
    }
    
    // Format modes as "Name - Description"
    const exportLines = Object.keys(overrides).map(name => {
      return `${name} - ${overrides[name].description}`;
    });
    
    const exportText = exportLines.join('\n');
    
    // Create and download file
    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mode-toggles-export.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    if (window.toastr) {
      toastr.success(`Exported ${Object.keys(overrides).length} custom mode(s)`, 'Mode Toggle');
    }
  } catch (error) {
    console.error("Error exporting modes:", error);
    if (window.toastr) {
      toastr.error('Error exporting modes', 'Mode Toggle');
    }
  }
}

async function showImportDialog() {
  try {
    // Create a hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.txt,.text,text/plain';
    fileInput.style.display = 'none';
    
    // Add to document temporarily
    document.body.appendChild(fileInput);
    
    // Create a promise to handle file selection
    const filePromise = new Promise((resolve, reject) => {
      fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve(e.target.result);
          };
          reader.onerror = (e) => {
            reject(new Error('Failed to read file'));
          };
          reader.readAsText(file);
        } else {
          resolve(null); // User cancelled
        }
      });
      
      // Timeout after 30 seconds to prevent hanging
      setTimeout(() => {
        resolve(null);
      }, 30000);
    });
    
    // Trigger the file dialog
    fileInput.click();
    
    // Wait for file selection and reading
    const result = await filePromise;
    
    // Clean up
    document.body.removeChild(fileInput);
    
    if (result !== null && result.trim() !== '') {
      const lines = result.split('\n').map(line => line.trim()).filter(line => line);
      let importedCount = 0;
      let errorCount = 0;
      
      lines.forEach(line => {
        const parts = line.split(' - ');
        const name = parts[0]?.trim();
        const description = parts.slice(1).join(' - ').trim();
        
        if (!name || !description) {
          errorCount++;
          return;
        }
        
        // Add or update mode
        const existingMode = modes.find(m => m.name === name);
        
        if (existingMode) {
          // Update existing mode
          existingMode.description = description;
        } else {
          // Add new mode
          modes.push({
            name: name,
            description: description,
            status: 'OFF'
          });
        }
        
        // Save override
        addModeOverride(name, description);
        importedCount++;
      });
      
      // Update UI
      updateMenuTitle();
      updateModTogToolsMenu();
      saveModeStates();
      
      if (window.toastr) {
        if (importedCount > 0) {
          toastr.success(`Imported ${importedCount} mode(s) from file`, 'Mode Toggle');
        }
        if (errorCount > 0) {
          toastr.warning(`${errorCount} line(s) skipped due to format errors`, 'Mode Toggle');
        }
      }
    } else if (result === null) {
      // User cancelled or no file selected
      if (window.toastr) {
        toastr.info('Import cancelled', 'Mode Toggle');
      }
    }
  } catch (error) {
    console.error("Error importing modes:", error);
    if (window.toastr) {
      toastr.error('Error importing modes from file', 'Mode Toggle');
    }
  }
}

function saveModeStates() {
  try {
    const chatId = getCurrentChatId();
    
    // Initialize extension settings if needed
    if (!extension_settings[EXTENSION_NAME]) {
      extension_settings[EXTENSION_NAME] = {};
    }
    if (!extension_settings[EXTENSION_NAME].chatStates) {
      extension_settings[EXTENSION_NAME].chatStates = {};
    }
    
    // CHANGE 1: Only save modes that have been toggled
    const modeStates = {};
    modes.forEach(mode => {
      if (toggledModes.has(mode.name)) {
        modeStates[mode.name] = mode.status;
      }
    });
    
    // Only save if there are toggled modes, otherwise delete the chat state
    if (Object.keys(modeStates).length > 0) {
      extension_settings[EXTENSION_NAME].chatStates[chatId] = modeStates;
    } else {
      delete extension_settings[EXTENSION_NAME].chatStates[chatId];
    }
    
    saveSettingsDebounced();
    
    console.log(`Saved mode states for chat ${chatId}:`, modeStates);
  } catch (error) {
    console.error("Error saving mode states:", error);
  }
}

function loadModeStates() {
  try {
    const chatId = getCurrentChatId();
    
    // Check if we have saved states for this chat
    const savedStates = extension_settings[EXTENSION_NAME]?.chatStates?.[chatId];
    
    if (savedStates) {
      console.log(`Loading mode states for chat ${chatId}:`, savedStates);
      
      // Reset all modes to OFF first
      modes.forEach(mode => {
        mode.status = 'OFF';
      });
      
      // Apply saved states and mark as toggled
      toggledModes.clear();
      Object.keys(savedStates).forEach(modeName => {
        const mode = modes.find(m => m.name === modeName);
        if (mode) {
          mode.status = savedStates[modeName];
          toggledModes.add(modeName);
        }
      });
      
      updateMenuTitle();
      updateModTogToolsMenu();
      
      // Show notification for active modes
      const activeModes = modes.filter(mode => mode.status === 'ON');
      if (activeModes.length > 0 && window.toastr) {
        toastr.info(`Restored ${activeModes.length} active mode(s)`, 'Mode Toggle');
      }
    } else {
      console.log(`No saved mode states found for chat ${chatId}, resetting to defaults`);
      // Reset all modes to OFF for new chats
      modes.forEach(mode => {
        mode.status = 'OFF';
      });
      toggledModes.clear();
      updateMenuTitle();
      updateModTogToolsMenu();
    }
  } catch (error) {
    console.error("Error loading mode states:", error);
  }
}

function repositionMenu() {
  if (!modTogToolsMenu || modTogToolsMenu.style.display !== 'block') return;
  
  const menuRect = modTogToolsMenu.getBoundingClientRect();
  modTogToolsMenu.style.left = `${lastClickPosition.x}px`;
  modTogToolsMenu.style.top = `${lastClickPosition.y - menuRect.height}px`;
}

function updateMenuTitle() {
  const menuButton = document.getElementById('modtog_menu_button');
  if (menuButton) {
    const activeCount = modes.filter(mode => mode.status === 'ON').length;
    menuButton.title = `${activeCount} Mode${activeCount !== 1 ? 's' : ''} active.`;
  }
}

function toggleModeStatus(modeName) {
  const mode = modes.find(m => m.name === modeName);
  if (mode) {
    // Mark this mode as toggled
    toggledModes.add(modeName);
    
    switch (mode.status) {
      case 'OFF':
        mode.status = 'Activating';
        break;
      case 'ON':
        mode.status = 'Deactivating';
        break;
      case 'Activating':
        mode.status = 'OFF';
        break;
      case 'Deactivating':
        mode.status = 'ON';
        break;
    }
    updateMenuTitle();
    updateModTogToolsMenu();
    
    // Save state changes immediately
    saveModeStates();
  }
}

// ===== Event Listener Setup =====
function setupEventListeners() {
  try {
    const context = SillyTavern.getContext();
    const { eventSource, event_types } = context;
    
    if (!eventSource || !event_types) {
      console.error("EventSource or event_types not available");
      return;
    }
    
    // Listen for chat changes
    eventSource.on(event_types.CHAT_CHANGED, () => {
      console.log("Chat changed - loading mode states");
      setTimeout(loadModeStates, 100);
    });
    
    // Also load on app ready
    eventSource.on(event_types.APP_READY, () => {
      console.log("App ready - performing initial mode state load");
      setTimeout(() => {
        loadModeOverrides();
        loadModeStates();
      }, 500);
    });
    
    console.log("Mode persistence event listeners registered");
    
  } catch (error) {
    console.error("Error setting up event listeners:", error);
  }
}

function updateModTogToolsMenu() {
  if (!modTogToolsMenu) return;
  
  modTogToolsMenu.innerHTML = '';
  
  const sortedModes = [...modes].sort((a, b) => {
    const aActive = a.status === 'ON' || a.status === 'Activating' || a.status === 'Deactivating';
    const bActive = b.status === 'ON' || b.status === 'Activating' || b.status === 'Deactivating';
    
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    return 0;
  });
  
  sortedModes.forEach(mode => {
    const button = document.createElement('div');
    button.className = 'gg-tools-menu-item interactable';
    button.innerHTML = `<strong>[${mode.name} ${mode.status}]</strong> - ${mode.description}`;
    button.style.cursor = 'pointer';
    button.style.padding = '8px 12px';
    button.style.borderBottom = '1px solid #333';
    button.style.fontSize = 'small';
    
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleModeStatus(mode.name);
      setTimeout(repositionMenu, 0);
    });
    
    if (mode.status === 'ON') {
      button.style.backgroundColor = 'rgba(0, 255, 0, 0.1)';
      button.style.color = '#90EE90';
    } else if (mode.status === 'OFF') {
      button.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
      button.style.color = '#FFB6C1';
    } else if (mode.status === 'Activating') {
      button.style.backgroundColor = 'rgba(255, 255, 0, 0.1)';
      button.style.color = '#FFD700';
    } else if (mode.status === 'Deactivating') {
      button.style.backgroundColor = 'rgba(255, 165, 0, 0.1)';
      button.style.color = '#FFA500';
    }
    
    modTogToolsMenu.appendChild(button);
  });
  
  // Add separator and Add/Edit button
  const separator = document.createElement('div');
  separator.style.borderTop = '2px solid #555';
  separator.style.margin = '5px 0';
  modTogToolsMenu.appendChild(separator);
  
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
    modTogToolsMenu.style.display = 'none'; // Hide menu first
    showAddEditModeDialog();
  });
  
  modTogToolsMenu.appendChild(addEditButton);
  
  // Add Import/Export buttons
  const importExportContainer = document.createElement('div');
  importExportContainer.style.display = 'flex';
  importExportContainer.style.gap = '2px';
  
  const exportButton = document.createElement('div');
  exportButton.className = 'gg-tools-menu-item interactable';
  exportButton.innerHTML = '<strong>📤 Export</strong>';
  exportButton.style.cursor = 'pointer';
  exportButton.style.padding = '6px 8px';
  exportButton.style.fontSize = 'small';
  exportButton.style.backgroundColor = 'rgba(0, 128, 0, 0.1)';
  exportButton.style.color = '#90EE90';
  exportButton.style.textAlign = 'center';
  exportButton.style.flex = '1';
  
  exportButton.addEventListener('click', (e) => {
    e.stopPropagation();
    modTogToolsMenu.style.display = 'none'; // Hide menu first
    exportModes();
  });
  
  const importButton = document.createElement('div');
  importButton.className = 'gg-tools-menu-item interactable';
  importButton.innerHTML = '<strong>📥 Import</strong>';
  importButton.style.cursor = 'pointer';
  importButton.style.padding = '6px 8px';
  importButton.style.fontSize = 'small';
  importButton.style.backgroundColor = 'rgba(255, 165, 0, 0.1)';
  importButton.style.color = '#FFA500';
  importButton.style.textAlign = 'center';
  importButton.style.flex = '1';
  
  importButton.addEventListener('click', (e) => {
    e.stopPropagation();
    modTogToolsMenu.style.display = 'none'; // Hide menu first
    showImportDialog();
  });
  
  importExportContainer.appendChild(exportButton);
  importExportContainer.appendChild(importButton);
  modTogToolsMenu.appendChild(importExportContainer);
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
      
      menuButton.addEventListener('click', (e) => {
        e.stopPropagation();
        
        lastClickPosition.x = e.clientX;
        lastClickPosition.y = e.clientY;
        
        if (!modTogToolsMenu) {
          createModTogToolsMenu();
        }
        
        if (modTogToolsMenu.style.display === 'block') {
          modTogToolsMenu.style.display = 'none';
        } else {
          document.querySelectorAll('.gg-tools-menu').forEach(menu => {
            if (menu !== modTogToolsMenu) {
              menu.style.display = 'none';
            }
          });
          
          modTogToolsMenu.style.display = 'block';
          modTogToolsMenu.style.position = 'fixed';
          modTogToolsMenu.style.zIndex = '99999';
          
          updateModTogToolsMenu();
          repositionMenu();
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
  // Select the Extensions dropdown menu
  let $extensions_menu = $('#extensionsMenu');
  if (!$extensions_menu.length) {
    return;
  }
  
  // Check if button already exists
  if ($extensions_menu.find('[data-extension="mode-toggles"]').length > 0) {
    return;
  }
  
  // Create button element with microchip icon and extension name
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
  
  // Append to extensions menu
  $button.appendTo($extensions_menu);
  
  // Set click handler to open the mode toggles menu
  $button.click((e) => {
    e.stopPropagation();
    
    // Position menu near the extensions menu button
    const extensionsButton = document.querySelector('#extensionsMenuButton');
    if (extensionsButton) {
      const rect = extensionsButton.getBoundingClientRect();
      lastClickPosition.x = rect.right;
      lastClickPosition.y = rect.bottom;
    } else {
      // Fallback positioning
      lastClickPosition.x = window.innerWidth / 2;
      lastClickPosition.y = window.innerHeight / 2;
    }
    
    if (!modTogToolsMenu) {
      createModTogToolsMenu();
    }
    
    // Close extensions menu
    $('#extensionsMenu').removeClass('show');
    
    // Show mode toggles menu
    document.querySelectorAll('.gg-tools-menu').forEach(menu => {
      if (menu !== modTogToolsMenu) {
        menu.style.display = 'none';
      }
    });
    
    modTogToolsMenu.style.display = 'block';
    modTogToolsMenu.style.position = 'fixed';
    modTogToolsMenu.style.zIndex = '99999';
    
    updateModTogToolsMenu();
    repositionMenu();
  });
}

function createModTogToolsMenu() {
  modTogToolsMenu = document.createElement('div');
  modTogToolsMenu.id = 'modtog_tools_menu';
  modTogToolsMenu.className = 'gg-tools-menu';
  modTogToolsMenu.style.display = 'none';
  modTogToolsMenu.style.maxWidth = '400px';
  modTogToolsMenu.style.maxHeight = '300px';
  modTogToolsMenu.style.overflowY = 'auto';
  
  document.body.appendChild(modTogToolsMenu);
  
  document.addEventListener('click', (e) => {
    if (!modTogToolsMenu.contains(e.target) && e.target.id !== 'modtog_menu_button') {
      modTogToolsMenu.style.display = 'none';
    }
  });
}

// ===== Global Prompt Interceptor =====
globalThis.modTogPromptInterceptor = async function(chat, contextSize, abort, type) {
  console.log("Mode toggle prompt interceptor triggered");
  
  const chatId = getCurrentChatId();
  const savedStates = extension_settings[EXTENSION_NAME]?.chatStates?.[chatId] || {};
  
  // CHANGE 2: Include modes that are currently active OR were previously active (in saved states but now OFF)
  const modesToInclude = modes.filter(mode => {
    const isCurrentlyActive = mode.status === 'ON' || mode.status === 'Activating' || mode.status === 'Deactivating';
    const wasPreviouslyActive = savedStates.hasOwnProperty(mode.name) && mode.status === 'OFF';
    return isCurrentlyActive || wasPreviouslyActive;
  });
  
  if (modesToInclude.length > 0 && chat.length > 0) {
    const modeLines = modesToInclude.map(mode => {
      let displayStatus = mode.status;
      if (mode.status === 'Activating') displayStatus = 'ON';
      if (mode.status === 'Deactivating') displayStatus = 'OFF';
      
      return  `[${mode.name} ${displayStatus}] - (Effect when ON = "${mode.description}", should be removed when OFF)`;
    });
    
    const prefix = modeLines.join('\n') + '\n\n';
    
    const lastMessage = chat[chat.length - 1];
    if (lastMessage && lastMessage.is_user) {
      lastMessage.mes = prefix + lastMessage.mes;
    }
  }
  
  modes.forEach(mode => {
    if (mode.status === 'Activating') {
      mode.status = 'ON';
    } else if (mode.status === 'Deactivating') {
      mode.status = 'OFF';
    }
  });
  
  updateMenuTitle();
  updateModTogToolsMenu();
  
  // Save states after transitions
  saveModeStates();
};

// ===== Settings init =====
async function initSettings() {
  const html = await renderExtensionTemplateAsync("third-party/st-mode-toggles", "settings");
  jQuery(document.getElementById("extensions_settings")).append(html);
  
  console.log("Mode toggle extension initialized with persistence system and custom mode support");
  
  setTimeout(setupEventListeners, 1000);
  
  // Add extension menu button using DOMContentLoaded pattern
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addExtensionMenuButton);
  } else {
    addExtensionMenuButton();
  }
  
  const observer = new MutationObserver((mutations) => {
    for (let mutation of mutations) {
      if (mutation.type === 'childList') {
        for (let node of mutation.addedNodes) {
          if (node.nodeType === 1) {
            if (node.id === 'gg-menu-buttons-container' || 
                node.querySelector('#gg-menu-buttons-container')) {
              if (addMenuButton()) {
                observer.disconnect();
                return;
              }
            }
            // Also try to add extension menu button when extensions menu is added
            if (node.id === 'extensionsMenu' || 
                node.querySelector('#extensionsMenu')) {
              setTimeout(() => {
                addExtensionMenuButton();
              }, 100);
            }
          }
        }
      }
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// ===== Manual functions for testing =====
globalThis.saveModeStates = saveModeStates;
globalThis.loadModeStates = loadModeStates;
globalThis.showAddEditModeDialog = showAddEditModeDialog;
globalThis.exportModes = exportModes;
globalThis.showImportDialog = showImportDialog;
globalThis.addExtensionMenuButton = addExtensionMenuButton;

// ===== Main =====
jQuery(() => {
  initSettings();
});