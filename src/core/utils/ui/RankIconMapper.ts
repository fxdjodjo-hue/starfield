/**
 * Utility to map military ranks and special roles to Kenney rank assets
 */
export class RankIconMapper {
    private static readonly ASSET_BASE_PATH = 'assets/playerRanks';

    /**
     * Returns the asset path for a given rank name
     * @param rankName The name of the rank (e.g., "General", "Administrator")
     * @returns The relative path to the rank icon PNG
     */
    public static getRankIconPath(rankName: string): string {
        const name = rankName.trim();
        let filename = name.toLowerCase().replace(/\s/g, ''); // "Chief General" -> "chiefgeneral"

        // Handle "Recruit" legacy/default rank by mapping it to Basic Space Pilot
        if (filename === 'recruit') {
            filename = 'basicspacepilot';
        }

        return `${this.ASSET_BASE_PATH}/${filename}.png`;
    }
}
