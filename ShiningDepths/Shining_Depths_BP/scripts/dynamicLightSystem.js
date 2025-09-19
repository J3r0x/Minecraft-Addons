import { world, system, EquipmentSlot, EntityEquippableComponent } from "@minecraft/server";

const LIGHT_UPDATE_INTERVAL = 2;

const ENTITY_SEARCH_RADIUS = 64;

const ITEM_PICKUP_DETECTION_RADIUS = 2;

const BLOCK_VIEW_DISTANCE = 8;

const LIGHT_SOURCE_TAGS = Object.freeze({
  HelmetLight: "helmet_light_source",
  MainhandLight: "mainhand_light_source", 
  OffhandLight: "offhand_light_source",
  EntityBurning: "entity_on_fire_light",
});

const LIGHT_LEVEL_FUNCTIONS = new Map([
  [15, "sd_light15"],
  [13, "sd_light13"], 
  [11, "sd_light11"],
  [9, "sd_light9"],
  [6, "sd_light6"],
]);

const SPECIAL_LIGHT_FUNCTIONS = new Map([
  ["sea_pickle", "sd_sea_pickle"],
  ["no_offhand", "sd_no_offhand"],
]);

const HELMET_LIGHT_SOURCE_ITEMS = ["iron_miner_helmet"];

const ITEMS_BY_LIGHT_LEVEL = new Map([
  [15, ["lit_pumpkin", "lava_bucket", "glowstone", "shroomlight", "beacon", "minecraft:lantern", "sea_lantern", ":campfire", "froglight", "end_rod"]],
  [13, ["minecraft:torch", "soul_lantern", "soul_campfire", "candle"]],
  [11, ["crying_obsidian", "soul_torch"]],
  [9, ["fire_charge", "redstone_torch", "ender_chest", "enchanting_table", "catalyst", "totem_of_undying", "nether_star"]],
  [6, ["enchanted_book", "dragon_breath", "ender_eye", "magma", "blaze_rod", "blaze_powder", "glow_ink_sac", "glow_berries", "glowstone_dust", "experience_bottle"]],
]);

const AUTO_OFFHAND_COMPATIBLE_ITEMS = createNormalizedItemSet([
  "dragon_breath", "lit_pumpkin", "lava_bucket", "glowstone", "shroomlight", "beacon",
  "lantern", "sea_lantern", "campfire", "froglight", "end_rod", "torch", "soul_lantern",
  "soul_campfire", "candle", "crying_obsidian", "soul_torch", "fire_charge", "redstone_torch",
  "ender_chest", "enchanting_table", "catalyst", "totem_of_undying", "nether_star", "magma",
  "blaze_rod", "blaze_powder", "glow_ink_sac", "glowstone_dust", "sea_pickle",
]);

const trackedLightEmittingGroundItems = new Set();

export function initializeDynamicLightSystem() {
  system.runInterval(processAllPlayerLightUpdates, LIGHT_UPDATE_INTERVAL);

  world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    handleLightEmittingEntityDeath(deadEntity);
  });

  world.afterEvents.itemUse.subscribe((event) => {
    handleLightItemAutoOffhand(event);
  });

  world.afterEvents.entitySpawn.subscribe(({ entity }) => {
    registerLightEmittingGroundItem(entity);
  });

  world.beforeEvents.entityRemove.subscribe(({ removedEntity }) => {
    cleanupRemovedLightEmittingItem(removedEntity);
  });
}

function processAllPlayerLightUpdates() {
  for (const player of world.getPlayers()) {
    processPlayerEquipmentLighting(player);
    processNearbyAmbientLightSources(player);
  }
}

function processPlayerEquipmentLighting(player) {
  const equipment = player.getComponent("minecraft:equippable");
  if (!equipment) return;

  const helmetItem = equipment.getEquipment(EquipmentSlot.Head);
  const mainhandItem = equipment.getEquipment(EquipmentSlot.Mainhand);
  const offhandItem = equipment.getEquipment(EquipmentSlot.Offhand);

  if (processHelmetLightSource(player, helmetItem)) {
    removeAllHandLightTags(player);
    return;
  }

  processHandHeldLightSources(player, mainhandItem, offhandItem);
}

function processHelmetLightSource(player, helmetItem) {
  if (helmetItem && isHelmetLightEmitter(helmetItem.typeId)) {
    applyLightSourceTag(player, LIGHT_SOURCE_TAGS.HelmetLight, true);
    activateLightFunction(player, { level: 15 });
    return true;
  }

  if (applyLightSourceTag(player, LIGHT_SOURCE_TAGS.HelmetLight, false)) {
    deactivateAllLights(player);
  }
  return false;
}

