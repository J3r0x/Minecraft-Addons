import { world, system, Direction, EquipmentSlot, ItemComponentTypes } from "@minecraft/server";

const MINERS_HAMMER_ITEM_ID = "jrx:miners_hammer";

const VERTICAL_VIEW_ANGLE_THRESHOLD = 0.55;

const INDESTRUCTIBLE_BLOCK_TYPES = new Set([
  "minecraft:air",
  "minecraft:bedrock", 
  "minecraft:void_air",
  "minecraft:barrier",
  "minecraft:light",
  "minecraft:light_block",
  "minecraft:water",
  "minecraft:flowing_water",
  "minecraft:lava",
  "minecraft:flowing_lava",
]);

const BLOCK_FACE_TO_MINING_PLANE = new Map([
  [Direction.Up, ["x", "z"]],      // Mining horizontally when looking up/down
  [Direction.Down, ["x", "z"]],
  [Direction.North, ["x", "y"]],   // Mining vertically when looking north/south
  [Direction.South, ["x", "y"]],
  [Direction.East, ["y", "z"]],    // Mining vertically when looking east/west
  [Direction.West, ["y", "z"]],
]);

const DEFAULT_MINING_AXES = ["x", "z"];

export function initializeMinersHammer() {
  world.afterEvents.playerBreakBlock.subscribe((event) => {
    system.run(() => processMinersHammerBlockBreak(event));
  });
}

function processMinersHammerBlockBreak(breakEvent) {
  const { player, block, blockFace, dimension, itemStack } = breakEvent;
  
  if (!isValidBreakEvent(player, block, dimension)) return;

  const playerEquipment = player.getComponent("minecraft:equippable");
  const usedTool = itemStack ?? playerEquipment?.getEquipment(EquipmentSlot.Mainhand);
  if (!isMinersHammer(usedTool)) return;

  const miningAxes = determineMiningPlaneAxes(player, blockFace) ?? DEFAULT_MINING_AXES;
  const miningPattern = generateAreaMiningPattern(miningAxes);
  const originalBlockPosition = block.location;

  const destroyedBlockCount = executeAreaMining(dimension, originalBlockPosition, miningPattern);

  if (destroyedBlockCount > 0) {
    applyHammerDurabilityDamage(player, usedTool, destroyedBlockCount + 1);
  }
}

function isValidBreakEvent(player, block, dimension) {
  return player?.isValid && block && dimension;
}

function isMinersHammer(itemStack) {
  return itemStack && itemStack.typeId === MINERS_HAMMER_ITEM_ID;
}

function determineMiningPlaneAxes(player, blockFace) {

  const viewBasedAxes = calculateAxesFromPlayerView(player);
  if (viewBasedAxes) return viewBasedAxes;

  const faceBasedAxes = calculateAxesFromBlockFace(blockFace);
  if (faceBasedAxes) return faceBasedAxes;

  return null;
}

function calculateAxesFromPlayerView(player) {
  const playerViewDirection = getPlayerViewDirectionSafely(player);
  if (!playerViewDirection) return null;

  const absX = Math.abs(playerViewDirection.x);
  const absY = Math.abs(playerViewDirection.y);
  const absZ = Math.abs(playerViewDirection.z);

  if (absY >= VERTICAL_VIEW_ANGLE_THRESHOLD && absY >= absX && absY >= absZ) {
    return ["x", "z"];
  }

  if (absX >= absZ) {
    return ["y", "z"];
  }

  return ["x", "y"];
}

function calculateAxesFromBlockFace(blockFace) {
  if (typeof blockFace === "number" && BLOCK_FACE_TO_MINING_PLANE.has(blockFace)) {
    return BLOCK_FACE_TO_MINING_PLANE.get(blockFace);
  }

  if (typeof blockFace === "string") {
    const normalizedFace = blockFace.toLowerCase();
    switch (normalizedFace) {
      case "up":
      case "down":
        return ["x", "z"];
      case "north":
      case "south":
        return ["x", "y"];
      case "east":
      case "west":
        return ["y", "z"];
    }
  }

  return null;
}

function getPlayerViewDirectionSafely(player) {
  if (!player?.isValid) return null;
  try {
    return player.getViewDirection();
  } catch (error) {
    return null;
  }
}

