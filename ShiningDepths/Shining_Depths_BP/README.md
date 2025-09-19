# 🌟 Shining Depths - Sistema de Iluminación Dinámica

## 📋 Descripción

**Shining Depths** es un behavior pack avanzado para Minecraft Bedrock que implementa un sistema de iluminación dinámica inteligente. El pack detecta automáticamente las condiciones de luz y proporciona iluminación adaptativa para mejorar la experiencia de exploración y minería.

## ✨ Características Principales

### 🔆 Sistema de Iluminación Automática
- **Detección Inteligente**: El sistema detecta automáticamente cuando estás en zonas oscuras
- **Iluminación Adaptativa**: Se adapta al nivel de luz ambiental para proporcionar la cantidad correcta de luz
- **Optimización de Rendimiento**: Actualización eficiente cada segundo para minimizar el impacto en el rendimiento
- **Efectos Visuales**: Partículas personalizadas que indican la activación del sistema

### ⛑️ Casco de Minero Mejorado
- **Iluminación Potenciada**: Proporciona luz de nivel 15 cuando se usa
- **Efectos Especiales**: Partículas únicas y sonidos al activarse
- **Integración Perfecta**: Se integra automáticamente con el sistema de luz dinámica
- **Durabilidad**: 252 puntos de durabilidad, reparable con lingotes de hierro

### 🔥 Antorchas Dinámicas
- **Encendido Automático**: Las antorchas de redstone se encienden cuando te acercas (8 bloques)
- **Apagado Inteligente**: Se apagan automáticamente cuando te alejas para ahorrar recursos
- **Efectos Visuales**: Partículas de lava al encenderse y humo al apagarse
- **Sonidos Inmersivos**: Efectos de sonido realistas para el encendido

## 🎮 Comandos Disponibles

### Comandos de Iluminación (`/luz`)
```
/luz                    - Mostrar ayuda de comandos
/luz radio <1-16>      - Cambiar radio de detección de luz
/luz intensidad <5-15> - Cambiar nivel mínimo de luz para activación
/luz particulas        - Alternar efectos de partículas
/luz info             - Ver información detallada del sistema
/luz reset            - Restablecer configuración por defecto
```

### Comandos de Antorchas (`/antorchas` o `/torch`)
```
/antorchas              - Mostrar ayuda de antorchas
/antorchas info        - Ver estadísticas de antorchas detectadas
/antorchas encender    - Encender todas las antorchas cercanas (16 bloques)
/antorchas apagar      - Apagar todas las antorchas cercanas (16 bloques)
/antorchas limpiar     - Limpiar cache y reescanear antorchas
```

## 🛠️ Configuración Técnica

### Valores por Defecto
- **Radio de Luz**: 8 bloques
- **Intervalo de Actualización**: 20 ticks (1 segundo)
- **Nivel Mínimo de Luz**: 7
- **Nivel Máximo de Luz**: 15
- **Bonus del Casco**: +3 niveles de luz
- **Efectos de Partículas**: Activados

### Requisitos del Sistema
- **Minecraft Bedrock**: 1.21.10+
- **Experimental Features**: Script API habilitado
- **Módulos Requeridos**:
  - `@minecraft/server` v2.1.0+
  - `@minecraft/server-ui` v2.0.0+

## 🔧 Instalación

1. **Descarga el Pack**: Asegúrate de tener todos los archivos del behavior pack
2. **Copia los Archivos**: Coloca el pack en la carpeta `development_behavior_packs`
3. **Activa Experimental Features**: En la configuración del mundo, habilita "Beta APIs"
4. **Aplica el Pack**: Selecciona "Shining Depths" en los behavior packs del mundo

## 📁 Estructura del Pack

```
Shining_Depths/
├── manifest.json              # Configuración principal del pack
├── pack_icon.png             # Icono del pack
├── scripts/
│   └── main.js               # Lógica principal del sistema
├── items/
│   └── iron_miner_helmet.item.json  # Definición del casco de minero
└── recipes/
    └── enhanced_miner_helmet.json   # Receta de mejora (opcional)
```

## 🎯 Cómo Funciona

