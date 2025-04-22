import React from 'react';
import { useCommits } from "../contexts/CommitContext";
// Assuming styles are in CommitList.module.css now
import styles from './styles/RepoList.module.css';
import clsx from 'clsx';

const CommitList: React.FC = () => {
    // Assuming selectedCommits is now string[] and selectCommits handles add/remove
    const { commits, commitsLoading, selectedCommits, selectCommits } = useCommits();

    // Handler for checkbox changes
    const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const commitSha = event.target.value;
        // Call the updated context function to add/remove the commit SHA
        selectCommits(commitSha);
    };

    const handleGoClick = () => {
        // Example: Check if exactly two commits are selected
        if (selectedCommits && selectedCommits.length === 2) {
            console.log(`Comparing commits: ${selectedCommits.join(' and ')}`);
            // Add your comparison logic here
        } else {
            console.log("Please select exactly two commits to compare.");
            // Optionally show a user message
        }
    };

    // Handle Loading State
    if (commitsLoading) {
        return <div className={styles.container}>Loading commits...</div>;
    }



    // Handle No Commits Found
    if (!Array.isArray(commits) || commits.length === 0) {
        return <div className={styles.container}>No commits found for this repository.</div>;
    }

    // Determine if the "Go" button should be enabled (e.g., exactly 2 selected)
    const isGoButtonEnabled = selectedCommits?.length === 2;

    return (
        <div className={styles.container}>
            <h3 className={styles.title}>Select Commits to Compare (Choose 2)</h3>
            {/* Use a div or ul for the list */}
            <div className={styles.checkboxList}>
                {commits.map((commitSha) => {
                    // Check if the current commit is in the selectedCommits array
                    const isChecked = selectedCommits?.includes(commitSha);
                    // Generate a unique ID for the checkbox and label association
                    const checkboxId = `commit-${commitSha}`;

                    return (
                        <div key={commitSha} className={styles.checkboxItem}>
                            <input
                                type="checkbox"
                                id={checkboxId}
                                value={commitSha}
                                checked={isChecked}
                                onChange={handleCheckboxChange}
                                className={styles.checkboxInput}
                                // Optional: Disable other checkboxes if 2 are already selected
                                // disabled={!isChecked && selectedCommits.length >= 2}
                            />
                            {/* Use a label for better accessibility */}
                            <label htmlFor={checkboxId} className={styles.checkboxLabel}>
                                {/* Display commit SHA (or message/date if available) */}
                                {commitSha.substring(0, 7)} {/* Example: Show short SHA */}
                            </label>
                        </div>
                    );
                })}
            </div>

            {/* Display selected count */}
            <p className={styles.selectedCount}>
                Selected: {selectedCommits?.length} / 2
            </p>

            {/* Button using CSS Modules */}
            <button
                onClick={handleGoClick}
                disabled={!isGoButtonEnabled} // Disable based on the count
                className={clsx(
                    styles.goButton,
                    {
                        [styles.enabled]: isGoButtonEnabled,
                        [styles.disabled]: !isGoButtonEnabled
                    }
                )}
            >
                Compare Commits
            </button>
        </div>
    );
}

export default CommitList;