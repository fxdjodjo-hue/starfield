/**
 * MapConfigs - Centralize metadata and configurations for all game maps.
 */

const MAP_CONFIGS = {
    'default_map': {
        id: 'default_map',
        name: 'Palantir Prime',
        width: 21000,
        height: 13100,
        npcConfig: {
            scouterCount: 20,
            frigateCount: 10,
            guardCount: 20,
            pyramidCount: 20
        },
        portals: [
            {
                id: 'portal_to_map_2',
                x: 9000,
                y: 0,
                targetMap: 'palantir_2',
                targetPosition: { x: -9000, y: 0 }
            }
        ]
    },
    'palantir_2': {
        id: 'palantir_2',
        name: 'Palantir Sector B',
        width: 21000,
        height: 13100,
        npcConfig: {
            scouterCount: 30, // More NPCs to differentiate
            frigateCount: 5,
            guardCount: 10,
            pyramidCount: 5
        },
        portals: [
            {
                id: 'portal_to_map_1',
                x: -9000,
                y: 0,
                targetMap: 'default_map',
                targetPosition: { x: 9000, y: 0 }
            }
        ]
    }
};

module.exports = { MAP_CONFIGS };
