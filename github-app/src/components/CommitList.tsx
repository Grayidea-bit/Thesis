import React from 'react';
import clsx from 'clsx';
import axios from '../axiosConfig';
import styles from './styles/RepoList.module.css';
import { useCommits } from '../contexts/CommitContext';
import { useReply } from '../contexts/ReplyContext';

type commitType = {
  name: string;
  sha: string;
};

const CommitList: React.FC = () => {
  const {
    commits,
    commitsLoading,
    selectedCommits,
    selectCommits,
    setDiff,
  } = useCommits();
  const { repo, setReply } = useReply();

  const handleSelectChange = (commit: commitType) => {
    selectCommits(commit);
  };

  const handleGoClick = async() => {
    setReply('Loading...');
    if (selectedCommits) {
      const response = await axios.get(
        `http://localhost:8000/github/repos/${repo?.owner}/${repo?.name}/commits/${selectedCommits.sha}/analyze`
        
      );
      setReply(response.data.analysis);
      setDiff(response.data.previous_diff, response.data.diff);
    }
  };

  if (commitsLoading) {
    return <div className={styles.container}>Loading commits...</div>;
  }

  if (!Array.isArray(commits) || commits.length === 0) {
    return <div className={styles.container}>No commit found.</div>;
  }

  return (
    <div className="flex flex-col h-auto">
      <h2 className="text-white mb-2">Select Commits:</h2>
      <div
        className={clsx(
          'flex',
          'flex-col',
          'p-2',
          'max-h-[37vw]', // Set a fixed height
          'overflow-y-auto' // Make vertical scrollable
        )}
      >
        <ul className="space-y-1">
          {commits.map((commit) => {
            const isSelected = selectedCommits?.sha === commit.sha;
            return (
              <li key={commit.sha} className="flex items-center text-white">
                <button
                  onClick={() => handleSelectChange(commit)}
                  className={clsx(
                    'w-full rounded p-2 focus:outline-none',
                    isSelected ? 'bg-blue-600' : 'bg-gray-800'
                  )}
                >
                  {commit.name}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {/* Center the button horizontally with "mx-auto" */}
      <button
        className={clsx(
          'm-1',
          'mx-auto',
          'w-[90%]',
          'items-center',
          'justify-center',
          'text-white',
          'bg-blue-600',
          'px-3',
          'py-1',
          'rounded',
          'hover:bg-blue-700'
        )}
        onClick={handleGoClick}
      >
        Go
      </button>
    </div>
  );
};

export default CommitList;
