import { useState, ReactNode, useContext} from "react";
import React from "react";

type repoType = {
    "name" : string,
    "owner" : string
};

interface RepoContextType {
    replyContent: string;        
    repo: repoType | null;
    setRepo: (arg0: repoType) => void;
    setReply: (arg0: string) => void;
}

const ReplyContext = React.createContext<RepoContextType>({
    replyContent: "",  
    repo: null,   
    setRepo: ()=>{},
    setReply: ()=>{}
});

const ReplyProvider = ({children}:{children:ReactNode}) => {
    const [repo, setSelectedRepo] = useState<repoType|null>(null);
    const [replyContent, setReplyContent] = useState<string>("");
    
    const setRepo = (e:repoType) => {
        setSelectedRepo(e);
    };
    const setReply = (e:string) => {
        setReplyContent(e);
    };
    
    return(
        <ReplyContext.Provider value={{ replyContent, repo, setRepo, setReply }}>{children}</ReplyContext.Provider>
    )
}
export default ReplyProvider

export const useReply = () => {
  const context = useContext(ReplyContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};