import { useEffect, useState, ReactNode, useContext} from "react";
import React from "react";

interface CommitsContextType {
    commits: string[] | null;
    commitsLoading: boolean;        
    selectedCommits: string[] | null;
    selectCommits: (arg0: string) => void;
}

const CommitsContext = React.createContext<CommitsContextType>({
    commits: ["1","2","3","4","5","6"],     // Initial state should be null
    commitsLoading: false,     // Or false, depending on initial assumption
    selectedCommits: null,
    selectCommits: ()=>{}
});

const CommitsProvider = ({children}:{children:ReactNode}) => {
    const [commits, setCommits] = useState<string[]|null>(null);
    const [selectedCommits, setSelectedCommits] = useState<string[]|null>(null);
    const [commitsLoading, setCommitsLoading] = useState(true);
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

    const selectCommits = (e:string) => {
        setSelectedCommits(prev => [...(prev || []), e]);
    };

    // useEffect(() => {
    //     const fetchCommitsData = async () => {
    //     setCommitsLoading(true);
    //     try {
    //         const response = await fetch("http://localhost:8000/github/getcommits/", {
    //         method: "GET",
    //         headers: {
    //             "Content-Type": "application/json",
    //             "X-CSRFToken": csrfToken,
    //         },
    //         credentials: 'include',
    //         });

    //         if (response.ok) {
    //             const responseData = await response.json();
    //             setCommits(responseData.commits);
    //             console.log(commits);
    //         } 
    //         else {
    //             // 可以加入錯誤處理邏輯，例如清除 userData 或顯示錯誤訊息
    //             console.error("Failed to fetch user data:", response.statusText);
    //             setCommits(null); // 或者根據需求處理
    //         }
    //     } catch (error) {
    //         console.error("Error fetching user data:", error);
    //         setCommits(null); // 發生錯誤時清除資料
    //     } finally {
    //         setCommitsLoading(false);
    //     }
    //     };

    //     fetchCommitsData();
    // }, [csrfToken]);
    
    return(
        <CommitsContext.Provider value={{ commits, commitsLoading, selectedCommits, selectCommits }}>{children}</CommitsContext.Provider>
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