function processHandHeldLightSources(player, mainhandItem, offhandItem) {
  const mainhandLightInfo = extractLightInfoFromItem(mainhandItem?.typeId);
  const offhandLightInfo = extractLightInfoFromItem(offhandItem?.typeId);

  if (offhandLightInfo) {
    applyLightSourceTag(player, LIGHT_SOURCE_TAGS.OffhandLight, true);
    removeLightSourceTag(player, LIGHT_SOURCE_TAGS.MainhandLight);
    activateLightFunction(player, offhandLightInfo);
    return;
  }

  if (mainhandLightInfo) {
    applyLightSourceTag(player, LIGHT_SOURCE_TAGS.MainhandLight, true);
    removeLightSourceTag(player, LIGHT_SOURCE_TAGS.OffhandLight);
    activateLightFunction(player, mainhandLightInfo);
    return;
  }

  const removedMainhandLight = removeLightSourceTag(player, LIGHT_SOURCE_TAGS.MainhandLight);
  const removedOffhandLight = removeLightSourceTag(player, LIGHT_SOURCE_TAGS.OffhandLight);
  
  if ((removedMainhandLight || removedOffhandLight) && !player.hasTag(LIGHT_SOURCE_TAGS.HelmetLight)) {
    deactivateAllLights(player);
  }
}

function processNearbyAmbientLightSources(player) {
  const nearbyEntities = player.dimension?.getEntities({
    location: player.location,
    maxDistance: ENTITY_SEARCH_RADIUS,
  });
  
  if (!nearbyEntities) return;

  for (const entity of nearbyEntities) {
    if (!entity?.isValid) continue;

    processDroppedItemLighting(entity);
    processGlowingMobLighting(entity);
  }
}

function processDroppedItemLighting(itemEntity) {
  const itemComponent = itemEntity.getComponent("minecraft:item");
  const itemTypeId = itemComponent?.itemStack?.typeId;
  if (!itemTypeId) return;

  const lightInfo = extractLightInfoFromItem(itemTypeId);
  if (lightInfo) {
    activateLightFunction(itemEntity, lightInfo, "~~~");
  }
}

function processGlowingMobLighting(mobEntity) {
  const isCurrentlyOnFire = mobEntity.getComponent("minecraft:onfire");
  const mobTypeId = mobEntity.typeId;
  let shouldEmitLight = false;

  if (isCurrentlyOnFire || mobTypeId === "minecraft:blaze") {
    activateLightFunction(mobEntity, { level: 11 });
    shouldEmitLight = true;
  }

  if (mobTypeId === "minecraft:magma_cube") {
    activateLightFunction(mobEntity, { level: 9 });
    shouldEmitLight = true;
  }

  if (mobTypeId === "minecraft:glow_squid") {
    activateLightFunction(mobEntity, { level: 13, special: "sea_pickle" });
    shouldEmitLight = true;
  }

  if (shouldEmitLight) {
    applyLightSourceTag(mobEntity, LIGHT_SOURCE_TAGS.EntityBurning, true);
  } else if (removeLightSourceTag(mobEntity, LIGHT_SOURCE_TAGS.EntityBurning)) {
    deactivateAllLights(mobEntity);
  }
}

function handleLightEmittingEntityDeath(deadEntity) {
  if (!deadEntity) return;

  const wasLightEmittingMob = deadEntity.getComponent("minecraft:onfire") ||
    deadEntity.typeId === "minecraft:blaze" ||
    deadEntity.typeId === "minecraft:magma_cube" ||
    deadEntity.typeId === "minecraft:glow_squid";

  if (wasLightEmittingMob) {
    executeCommandSafely(deadEntity, "execute as @s positioned ~~1~ run function sd_no_light");
  }
}

function handleLightItemAutoOffhand(event) {
  const { itemStack, source } = event;
  if (!itemStack || !source?.isValid) return;

  const playerEquipment = source.getComponent(EntityEquippableComponent.componentId);
  if (!playerEquipment) return;

  if (playerEquipment.getEquipment(EquipmentSlot.Offhand)) return;

  const targetBlock = source.getBlockFromViewDirection({ maxDistance: BLOCK_VIEW_DISTANCE });
  if (targetBlock) return;

  if (!AUTO_OFFHAND_COMPATIBLE_ITEMS.has(itemStack.typeId)) return;

  executeCommandSafely(
    source,
    `replaceitem entity @s slot.weapon.offhand 0 ${itemStack.typeId} ${itemStack.amount}`
  );
  playerEquipment.setEquipment(EquipmentSlot.Mainhand, undefined);
}

function registerLightEmittingGroundItem(itemEntity) {
  if (!itemEntity?.isValid) return;

  const itemComponent = itemEntity.getComponent("item");
  const itemStack = itemComponent?.itemStack;
  if (!itemStack || !isLightEmittingItem(itemStack.typeId)) return;

  trackedLightEmittingGroundItems.add(itemEntity);
}

