import {
  Generate,
  extension_prompt_types,
  sendMessageAsUser,
  setExtensionPrompt,
  saveSettingsDebounced,
} from "../../../../script.js";
import { renderExtensionTemplateAsync, extension_settings } from "../../../extensions.js";
import { Popup, POPUP_TYPE, POPUP_RESULT } from "../../../popup.js";

let modes = [
    { name: 'Noir Echo ON', description: "Shadowy, cyberpunk-inspired despair. Everything is rain-slick metal and neon betrayal.", status: "OFF" },

    { name: 'Silent Scream', description: "Psychological horror, isolation, and unseen threats. Fear is slow-burning and deeply personal.", status: "OFF" },

    { name: 'Dialogue Cheese', description: "Purposely bad one-liners (\"I'd flirt, but your ship's hotter than plasma exhaust.\").", status: "OFF" },

    { name: 'Terminal Logic', description: "Unseen AI calculates mortality rates aloud during crises.", status: "OFF" },

    { name: 'Veil of Shadows', description: "Supernatural mystery: half-seen figures, whispering winds, and cursed relics.", status: "OFF" },

    { name: 'Rashomon Effect', description: "Perspectives fracture, each scene retold from conflicting viewpoints.", status: "OFF" },

    { name: 'Gravitas Lock', description: "No quips, no levity. Stakes feel heavier, failures spiral.", status: "OFF" },

    { name: 'Echoed Futures', description: "Brief premonitions overlay scenes with probable outcomes. Ignoring them risks self-fulfilling disasters.", status: "OFF" },

    { name: 'Glitch-Veil', description: "Reality suffers rendering errors: clipping corridors, missing textures, NPCs stutter.", status: "OFF" },

    { name: 'Bureaucracy Ascendant', description: "Permits, stamps, and queue tickets govern everything. Timed forms, bribes, and rubber stamps unlock progress.", status: "OFF" },

    { name: 'Murmur Net', description: "Rumors rewrite reality. What people believe alters entities, locations, and behavior—curate the narrative.", status: "OFF" },

    { name: 'The Sun Is Sick', description: "Day lengths wobble; solar bursts scramble tech and cognition.", status: "OFF" },

    { name: 'Dreamwalk Threshold', description: "Sleep opens a shared dream commons. Actions there echo into waking terrain and relationships.", status: "OFF" },

    { name: 'Blood Debt Ledger', description: "Harm adds entries to a cosmic ledger. Interest accrues as misfortune until settled with acts or offerings.", status: "OFF" },

    { name: 'Knife of Ockham', description: "Simple plans gain mechanical bonuses. Overcomplication earns penalties and fate’s contempt.", status: "OFF" },

    { name: 'Velvet Hour', description: "Lighting shifts to candlelit and velvet hues. Social hubs sprout lounges; flirting and dancing grant temporary buffs and shortcuts through faction gates.", status: "OFF" },

    { name: 'Innuendo Engine', description: "Dialogue tilts suggestive. Double entendres unlock alternate quest solutions and secret vendors who only respond to clever wordplay.", status: "OFF" },

    { name: 'Censor Pixies', description: "Mischievous black bars and mosaic sprites flit about. They transform wardrobe malfunctions into slapstick hazards and can be herded to reveal secrets.", status: "OFF" },

    { name: 'Blush Meter', description: "Characters manifest visible blush gauges. High blush adds social crit chance and awkward fumbles; controlling it becomes a minigame.", status: "OFF" },

    { name: 'Gag Reel Spillover', description: "Outtakes bleed into reality. NPCs break, laugh, reset, and drop items labeled ‘prop’. These props have odd, exploitable rules.", status: "OFF" },

    { name: 'Developer Commentary', description: "Floating dev-notes appear near set pieces, revealing hints, cut content, and togglable challenge modifiers hidden behind commentary badges.", status: "OFF" },

    { name: 'Subtitle Saboteur', description: "Subtitles editorialize, spoil, or contradict the scene. Believing the captions alters encounter stats; ignoring them angers the captions.", status: "OFF" },

    { name: 'Save-Scum Echo', description: "Reality remembers reloads. NPCs feel déjà vu, traps adapt, and your past choices leave faint afterimages you can interrogate.", status: "OFF" },

    { name: 'UI Made Flesh', description: "Health bars, quest markers, and cursors manifest as physical entities. You can hide, steal, or sabotage them to change outcomes.", status: "OFF" },

    { name: 'Narrator Hot Mic', description: "The narrator can hear you—and vice versa. Compliment them for boons, sass them and get roasted debuffs and fourth-wall hazards.", status: "OFF" },

    { name: 'Red Curtain Interlude', description: "A plush theater curtain drops between tense beats. Choose intermission acts—monologue, tango, costume change—to gain tailored buffs.", status: "OFF" },

    { name: 'Chekhov’s Arsenal', description: "Any item prominently introduced in a scene will forcibly matter later. Ignoring it spawns escalating set-piece payoffs.", status: "OFF" },

    { name: 'Bardic Reality', description: "Music is diegetic. Changing the soundtrack alters buffs, enemy patterns, and weather. Conductors become power brokers.", status: "OFF" },

    { name: 'Mirror Law', description: "Mirrors are portals and judges. Step through to inverted spaces; your reflection acts with delayed, sometimes disobedient intent.", status: "OFF" },

    { name: 'Palimpsest Layers', description: "Past versions of locations bleed through. Peel, stitch, or graft map-layers to reveal secrets or erase hazards.", status: "OFF" },

    { name: 'Trial by Gossip', description: "Rumor tribunals form after major beats. Crowd sentiment passes sentence: fines, favors, or forced sidequests.", status: "OFF" },

    { name: 'Mask Census', description: "Everyone chooses a mask that confers a mechanical role. Changing masks rewrites social ties and faction access.", status: "OFF" },

    { name: 'Stormglass Morality', description: "Your choices manifest as weather. Mercy brings soft rain that heals the road; cruelty brews hail that shreds supply lines.", status: "OFF" },

    { name: 'Echo of Names', description: "Naming a thing alters it. Bestow titles to upgrade allies or hex foes; renamed places develop new rules.", status: "OFF" },

    { name: 'Split-Screen Fate', description: "Two timelines run concurrently, visible side-by-side. Swap items, body-block disasters, or let one future bait traps for the other.", status: "OFF" }

];


