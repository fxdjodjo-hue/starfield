/**
 * MapConfigs - Centralize metadata and configurations for all game maps.
 */

const MAP_CONFIGS = {
    'palantir': {
        id: 'palantir',
        name: 'Palantir',
        width: 21000,
        height: 13100,
        npcConfig: {
            scouterCount: 35,
            frigateCount: 0,
            guardCount: 35,
            pyramidCount: 0
        },
        portals: [
            {
                id: 'portal_to_singularity',
                x: 9000,
                y: 0,
                targetMap: 'singularity',
                targetPosition: { x: -9000, y: 0 }
            }
        ]
    },
    'singularity': {
        id: 'singularity',
        name: 'Singularity',
        width: 21000,
        height: 13100,
        npcConfig: {
            scouterCount: 0,
            frigateCount: 21,
            guardCount: 0,
            pyramidCount: 49
        },
        portals: [
            {
                id: 'portal_to_palantir',
                x: -9000,
                y: 0,
                targetMap: 'palantir',
                targetPosition: { x: 9000, y: 0 }
            }
        ]
    }
};

module.exports = { MAP_CONFIGS };
