# Shining Depths - No Offhand Light Function
# This function handles items that provide light but shouldn't be auto-moved to offhand
# Used for items like ender eyes, glow berries, experience bottles, enchanted books

# Remove any existing light blocks at current position
execute positioned ~~1~ run setblock ~ ~ ~ air [] replace light_block

# Apply light based on the item's light level (6 for most no-offhand items)
execute positioned ~~1~ run setblock ~ ~ ~ light_block ["block_light_level"=6]