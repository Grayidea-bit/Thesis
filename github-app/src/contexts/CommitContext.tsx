import { useEffect, useState, ReactNode, useContext} from "react";
import React from "react";
import { useRepos } from "./RepoContext";

type commitType = {
    "name" : string,
    "sha" : string
}

type commitDiff = {
    "old" : string,
    "new" : string
}

interface CommitsContextType {
    commits: commitType[] | null;
    commitsLoading: boolean;        
    selectedCommits: commitType | null;
    diff: commitDiff | null;
    selectCommits: (arg0: commitType) => void;
    setDiff: (args0: string, args1: string) => void;
}

const CommitsContext = React.createContext<CommitsContextType>({
    commits: [],     // Initial state should be null
    commitsLoading: false,     // Or false, depending on initial assumption
    selectedCommits: null,
    diff: null,
    selectCommits: () => {},
    setDiff: () => {}
});

const CommitsProvider = ({children}:{children:ReactNode}) => {
    const [commits, setCommits] = useState<commitType[]|null>(null);
    const [selectedCommits, setSelectedCommits] = useState<commitType|null>(null);
    const [commitsLoading, setCommitsLoading] = useState(true);
    const [diff, setDifff] = useState<commitDiff|null>(null)
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
    const { selectedRepo } = useRepos();

    const selectCommits = (e:commitType) => {
        setSelectedCommits(e);
    };
    const setDiff = (oldCode:string, newCode:string) => {
        setDifff({
            old:oldCode,
            new:newCode
        })
    }

    useEffect(() => {
        const fetchCommitsData = async () => {
        console.log("fetching");
        setCommitsLoading(true);
        try {
            const response = await fetch(`http://localhost:8000/github/${selectedRepo?.name}/${selectedRepo?.owner}/commits/`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrfToken,
            },
            credentials: 'include',
            });
            
            if (response.ok) {
                const responseData = await response.json();
                setCommits(responseData.commits);
                
            } 
            else {
                // 可以加入錯誤處理邏輯，例如清除 userData 或顯示錯誤訊息
                console.error("Failed to fetch user data:", response.statusText);
                setCommits(null); // 或者根據需求處理
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
            setCommits(null); // 發生錯誤時清除資料
        } finally {
            setCommitsLoading(false);
        }
        };
        if(selectedRepo) fetchCommitsData();
    }, [selectedRepo]);

    
    return(
        <CommitsContext.Provider value={{ commits, commitsLoading, selectedCommits, selectCommits, diff, setDiff}}>{children}</CommitsContext.Provider>
    )
}
export default CommitsProvider

export const useCommits = () => {
  const context = useContext(CommitsContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};