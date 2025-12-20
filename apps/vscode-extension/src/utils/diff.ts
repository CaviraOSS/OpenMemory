
/**
 * Simple Line-based Diff Implementation
 * Generates a unified diff-like output string.
 */

export function generateDiff(oldText: string, newText: string, filePath: string): string {
    const oldLines = oldText.split(/\r?\n/);
    const newLines = newText.split(/\r?\n/);

    // Simple LCS (Longest Common Subsequence) based diff
    // This is valid but naive implementation for meaningful diffs.
    // Given the constraints and desire for "before and after", a chunked diff is best.

    const dp: number[][] = Array(oldLines.length + 1).fill(0).map(() => Array(newLines.length + 1).fill(0));

    for (let i = 1; i <= oldLines.length; i++) {
        for (let j = 1; j <= newLines.length; j++) {
            if (oldLines[i - 1] === newLines[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    let i = oldLines.length;
    let j = newLines.length;
    const changes: string[] = [];

    // Backtrack to find diff
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            // No change
            // changes.unshift("  " + oldLines[i-1]); // We can omit context for brevity if massive, or keep some
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            changes.unshift("+ " + newLines[j - 1]);
            j--;
        } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
            changes.unshift("- " + oldLines[i - 1]);
            i--;
        }
    }

    // Post-processing to group output or just return raw diff lines
    // To make it readable like git diff:

    if (changes.length === 0) return "No changes detected.";

    // Grouping for context could be nice, but raw added/removed lines are what was asked.
    return `Diff for ${filePath}:\n` + changes.join("\n");
}
