import { createRoot } from 'react-dom/client'
import { UserProvider } from './contexts/UserContext.tsx' // 導入 UserProvider
import ReposProvider from './contexts/RepoContext.tsx'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
    <UserProvider>
        <ReposProvider>
            <App />
        </ReposProvider>
    </UserProvider>
)
