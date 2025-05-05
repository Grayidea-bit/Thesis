import React from 'react'; // Import React if not already present
import { useRepos } from "../contexts/RepoContext";
// Ensure the path to your CSS module is correct
import styles from './styles/RepoList.module.css';

const RepoListLLM: React.FC = () => { // Add type annotation
    const { repositories, reposLoading, selectedRepo, selectRepo } = useRepos();


    // Handle Loading State
    if (reposLoading) {
        // You might want a styled loading indicator here too
        return <div className={styles.container}>Loading repositories...</div>;
    }

    // Handle No Repositories Found
    if (!Array.isArray(repositories) || repositories.length === 0) {
        return <div className={styles.container}>No repositories found.</div>;
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
                value={selectedRepo?.name || ""}
                onChange={(event) => {
                    const selectedName = event.target.value;
                    const selectedRep = repositories.find(repo => repo.name === selectedName);
                    if (selectedRep) {
                        selectRepo(selectedRep);
                    }
                }}
                className={styles.select} // Use the select class from the module
            >
                <option value="" disabled>
                    -- Select a repository --
                </option>
                {repositories.map((repo) => (
                    <option key={repo.name} value={repo.name}>
                        {repo.name}
                    </option>
                ))}
            </select>

            {/* Optionally display the selected repo below */}
            {/* {selectedRepo && (
                <p className="text-center text-purple-400 mt-4 mb-4">
                    Selected: {selectedRepo}
                </p>
            )} */}

            {/* Button using CSS Modules */}
            {/* <button
                onClick={handleGoClick}
                disabled={!selectedRepo}
                className={clsx(
                    styles.goButton,
                    {
                        [styles.enabled]: !!selectedRepo,
                        [styles.disabled]: !selectedRepo
                    }
                )}
            >
                Get Commits!
            </button> */}
        </div>
    );
}

export default RepoListLLM;