import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";



const Profile = () => {
  const [userData, setUserData] = useState<{ username: string; avatar_url: string } | null>(null);
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
  const navigate = useNavigate();

  useEffect(() => {
    // 呼叫後端 API 來獲取使用者資料
    const fetchUserData = async () => {
      const response = await fetch("http://localhost:8000/github/getinfo/", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,  // 必須將 CSRF token 傳遞到 header
        },
        credentials: 'include', 
      });

      const data = await response.json();
      if (response.ok) {
        setUserData(data); // 更新使用者資料
        console.log(userData?.username,userData?.avatar_url);
      }
    };
    fetchUserData();
  }, []);

  const handleClick = async () => {
    const repoName = 'git_practice';
    const response = await fetch(`http://localhost:8000/github/analyze/${repoName}`,{
      method: "GET", 
      headers: {
        "Content-Type": "application/json",
      },
      credentials: 'include', 
    });
    const data = await response.json();  
    navigate('/test', { state: { resultData: data } });

  };

  if (!userData) return <div>Loading...</div>;

  return (
    <div className="profile">
      <h2>Welcome, {userData.username}!</h2>
      <img src={userData.avatar_url} alt="avatar" className="avatar" />
      <button onClick={handleClick}>
        前往分析 Repo
      </button>
    </div>
  );
};

export default Profile;
