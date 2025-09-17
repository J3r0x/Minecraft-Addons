import { world, system, Player, EquipmentSlot, EntityDamageCause } from "@minecraft/server";

// ============================================================================
// CONFIG
// ============================================================================
const CONFIG = {
    SLIME_SLING: {
        ID: "jrx:slime_sling",
        LAUNCH_FORCE: 16.0,
        VERTICAL_BOOST: 3.5,
        COOLDOWN_TICKS: 15
    },
    SLIME_BOOTS: {
        ID: "jrx:slime_boots",
        BOUNCE_HEIGHT_RATIO: 0.33,
        BOUNCE_DECAY_RATE: 0.5,
        MAX_BOUNCE_HEIGHT: 8.0,
        MIN_FALL_HEIGHT: 2.0
    },
    SLIME_GOLEM: {
        ID: "jrx:slimegolem",
        KNOCKBACK_HORIZONTAL: 6.0,
        KNOCKBACK_VERTICAL: 0.3
    },
    DEBUG: false,
    INTERVALS: {
        MAIN_LOOP: 2,           
        ENCHANT_CHECK: 60,
        CLEANUP: 200
    }
};

// ============================================================================
// DATA MANAGEMENT
// ============================================================================
class PlayerDataManager {
    constructor() {
        this.cooldowns = new Map();
        this.fallData = new Map();
        this.bounceData = new Map();
        this.slingData = new Map();
        this.sneakCancel = new Map();
        this.enchantTracking = new Map();
    }

