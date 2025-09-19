import { initializeDynamicLightSystem } from "./dynamicLightSystem.js";
import { initializeMinersHammer } from "./minersHammer.js";

/**
 * Main initialization function that starts all add-on systems
 */
function initializeShiningDepthsAddon() {
  initializeDynamicLightSystem();
  initializeMinersHammer();
}

initializeShiningDepthsAddon();
