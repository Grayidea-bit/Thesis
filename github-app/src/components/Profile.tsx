import { useUser } from "../contexts/UserContext";

const Profile = () => {
    const { userData, userLoading } = useUser(); // 使用 Hook 獲取資料和加載狀態
    // 處理加載狀態
    if (userLoading) {
      return <div>Loading data...</div>;
    }
  
    // 處理未登入或獲取失敗的情況
    if (!userData) {
      // 可以導向登入頁面或顯示提示訊息
      return <div>User not logged in or data unavailable.</div>;
    }

    return (
            <div className="flex flex-col items-center p-4 rounded shadow ">
                <h2 className="text-white text-xl font-semibold mb-2">Welcome, {userData.username}!</h2>
                <img
                    src={userData.avatar_url}
                    alt={`${userData.username}'s avatar`}
                    className="avatar w-16 h-16 rounded-full border-2 border-gray-300"
                />
            </div>
      );

}
export default Profile;