    clearPlayerData(playerId) {
        this.cooldowns.delete(playerId);
        this.fallData.delete(playerId);
        this.bounceData.delete(playerId);
        this.slingData.delete(playerId);
        this.sneakCancel.delete(playerId);
        
        const keysToDelete = [];
        for (const [key] of this.enchantTracking.entries()) {
            if (key.startsWith(`${playerId}_`)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.enchantTracking.delete(key));
    }

    isOnCooldown(playerId) {
        const currentTick = system.currentTick;
        const lastUseTick = this.cooldowns.get(playerId) || 0;
        return (currentTick - lastUseTick) < CONFIG.SLIME_SLING.COOLDOWN_TICKS;
    }

    setCooldown(playerId) {
        this.cooldowns.set(playerId, system.currentTick);
    }

    cleanupOldData() {
        const currentTime = system.currentTick;
        for (const [playerId, useTime] of this.slingData.entries()) {
            if (currentTime - useTime > CONFIG.INTERVALS.CLEANUP) {
                this.slingData.delete(playerId);
            }
        }
    }
}

const playerDataManager = new PlayerDataManager();

// ============================================================================
// UTILS
// ============================================================================
const Utils = {
    equipmentCache: new Map(),
    
    hasSlimeBoots(player) {
        const cacheKey = `${player.id}_boots`;
        const cached = this.equipmentCache.get(cacheKey);
        
        if (cached && (system.currentTick - cached.timestamp) < 5) {
            return cached.value;
        }
        
        try {
            const equipment = player.getComponent("equippable");
            if (!equipment) return false;
            
            const boots = equipment.getEquipment(EquipmentSlot.Feet);
            const hasBoots = boots && boots.typeId === CONFIG.SLIME_BOOTS.ID;
            
            this.equipmentCache.set(cacheKey, {
                value: hasBoots,
                timestamp: system.currentTick
            });
            
            return hasBoots;
        } catch (error) {
            return false;
        }
    },

    isOnGround(player) {
        try {
            return !player.isFlying && !player.isGliding && player.isOnGround;
        } catch (error) {
            return false;
        }
    },

    isInLiquid(player) {
        try {
            const location = player.location;
            const block = player.dimension.getBlock({
                x: Math.floor(location.x),
                y: Math.floor(location.y),
                z: Math.floor(location.z)
            });
            
            return block && (
                block.typeId === "minecraft:water" || 
                block.typeId === "minecraft:lava" ||
                block.typeId === "minecraft:flowing_water" ||
                block.typeId === "minecraft:flowing_lava"
            );
        } catch (error) {
            return false;
        }
    },

    cleanCache() {
        const currentTick = system.currentTick;
        for (const [key, data] of this.equipmentCache.entries()) {
            if (currentTick - data.timestamp > 20) {
                this.equipmentCache.delete(key);
            }
        }
    }
};

// ============================================================================
// SLIME SLING SYSTEM
// ============================================================================
function applySlimeLaunch(player) {
    try {
        const viewDirection = player.getViewDirection();
        const knockbackForce = CONFIG.SLIME_SLING.LAUNCH_FORCE;
        
        if (typeof player.applyKnockback === "function") {
            const horizontalForce = {
                x: -viewDirection.x * knockbackForce,
                z: -viewDirection.z * knockbackForce
            };
            const verticalStrength = Math.max(0.4, CONFIG.SLIME_SLING.VERTICAL_BOOST / 2.5);
            
            player.applyKnockback(horizontalForce, verticalStrength);
        }
        
        player.runCommand(`effect @s speed 4 15 true`);

        try {
            player.runCommand(`particle minecraft:slime_particle ~ ~1.2 ~`);
            player.playSound("mob.slime.jump", { volume: 1.0, pitch: 1.2 });
        } catch (e) {}
        
        if (CONFIG.DEBUG) {
            player.sendMessage(`§aSling fired!`);
        }
        
    } catch (error) {
        player.sendMessage(`§cSlime Sling error: ${error.message}`);
    }
}

// ============================================================================
// SLIME BOOTS BOUNCE SYSTEM
// ============================================================================
function calculateBounceHeight(originalHeight, bounceCount) {
    const decayFactor = Math.pow(CONFIG.SLIME_BOOTS.BOUNCE_DECAY_RATE, bounceCount);
    const calculatedHeight = originalHeight * CONFIG.SLIME_BOOTS.BOUNCE_HEIGHT_RATIO * decayFactor;
    return Math.min(calculatedHeight, CONFIG.SLIME_BOOTS.MAX_BOUNCE_HEIGHT);
}

function applySlimeBounce(player, bounceHeight, horizontalMomentum = { x: 0, z: 0 }) {
    try {
        const bounceStrength = Math.min(bounceHeight * 0.6 + 0.2, 4.0);
        const horizontalForce = {
            x: horizontalMomentum.x * 0.7,
            z: horizontalMomentum.z * 0.7
        };
        
        if (typeof player.applyKnockback === "function") {
            player.applyKnockback(horizontalForce, bounceStrength);
        } else {
            player.runCommand(`effect @s jump_boost 1 ${Math.floor(bounceStrength)} true`);
        }
        
        try {
            player.runCommand(`particle minecraft:slime_particle ~ ~0.1 ~`);
            player.playSound("mob.slime.big", { volume: 0.6, pitch: 1.2 });
        } catch (e) {}
        
    } catch (error) {}
}

// ============================================================================
// MAIN PROCESSING
// ============================================================================
function processPlayerTick(player) {
    const playerId = player.id;
    
    if (Utils.hasSlimeBoots(player)) {
        processSlimeBoots(player);
        applyPreventiveFallProtection(player);
    } else {
        playerDataManager.fallData.delete(playerId);
        playerDataManager.bounceData.delete(playerId);
        playerDataManager.sneakCancel.delete(playerId);
    }
}

function processSlimeBoots(player) {
    const playerId = player.id;
    const currentY = player.location.y;
    const playerData = playerDataManager.fallData.get(playerId) || { 
        lastY: currentY, 
        highestY: currentY, 
        wasOnGround: true,
        isBouncing: false
    };
    
    const onGround = Utils.isOnGround(player);
    const velocity = player.getVelocity();
    
    if (!onGround) {
        if (player.isSneaking) {
            playerDataManager.sneakCancel.set(playerId, true);
        }
        
        if (velocity.y < -0.1) {
            if (!playerData.isBouncing && currentY > playerData.highestY) {
                playerData.highestY = currentY;
            }
            playerData.wasOnGround = false;
        } else if (velocity.y > 0.1 && playerData.isBouncing) {
            if (currentY > playerData.highestY) {
                playerData.highestY = currentY;
            }
        }
    } else if (onGround && !playerData.wasOnGround) {
        handleLanding(player, playerData, velocity);
    } else if (onGround && !player.isSneaking) {
        playerDataManager.sneakCancel.delete(playerId);
    }
    
    playerData.lastY = currentY;
    playerDataManager.fallData.set(playerId, playerData);
}

function handleLanding(player, playerData, velocity) {
    const playerId = player.id;
    const fallDistance = playerData.highestY - player.location.y;
    const bounceData = playerDataManager.bounceData.get(playerId) || { 
        consecutiveBounces: 0, 
        lastBounceTime: 0, 
        originalFallHeight: 0
    };
    
    const currentTime = system.currentTick;
    const isFirstFall = !playerData.isBouncing || (currentTime - bounceData.lastBounceTime > 80);
    
    if (isFirstFall) {
        bounceData.originalFallHeight = fallDistance;
        bounceData.consecutiveBounces = 0;
    }
    
    const inLiquid = Utils.isInLiquid(player);
    const wasSneaking = playerDataManager.sneakCancel.get(playerId) || false;
    
    if (fallDistance >= CONFIG.SLIME_BOOTS.MIN_FALL_HEIGHT && !inLiquid && !wasSneaking) {
        const bounceHeight = calculateBounceHeight(bounceData.originalFallHeight, bounceData.consecutiveBounces);
        
        if (bounceHeight > 0.5) {
            const horizontalMomentum = {
                x: velocity.x * 0.5,
                z: velocity.z * 0.5
            };
            
            applySlimeBounce(player, bounceHeight, horizontalMomentum);
            
            bounceData.consecutiveBounces++;
            bounceData.lastBounceTime = currentTime;
            playerData.isBouncing = true;
        } else {
            playerData.isBouncing = false;
            bounceData.consecutiveBounces = 0;
        }
        
        playerDataManager.bounceData.set(playerId, bounceData);
    } else {
        playerData.isBouncing = false;
        if (wasSneaking || inLiquid) {
            bounceData.consecutiveBounces = 0;
            playerDataManager.bounceData.set(playerId, bounceData);
        }
    }
    
    playerData.highestY = player.location.y;
    playerData.wasOnGround = true;
    playerDataManager.sneakCancel.delete(playerId);
}

// ============================================================================
// FALL PROTECTION SYSTEM - PREVENTIVE + HEALING
// ============================================================================
function applyPreventiveFallProtection(player) {
    try {
        const velocity = player.getVelocity();
        
        // Si está cayendo muy rápido, aplicar resistencia preventiva
        if (velocity.y < -1.2) { // Cayendo muy rápido
            try {
                // Aplicar resistencia máxima para prevenir instakill
                player.runCommand(`effect @s resistance 1 255 true`);
                
                if (CONFIG.DEBUG) {
                    player.sendMessage(`§bSlime Boots: Applied resistance (falling fast: ${velocity.y.toFixed(2)})`);
                }
            } catch (e) {}
        } else if (velocity.y >= 0 && Utils.isOnGround(player)) {
            // Quitar resistencia cuando esté seguro en el suelo
            try {
                player.runCommand(`effect @s resistance 0`);
            } catch (e) {}
        }
    } catch (e) {}
}
world.afterEvents.entityHurt.subscribe((eventData) => {
    const { damageSource, hurtEntity, damage } = eventData;

    // Solo jugadores con daño de caída
    if (hurtEntity.typeId !== "minecraft:player") return;
    if (damageSource?.cause !== "fall") return;

    // ¿Tiene slime boots equipadas?
    const equippable = hurtEntity.getComponent("minecraft:equippable") ?? 
                       hurtEntity.getComponent("equippable");
    if (!equippable) return;

    const feetItem = equippable.getEquipment(EquipmentSlot.Feet);
    if (feetItem && feetItem.typeId === CONFIG.SLIME_BOOTS.ID) {
        // Curar el daño instantáneamente - sin delay
        system.runTimeout(() => {
            try {
                const healthComponent = hurtEntity.getComponent("minecraft:health");
                if (healthComponent) {
                    const newHealth = Math.min(
                        healthComponent.currentValue + damage, 
                        healthComponent.effectiveMax
                    );
                    healthComponent.setCurrentValue(newHealth);
                    
                    if (CONFIG.DEBUG && hurtEntity instanceof Player) {
                        hurtEntity.sendMessage(`§aSlime Boots: Instantly healed ${damage} fall damage!`);
                    }
                }
            } catch (e) {
                // Silently ignore healing errors
            }
        }, 0); // 0 ticks = siguiente tick
    }
});

// ============================================================================
// MAIN LOOP
// ============================================================================
let tickCounter = 0;

system.runInterval(() => {
    tickCounter++;
    
    try {
        const players = world.getPlayers();
        
        for (const player of players) {
            processPlayerTick(player);
        }
        
        if (tickCounter % CONFIG.INTERVALS.CLEANUP === 0) {
            playerDataManager.cleanupOldData();
            Utils.cleanCache();
        }
        
    } catch (e) {}
}, CONFIG.INTERVALS.MAIN_LOOP);

// ============================================================================
// EVENT HANDLERS
// ============================================================================

world.afterEvents.itemUse.subscribe(eventData => {
    const { itemStack, source } = eventData;

    if (itemStack.typeId === CONFIG.SLIME_SLING.ID && source instanceof Player) {
        if (!Utils.isOnGround(source)) {
            source.sendMessage("§cYou need to be standing on the ground to use the Sling.");
            return;
        }
        
        if (playerDataManager.isOnCooldown(source.id)) {
            source.sendMessage("§cThe Sling needs a moment to recharge.");
            return;
        }

        applySlimeLaunch(source);
        playerDataManager.slingData.set(source.id, system.currentTick);
        playerDataManager.setCooldown(source.id);
    }
});

world.afterEvents.entityHurt.subscribe(eventData => {
    try {
        const { hurtEntity, damageSource, damage } = eventData;
        
        if (damageSource?.damagingEntity?.typeId === CONFIG.SLIME_GOLEM.ID) {
            const golem = damageSource.damagingEntity;
            const target = hurtEntity;
            
            system.runTimeout(() => {
                try {
                    const golemPos = golem.location;
                    const targetPos = target.location;
                    
                    const dx = targetPos.x - golemPos.x;
                    const dz = targetPos.z - golemPos.z;
                    const distance = Math.sqrt(dx * dx + dz * dz);
                    
                    if (distance > 0 && typeof target.applyKnockback === "function") {
                        const normalizedX = dx / distance;
                        const normalizedZ = dz / distance;
                        
                        target.applyKnockback({
                            x: normalizedX * CONFIG.SLIME_GOLEM.KNOCKBACK_HORIZONTAL,
                            z: normalizedZ * CONFIG.SLIME_GOLEM.KNOCKBACK_HORIZONTAL
                        }, CONFIG.SLIME_GOLEM.KNOCKBACK_VERTICAL);
                    }
                } catch (e) {}
            }, 1);
        }
        

        
    } catch (e) {}
});

world.afterEvents.playerLeave.subscribe(eventData => {
    playerDataManager.clearPlayerData(eventData.playerId);
    Utils.equipmentCache.delete(`${eventData.playerId}_boots`);
});