let modTogToolsMenu;
let lastClickPosition = { x: 0, y: 0 };

function repositionMenu() {
  if (!modTogToolsMenu || modTogToolsMenu.style.display !== 'block') return;
  
  // Position menu so bottom-left corner is at last click location
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
  }
}

function updateModTogToolsMenu() {
  if (!modTogToolsMenu) return;
  
  // Clear existing content
  modTogToolsMenu.innerHTML = '';
  
  // Sort modes: ON and transitioning states first, then OFF
  const sortedModes = [...modes].sort((a, b) => {
    const aActive = a.status === 'ON' || a.status === 'Activating' || a.status === 'Deactivating';
    const bActive = b.status === 'ON' || b.status === 'Activating' || b.status === 'Deactivating';
    
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    return 0; // Maintain original order within groups
  });
  
  // Create buttons for each mode
  sortedModes.forEach(mode => {
    const button = document.createElement('div');
    button.className = 'gg-tools-menu-item interactable';
    button.innerHTML = `<strong>[${mode.name} ${mode.status}]</strong> - ${mode.description}`;
    button.style.cursor = 'pointer';
    button.style.padding = '8px 12px';
    button.style.borderBottom = '1px solid #333';
    button.style.fontSize = 'small';
    
    // Add click handler to toggle mode
    button.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent menu from closing
      toggleModeStatus(mode.name);
      // Reposition menu after content change
      setTimeout(repositionMenu, 0); // Use setTimeout to ensure DOM updates first
    });
    
    // Style based on status
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
      
      // Add click event listener
      menuButton.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Store click position
        lastClickPosition.x = e.clientX;
        lastClickPosition.y = e.clientY;
        
        if (!modTogToolsMenu) {
          createModTogToolsMenu();
        }
        
        // Toggle menu visibility
        if (modTogToolsMenu.style.display === 'block') {
          modTogToolsMenu.style.display = 'none';
        } else {
          // Hide other menus first
          document.querySelectorAll('.gg-tools-menu').forEach(menu => {
            if (menu !== modTogToolsMenu) {
              menu.style.display = 'none';
            }
          });
          
          // Show the menu first to get its dimensions
          modTogToolsMenu.style.display = 'block';
          modTogToolsMenu.style.position = 'fixed';
          modTogToolsMenu.style.zIndex = '9999';
          
          updateModTogToolsMenu();
          repositionMenu();
        }
      });
      
      container.appendChild(menuButton);
      updateMenuTitle();
      return true; // Successfully added
    }
  }
  return false; // Container not found or button already exists
}