function generateAreaMiningPattern([primaryAxis, secondaryAxis]) {
  const miningOffsets = [];
  
  for (let primaryOffset = -1; primaryOffset <= 1; primaryOffset++) {
    for (let secondaryOffset = -1; secondaryOffset <= 1; secondaryOffset++) {
      const positionOffset = { x: 0, y: 0, z: 0 };
      positionOffset[primaryAxis] = primaryOffset;
      positionOffset[secondaryAxis] = secondaryOffset;
      miningOffsets.push(positionOffset);
    }
  }
  
  return miningOffsets;
}

function executeAreaMining(targetDimension, centerPosition, miningPattern) {
  let totalBlocksDestroyed = 0;

  for (const positionOffset of miningPattern) {
    if (isZeroOffset(positionOffset)) continue;

    const targetBlockPosition = {
      x: centerPosition.x + positionOffset.x,
      y: centerPosition.y + positionOffset.y,
      z: centerPosition.z + positionOffset.z,
    };

    const targetBlock = getBlockSafely(targetDimension, targetBlockPosition);
    if (!targetBlock || !canMinersHammerBreakBlock(targetBlock)) continue;

    if (destroyBlockWithDrops(targetDimension, targetBlock)) {
      totalBlocksDestroyed++;
    }
  }

  return totalBlocksDestroyed;
}

function isZeroOffset(offset) {
  return !offset.x && !offset.y && !offset.z;
}

function getBlockSafely(dimension, position) {
  try {
    return dimension.getBlock(position);
  } catch (error) {
    return null;
  }
}

function canMinersHammerBreakBlock(targetBlock) {
  const blockTypeId = targetBlock.typeId;
  
  if (!blockTypeId || INDESTRUCTIBLE_BLOCK_TYPES.has(blockTypeId)) {
    return false;
  }

  if (targetBlock.hasComponent && targetBlock.hasComponent("inventory")) {
    return false;
  }

  return true;
}

function destroyBlockWithDrops(dimension, blockToDestroy) {
  const { x, y, z } = blockToDestroy.location;
  return executeCommandSafely(
    dimension,
    `execute positioned ${x} ${y} ${z} run setblock ~ ~ ~ air destroy`
  );
}

function executeCommandSafely(commandTarget, commandString) {
  if (!commandTarget) return false;
  try {
    commandTarget.runCommand(commandString);
    return true;
  } catch (error) {
    return false;
  }
}

function applyHammerDurabilityDamage(player, hammerItem, totalDamageAmount) {
  if (!isValidDurabilityInput(player, hammerItem)) return;

  try {
    const playerEquipment = player.getComponent("minecraft:equippable");
    if (!playerEquipment) return;

    const hammerDurability = hammerItem.getComponent(ItemComponentTypes.Durability);
    if (!hammerDurability) return;

    const updatedDamage = calculateNewDurabilityDamage(hammerDurability, totalDamageAmount);
    
    if (isHammerCompletelyDamaged(updatedDamage, hammerDurability.maxDurability)) {
      handleHammerDestruction(player, playerEquipment);
    } else {
      updateHammerDurability(playerEquipment, hammerItem, hammerDurability, updatedDamage);
    }
  } catch (error) {
    console.warn("[MinersHammer] Failed to apply durability damage:", error);
  }
}

function isValidDurabilityInput(player, hammerItem) {
  return player?.isValid && hammerItem;
}

function calculateNewDurabilityDamage(durabilityComponent, additionalDamage) {
  return Math.min(
    durabilityComponent.damage + additionalDamage,
    durabilityComponent.maxDurability
  );
}

function isHammerCompletelyDamaged(currentDamage, maxDurability) {
  return currentDamage >= maxDurability;
}

function handleHammerDestruction(player, playerEquipment) {

  playerEquipment.setEquipment(EquipmentSlot.Mainhand, undefined);
  
  playHammerBreakEffects(player);
}

function updateHammerDurability(playerEquipment, hammerItem, durabilityComponent, newDamageValue) {
  durabilityComponent.damage = newDamageValue;
  playerEquipment.setEquipment(EquipmentSlot.Mainhand, hammerItem);
}

function playHammerBreakEffects(player) {
    const playerDimension = player.dimension;
    const playerLocation = player.location;
    
    executeCommandSafely(
      playerDimension,
      `playsound random.break @a[r=10] ~ ~ ~ 1.0 1.0`
    );
    
    executeCommandSafely(
      playerDimension,
      `particle minecraft:item_break_particle ${playerLocation.x} ${playerLocation.y + 1} ${playerLocation.z}`
    );
}