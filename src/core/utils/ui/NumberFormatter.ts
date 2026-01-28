/**
 * Utility to format numbers with thousands separators for the UI.
 * Focuses on readability using localized formats (dots as separators).
 */
export class NumberFormatter {
    /**
     * Formats a number with thousands separators (e.g., 1000 -> 1.000)
     * @param num The number to format
     * @returns The formatted string
     */
    public static format(num: number): string {
        // Deterministic regex for thousands separators (dots)
        return Math.floor(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }
}
