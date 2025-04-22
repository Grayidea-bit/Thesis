import GitHubLogin from "../components/GitHubLogin";
import '../styles/tailwind.css'

const Login = () => {
    return (
        <div className="flex items-center justify-center h-screen w-screen bg-gray-900"> 
            <GitHubLogin /> 
        </div>
    )
}
export default Login;