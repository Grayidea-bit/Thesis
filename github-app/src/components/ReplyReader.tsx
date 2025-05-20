import { useEffect, useState } from 'react';
import { useReply } from "../contexts/ReplyContext"
import Markdown from 'react-markdown'
import axios from '../axiosConfig';
import DiffViewer from 'react-diff-viewer-continued';
import { useCommits } from '../contexts/CommitContext';

type repoType = {
    "name" : string,
    "owner" : string
};

const ReplyReader = () => {
    const { replyContent, repo, setReply} = useReply();
    const { diff } = useCommits();
    //const markdown = '# Hi, *Pluto*!'
    useEffect(() => {
    const timer = setTimeout(() => {
            const handleOverview = async () => {      
                if(repo!=null) {
                    setReply('Loading...');
                    console.log("fetching overview");
                    const overviewResponse = await axios.get(`http://localhost:8000/github/repos/${repo?.owner}/${repo?.name}/overview`);
                    setReply(overviewResponse.data.overview);
                }
                else console.log("No selected Repo");
            }
            handleOverview();
        }, 500); // 延遲500ms

        return () => clearTimeout(timer);
    }, [repo]);

    return (
        <div className="text-white flex flex-col  h-screen w-full">
            <Markdown>{replyContent}</Markdown>
            {/* 調整這個容器的大小 */}
            <div className='overflow-y-auto flex flex-col items-center justify-center overflow-x-auto max-w-[80%] max-h-[60vh]'>
                <DiffViewer 
                    oldValue={diff?.old} 
                    newValue={diff?.new}
                />
            </div>
        </div>
    )
}

export default ReplyReader