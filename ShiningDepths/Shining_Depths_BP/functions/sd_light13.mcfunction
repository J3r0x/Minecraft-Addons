fill ~~~ ~ ~1 ~ light_block ["block_light_level"=13] replace air
fill ~4 ~2 ~4 ~-4 ~4 ~-4 air [] replace light_block ["block_light_level"=13]
fill ~4 ~-1 ~4 ~-4 ~-2 ~-4 air [] replace light_block ["block_light_level"=13]
fill ~4 ~2 ~4 ~1 ~ ~1 air [] replace light_block ["block_light_level"=13]
fill ~-4 ~2 ~-4 ~-1 ~ ~-1 air [] replace light_block ["block_light_level"=13]
fill ~4 ~2 ~-4 ~1 ~ ~-1 air [] replace light_block ["block_light_level"=13]
fill ~-4 ~2 ~4 ~-1 ~ ~1 air [] replace light_block ["block_light_level"=13]
fill ~-4 ~2 ~ ~-1 ~ ~ air [] replace light_block ["block_light_level"=13]
fill ~4 ~2 ~ ~1 ~ ~ air [] replace light_block ["block_light_level"=13]
fill ~ ~2 ~-4 ~ ~ ~-1 air [] replace light_block ["block_light_level"=13]
fill ~ ~2 ~4 ~ ~ ~1 air [] replace light_block ["block_light_level"=13]


fill ~4 ~4 ~4 ~-4 ~-2 ~-4 air [] replace light_block ["block_light_level"=15]
fill ~4 ~4 ~4 ~-4 ~-2 ~-4 air [] replace light_block ["block_light_level"=11]
fill ~4 ~4 ~4 ~-4 ~-2 ~-4 air [] replace light_block ["block_light_level"=9]
fill ~4 ~4 ~4 ~-4 ~-2 ~-4 air [] replace light_block ["block_light_level"=6]
execute if block ~1 ~ ~ redstone_torch run setblock ~1 ~ ~ air
execute if block ~-1 ~ ~ redstone_torch run setblock ~-1 ~ ~ air
execute if block ~ ~ ~1 redstone_torch run setblock ~ ~ ~1 air
execute if block ~ ~ ~-1 redstone_torch run setblock ~ ~ ~-1 air
execute if block ~ ~-1 ~ candle run setblock ~ ~-1 ~ air

# Anti-spam avanzado - verificación de área más amplia
execute unless block ~ ~ ~ light_block run setblock ~ ~ ~ light_block ["block_light_level"=13]
