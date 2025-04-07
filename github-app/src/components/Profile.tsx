// Profile.tsx (React)
import { useEffect, useState } from "react";

const Profile = () => {
  const [userData, setUserData] = useState<{ username: string; avatar_url: string } | null>(null);
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

  useEffect(() => {
    // 呼叫後端 API 來獲取使用者資料
    const fetchUserData = async () => {
      const response = await fetch("http://localhost:8000/github/getinfo/", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,  // 必須將 CSRF token 傳遞到 header
        },
        credentials: 'include',  // 確保請求帶有 cookie
      });

      const data = await response.json();
      if (response.ok) {
        setUserData(data); // 更新使用者資料
        console.log(userData?.username,userData?.avatar_url);
      }
    };
    fetchUserData();
  }, []);

  if (!userData) return <div>Loading...</div>;

  return (
    <div className="profile">
      <h2>Welcome, {userData.username}!</h2>
      <img src={userData.avatar_url} alt="avatar" className="avatar" />
    </div>
  );
};

export default Profile;
