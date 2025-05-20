import { useUser } from "../contexts/UserContext";
import { useRepos } from "../contexts/RepoContext";
import { useNavigate } from "react-router-dom";
import Profile from "../components/Profile";
import RepoListLLM from "../components/RepoListLLM";
import CommitList from "../components/CommitList";
import LLMChat from "../components/LLMChat";
import ReplyReader from "../components/ReplyReader";


const Home = () => {
    const { userLoading } = useUser(); // 使用 Hook 獲取資料和加載狀態
    const { reposLoading, selectedRepo } = useRepos();
    const navigate = useNavigate();

    const Logout = () => {
        navigate("/");
    }

    // 處理加載狀態
    if (userLoading || reposLoading) {
      return <div>Loading data...</div>;
    }

    return (
        <div  className="bg-gray-900 h-screen w-screen flex flex-row">
          <div className=" flex-col w-[15vw] border-r-1 border-gray-700 max-h-screen">
              <button className="mr-auto text-white hover:text-blue-600 cursor-pointer" onMouseUp={()=>Logout()}>Logout</button>
              <Profile />
              <RepoListLLM />
              {(selectedRepo)?<CommitList />:<></>}
          </div>
          <div className="flex-1/2 w-[50vw]">
            <ReplyReader />
          </div>
          <div className=" border-l-1 border-gray-700">
            <LLMChat />
          </div>
        </div>
      );

}
export default Home;