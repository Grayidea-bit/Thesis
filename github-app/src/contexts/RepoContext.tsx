import { useEffect, useState, ReactNode, useContext} from "react";
import React from "react";

type repoType = {
    "name" : string,
    "owner" : string
};

interface RepoContextType {
    repositories: repoType[] | null;
    reposLoading: boolean;        
    selectedRepo: repoType | null;
    selectRepo: (arg0: repoType) => void;
}

const ReposContext = React.createContext<RepoContextType>({
    repositories: null,     // Initial state should be null
    reposLoading: true,     // Or false, depending on initial assumption
    selectedRepo: null,
    selectRepo: ()=>{}
});

const ReposProvider = ({children}:{children:ReactNode}) => {
    const [repositories, setRepositories] = useState<repoType[]|null>(null);
    const [selectedRepo, setSelectedRepo] = useState<repoType|null>(null);
    const [reposLoading, setReposLoading] = useState(true);
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

    const selectRepo = (e:repoType) => {
        setSelectedRepo(e);
    };

    useEffect(() => {
        const fetchRepoData = async () => {
        setReposLoading(true);
        try {
            const response = await fetch("http://localhost:8000/github/getrepos/", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrfToken,
            },
            credentials: 'include',
            });

            if (response.ok) {
                const responseData = await response.json();
                setRepositories(responseData.repositories.map((repo: any) => ({
                    name: repo.name,
                    owner: repo.owner
                })));
                //console.log(repositories);
            } 
            else {
                // 可以加入錯誤處理邏輯，例如清除 userData 或顯示錯誤訊息
                console.error("Failed to fetch user data:", response.statusText);
                setRepositories(null); // 或者根據需求處理
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
            setRepositories(null); // 發生錯誤時清除資料
        } finally {
            setReposLoading(false);
        }
        };

        fetchRepoData();
    }, [csrfToken]);
    
    return(
        <ReposContext.Provider value={{ repositories, reposLoading, selectedRepo, selectRepo }}>{children}</ReposContext.Provider>
    )
}
export default ReposProvider

export const useRepos = () => {
  const context = useContext(ReposContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};