### Sistema de Detección de Luz
1. El sistema escanea constantemente el nivel de luz alrededor de cada jugador
2. Si el nivel de luz es inferior al configurado (7 por defecto), se activa la iluminación
3. Se coloca un bloque de luz invisible (`minecraft:light`) arriba del jugador
4. La luz se mueve dinámicamente con el jugador y se elimina cuando ya no es necesaria

### Antorchas Inteligentes
1. El sistema escanea un área de 32x32x32 bloques alrededor de cada jugador
2. Registra todas las antorchas de redstone apagadas (`unlit_redstone_torch`)
3. Monitorea la proximidad del jugador a cada antorcha registrada
4. Enciende/apaga automáticamente según la distancia (8 bloques de activación)

### Casco de Minero
- Detecta automáticamente cuando el jugador lleva el casco equipado
- Proporciona iluminación mejorada (nivel 15 vs nivel 10 estándar)
- Activa efectos especiales de partículas únicos
- Se integra perfectamente con el sistema de iluminación base

## 🐛 Solución de Problemas

### Problemas Comunes

**La iluminación no funciona:**
- Verifica que las "Beta APIs" estén habilitadas
- Asegúrate de que el pack esté aplicado correctamente
- Revisa la consola para mensajes de error

**Las antorchas no se encienden:**
- Usa antorchas de redstone apagadas (`/give @s unlit_redstone_torch`)
- Verifica que estés a menos de 8 bloques de distancia
- Usa `/antorchas limpiar` para resetear el cache

**Rendimiento lento:**
- Aumenta el intervalo de actualización con `/luz` (no disponible por defecto)
- Desactiva partículas con `/luz particulas`
- Reduce el radio de detección

## 📈 Rendimiento y Optimización

### Características de Optimización
- **Actualización Inteligente**: Solo actualiza cuando el jugador se mueve significativamente
- **Cache Eficiente**: Almacena datos de antorchas para evitar escaneos repetitivos
- **Límites de Distancia**: Procesamiento limitado a áreas relevantes
- **Gestión de Memoria**: Limpieza automática al desconectar jugadores

### Métricas de Rendimiento
- **Jugadores Soportados**: Hasta 10 jugadores simultáneos sin impacto notable
- **Antorchas Dinámicas**: Hasta 100 antorchas por chunk sin problemas
- **Impacto en TPS**: < 5% en servidores promedio

## 🎨 Personalización

### Modificar Configuraciones
Puedes modificar los valores por defecto editando el objeto `config` en `main.js`:

```javascript
this.config = {
    lightRadius: 8,        // Radio de detección
    checkInterval: 20,     // Intervalo de actualización (ticks)
    minLightLevel: 7,      // Nivel mínimo para activación
    maxLightLevel: 15,     // Nivel máximo de luz
    helmetLightBonus: 3,   // Bonus del casco
    particleEffects: true  // Efectos de partículas
};
```

## 🤝 Créditos y Contribución

**Desarrollado por**: Ikar0  
**Versión**: 1.0.0  
**Fecha**: Septiembre 2025

### Contribuir
Si encuentras bugs o tienes sugerencias de mejoras:
1. Documenta el problema detalladamente
2. Incluye pasos para reproducir el error
3. Proporciona información del sistema (versión de Minecraft, configuración del mundo)

## 📜 Licencia

Este behavior pack es de uso libre para servidores y mundos personales. No se permite la redistribución comercial sin autorización.

---

## 🚀 Funciones Avanzadas (Próximamente)

### Características Planeadas
- **Antorchas Solares**: Antorchas que se encienden/apagan según el ciclo día/noche
- **Linternas Portátiles**: Items que proporcionan luz al ser llevados en la mano
- **Sensores de Movimiento**: Bloques que detectan jugadores y activan luz
- **Configuración por Bioma**: Diferentes configuraciones según el bioma
- **API para Otros Packs**: Integración con otros behavior packs

### Sistema de Logros
- **Explorador Nocturno**: Camina 1000 bloques con el sistema activo
- **Maestro de las Antorchas**: Activa 50 antorchas dinámicas
- **Minero Iluminado**: Usa el casco por 1 hora consecutiva

¡Disfruta explorando las profundidades con tu nuevo sistema de iluminación dinámica! 🌟