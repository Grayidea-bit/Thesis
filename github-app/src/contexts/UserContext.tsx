import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';

// 定義使用者資料的型別
interface UserData {
  username: string;
  avatar_url: string;
}

// 定義 Context 的型別
interface UserContextType {
  userData: UserData | null;
  userLoading: boolean;
}

// 建立 Context，提供預設值
const UserContext = createContext<UserContextType>({
  userData: null,
  userLoading: true,
});

// 建立 Provider 元件
interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

  useEffect(() => {
    const fetchUserData = async () => {
      setUserLoading(true);
      try {
        const response = await fetch("http://localhost:8000/github/getinfo/", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken,
          },
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setUserData(data);
        } else {
          // 可以加入錯誤處理邏輯，例如清除 userData 或顯示錯誤訊息
          console.error("Failed to fetch user data:", response.statusText);
          setUserData(null); // 或者根據需求處理
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        setUserData(null); // 發生錯誤時清除資料
      } finally {
        setUserLoading(false);
      }
    };

    fetchUserData();
  }, [csrfToken]); // 當 csrfToken 變化時重新獲取 (雖然通常不太會變)

  return (
    <UserContext.Provider value={{ userData, userLoading }}>
      {children}
    </UserContext.Provider>
  );
};

// 建立一個自訂 Hook 方便使用 Context
export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};