function createModTogToolsMenu() {
  modTogToolsMenu = document.createElement('div');
  modTogToolsMenu.id = 'modtog_tools_menu';
  modTogToolsMenu.className = 'gg-tools-menu'; // Use same dropdown menu styling
  modTogToolsMenu.style.display = 'none';
  modTogToolsMenu.style.maxWidth = '400px';
  modTogToolsMenu.style.maxHeight = '300px';
  modTogToolsMenu.style.overflowY = 'auto';
  
  document.body.appendChild(modTogToolsMenu);
  
  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!modTogToolsMenu.contains(e.target) && e.target.id !== 'modtog_menu_button') {
      modTogToolsMenu.style.display = 'none';
    }
  });
}

// ===== Global Prompt Interceptor =====
globalThis.modTogPromptInterceptor = async function(chat, contextSize, abort, type) {
  console.log("Mode toggle prompt interceptor triggered");
  console.log("Chat messages:", chat.length, "Context size:", contextSize, "Type:", type);
  
  // Find modes that are ON or transitioning
  const activeModes = modes.filter(mode => 
    mode.status === 'ON' || mode.status === 'Activating' || mode.status === 'Deactivating'
  );
  
  console.log("Active modes found:", activeModes);
  
  if (activeModes.length > 0 && chat.length > 0) {
    const modeLines = activeModes.map(mode => {
      // Show the target status (what it will be after transition)
      let displayStatus = mode.status;
      if (mode.status === 'Activating') displayStatus = 'ON';
      if (mode.status === 'Deactivating') displayStatus = 'OFF';
      
      return `[${mode.name} ${displayStatus}] - ${mode.description}`;
    });
    
    const prefix = modeLines.join('\n') + '\n\n';
    console.log("Generated prefix:", prefix);
    
    // Find the last user message and prepend the mode information
    const lastMessage = chat[chat.length - 1];
    if (lastMessage && lastMessage.is_user) {
      lastMessage.mes = prefix + lastMessage.mes;
      console.log("Prepended modes to user message:", lastMessage.mes.substring(0, 100) + "...");
    }
  }
  
  // Transition activating/deactivating modes to their final states
  modes.forEach(mode => {
    if (mode.status === 'Activating') {
      console.log(`Transitioning ${mode.name} from Activating to ON`);
      mode.status = 'ON';
    } else if (mode.status === 'Deactivating') {
      console.log(`Transitioning ${mode.name} from Deactivating to OFF`);
      mode.status = 'OFF';
    }
  });
  
  // Update UI after transitions
  updateMenuTitle();
  updateModTogToolsMenu();
  
  console.log("Mode transitions complete");
};

// ===== Settings init =====
async function initSettings() {
  const html = await renderExtensionTemplateAsync("third-party/st-mode-toggles", "settings");
  jQuery(document.getElementById("extensions_settings")).append(html);
  
  console.log("Mode toggle extension initialized with prompt interceptor");
  
  const observer = new MutationObserver((mutations) => {
    for (let mutation of mutations) {
      if (mutation.type === 'childList') {
        for (let node of mutation.addedNodes) {
          if (node.nodeType === 1) { // Element node
            // Check if the added node is our target or contains it
            if (node.id === 'gg-menu-buttons-container' || 
                node.querySelector('#gg-menu-buttons-container')) {
              if (addMenuButton()) {
                observer.disconnect(); // Stop observing once we've added the button
                return;
              }
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

// ===== Main =====
jQuery(() => {
  initSettings();
});