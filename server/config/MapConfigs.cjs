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
            scouterCount: 20,
            frigateCount: 10,
            guardCount: 20,
            pyramidCount: 20
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
            scouterCount: 30,
            frigateCount: 5,
            guardCount: 10,
            pyramidCount: 5
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
