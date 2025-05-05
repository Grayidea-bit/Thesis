import React from 'react'; // Import React if not already present
import styles from './styles/RepoList.module.css';
import clsx from 'clsx';
import { useCommits } from '../contexts/CommitContext';

type commitType = {
    "name" : string,
    "sha" : string
}

const CommitList: React.FC = () => { // Add type annotation
    const { commits, commitsLoading, selectedCommits, selectCommits, diff, getDiff } = useCommits();

    const handleSelectChange = (commit: commitType) => {
        selectCommits(commit);
    };

    const handleGoClick = () => {
        if (selectedCommits) {
            getDiff();
            // Add your action here
        }
    };

    // Handle Loading State
    if (commitsLoading) {
        // You might want a styled loading indicator here too
        return <div className={styles.container}>Loading commits...</div>;
    }

    // Handle No Repositories Found
    if (!Array.isArray(commits) || commits.length === 0) {
        return <div className={styles.container}>No commit found.</div>;
    }

    return (
        // Apply container style
        <div className={styles.container}>
            {/* Apply label style */}
            <label htmlFor="repo-select" className={styles.label}>
                Select Repository:
            </label>
            {/* Apply select style */}
            <select
                id="repo-select"
                value={selectedCommits?.name || ""}
                onChange={(event) => {
                    const selectedName = event.target.value;
                    const selectedCom = commits.find(commit => commit.name === selectedName);
                    if (selectedCom) {
                        handleSelectChange(selectedCom);
                    }
                }}
                className={styles.select} // Use the select class from the module
            >
                <option value="" disabled>
                    -- Select a commits --
                </option>
                {commits.map((commit) => (
                    <option key={commit.name} value={commit.name}>
                        {commit.name}
                    </option>
                ))}
            </select>

            <button
                onClick={handleGoClick}
                disabled={!selectedCommits}
                className={clsx(
                    styles.goButton,
                    {
                        [styles.enabled]: !!selectedCommits,
                        [styles.disabled]: !selectedCommits
                    }
                )}
            >
                Let's compare!
            </button>

            {(diff)?<p>{diff.diff}</p>:<p>No diff</p>}
        </div>
    );
}

export default CommitList;