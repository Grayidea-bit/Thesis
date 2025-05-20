import { createRoot } from 'react-dom/client'
import { UserProvider } from './contexts/UserContext.tsx' // 導入 UserProvider
import ReplyProvider from './contexts/ReplyContext.tsx'
import ReposProvider from './contexts/RepoContext.tsx'
import App from './App.tsx'
import CommitsProvider from './contexts/CommitContext.tsx'


createRoot(document.getElementById('root')!).render(
    <ReplyProvider>
        <ReposProvider>
            <CommitsProvider>
                <UserProvider>
                    <App /> 
                </UserProvider>
            </CommitsProvider>
        </ReposProvider>
    </ReplyProvider>
)