function cleanupRemovedLightEmittingItem(removedEntity) {
  if (!removedEntity) return;

  const wasTrackedItem = trackedLightEmittingGroundItems.delete(removedEntity);
  if (!wasTrackedItem || !removedEntity?.isValid) return;

  const itemComponent = removedEntity.getComponent("item");
  const itemStack = itemComponent?.itemStack;
  if (!itemStack || !isLightEmittingItem(itemStack.typeId)) return;

  const itemDimension = removedEntity.dimension;
  const itemLocation = removedEntity.location;
  if (!itemDimension || !itemLocation) return;

  const nearbyPlayers = itemDimension.getEntities({
    location: itemLocation,
    maxDistance: ITEM_PICKUP_DETECTION_RADIUS,
    type: "player",
  });

  for (const player of nearbyPlayers) {
    if (playerHasItemInInventory(player, itemStack.typeId)) {
      if (!hasAnyHandLightTag(player)) {
        system.run(() => {
          executeCommandSafely(player, "execute positioned ~~1~ run function sd_no_light");
        });
      }
      return;
    }
  }

  system.run(() => {
    const cleanupX = Math.floor(itemLocation.x);
    const cleanupY = Math.floor(itemLocation.y) + 1;
    const cleanupZ = Math.floor(itemLocation.z);
    executeCommandSafely(
      itemDimension,
      `execute positioned ${cleanupX} ${cleanupY} ${cleanupZ} run function sd_no_light`
    );
  });
}
function extractLightInfoFromItem(itemTypeId) {
  if (!itemTypeId) return null;

  if (itemTypeId.includes("sea_pickle")) {
    return { level: 13, special: "sea_pickle" };
  }

  if (itemTypeId.includes("ender_eye") || itemTypeId.includes("glow_berries") || 
      itemTypeId.includes("experience_bottle") || itemTypeId.includes("enchanted_book")) {
    return { level: 6, special: "no_offhand" };
  }

  if (itemTypeId.includes("glowstone_dust")) {
    return { level: 6 };
  }

  for (const [lightLevel, itemKeywords] of ITEMS_BY_LIGHT_LEVEL) {
    for (const keyword of itemKeywords) {
      if (itemTypeId.includes(keyword)) {
        return { level: lightLevel };
      }
    }
  }
  return null;
}

function isLightEmittingItem(itemTypeId) {
  return Boolean(extractLightInfoFromItem(itemTypeId));
}

function activateLightFunction(targetEntity, lightInfo, positionOffset = "~~1~") {
  const lightFunctionName = resolveLightFunctionName(lightInfo);
  if (!lightFunctionName) return;

  executeCommandSafely(targetEntity, `execute as @s positioned ${positionOffset} run function ${lightFunctionName}`);
}

function deactivateAllLights(targetEntity) {
  executeCommandSafely(targetEntity, "function sd_no_light");
}

function resolveLightFunctionName(lightInfo) {
  if (!lightInfo) return null;

  if (lightInfo.special && SPECIAL_LIGHT_FUNCTIONS.has(lightInfo.special)) {
    return SPECIAL_LIGHT_FUNCTIONS.get(lightInfo.special);
  }

  return LIGHT_LEVEL_FUNCTIONS.get(lightInfo.level) ?? null;
}

function applyLightSourceTag(targetEntity, tagName, shouldApply) {
  if (!targetEntity || !tagName) return false;

  const currentlyHasTag = targetEntity.hasTag(tagName);
  
  if (shouldApply && !currentlyHasTag) {
    targetEntity.addTag(tagName);
    return true;
  }

  if (!shouldApply && currentlyHasTag) {
    targetEntity.removeTag(tagName);
    return true;
  }

  return false;
}

function removeLightSourceTag(targetEntity, tagName) {
  return applyLightSourceTag(targetEntity, tagName, false);
}

function removeAllHandLightTags(player) {
  removeLightSourceTag(player, LIGHT_SOURCE_TAGS.MainhandLight);
  removeLightSourceTag(player, LIGHT_SOURCE_TAGS.OffhandLight);
}

function hasAnyHandLightTag(player) {
  return player.hasTag(LIGHT_SOURCE_TAGS.MainhandLight) || 
         player.hasTag(LIGHT_SOURCE_TAGS.OffhandLight);
}

function isHelmetLightEmitter(itemTypeId) {
  return HELMET_LIGHT_SOURCE_ITEMS.some((keyword) => itemTypeId?.includes(keyword));
}

function playerHasItemInInventory(player, itemTypeId) {
  const playerInventory = player.getComponent("inventory")?.container;
  if (!playerInventory) return false;

  for (let slotIndex = 0; slotIndex < playerInventory.size; slotIndex++) {
    const slotItem = playerInventory.getItem(slotIndex);
    if (slotItem && slotItem.typeId === itemTypeId) {
      return true;
    }
  }
  return false;
}

function executeCommandSafely(commandTarget, commandString) {
  if (!commandTarget) return;
  commandTarget.runCommand(commandString);
}

function createNormalizedItemSet(rawItemIds) {
  const normalizedSet = new Set();
  for (const rawId of rawItemIds) {
    const normalizedId = normalizeMinecraftItemId(rawId);
    if (normalizedId) normalizedSet.add(normalizedId);
  }
  return normalizedSet;
}

function normalizeMinecraftItemId(rawItemId) {
  if (!rawItemId) return null;
  if (rawItemId.startsWith("minecraft:")) return rawItemId;
  if (rawItemId.startsWith(":")) return `minecraft${rawItemId}`;
  return `minecraft:${rawItemId}`;
}
