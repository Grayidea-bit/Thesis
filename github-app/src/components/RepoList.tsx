import { useRepos } from "../contexts/RepoContext"; 
import clsx from 'clsx';
import '../styles/tailwind.css';

const RepoList = () => {
    const { repositories, reposLoading, selectedRepo, selectRepo} = useRepos();
    const handleSelectRepo = (repoName: string) => {
        selectRepo(repoName);

    }
    // 處理加載狀態
    if (reposLoading) {
      return <div>Loading data...</div>;
    }

    
    return (
        <div className="flex flex-col  items-center p-4 rounded shadow">
            {(Array.isArray(repositories) && repositories.length > 0) ? (
            <ul>
            {repositories.map((repoName, index) => {
                const isSelected = selectedRepo === repoName;
                return (                
                <li data-set={`repo-${index}`} onMouseUp={() => {handleSelectRepo(repoName);}} key={`${repoName}-${index}`} className={clsx(
                    // Base classes
                    'flex items-center justify-center gap-2 bg-[#24292F] text-white font-medium py-3 px-5 rounded-lg',
                    'shadow-md transform transition-all duration-200 mb-[4%]', // Keep mb-[4%] if you want vertical spacing in the list
                    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-purple-500',
                    'cursor-pointer',
                    // Conditional classes
                    {
                      'ring-2 ring-purple-500 bg-purple-800 hover:bg-purple-700': isSelected,
                      'hover:shadow-lg hover:-translate-y-0.5 hover:bg-gray-700 hover:text-blue-400': !isSelected,
                    }
                  )}>
                {repoName}
                </li>)
            })}
            </ul>
            ) : (
                <p>No repositories found or still loading.</p> // Updated message
            )}
            <p className="text-white">selected: {selectedRepo}</p>
        </div>
      );

}
export default RepoList;