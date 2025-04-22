import { useUser } from "../contexts/UserContext";
import { useRepos } from "../contexts/RepoContext";
import { useNavigate } from "react-router-dom";
import Profile from "../components/Profile";
import RepoList from "../components/RepoList";
import BasicSelect from "../components/RepoListMaterial";
import RepoListLLM from "../components/RepoListLLM";
import CommitList from "../components/CommitList";

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
        <div className="bg-gray-900 h-screen w-screen flex flex-col">
            <button className="mr-auto text-white hover:text-blue-600 cursor-pointer" onMouseUp={()=>Logout()}>Logout</button>
            <Profile />
            {/* <RepoList /> */}
            {/* <BasicSelect /> */}
            <RepoListLLM />
            {(selectedRepo)?<CommitList />:<></>}
        </div>
      );

}
export default Home;