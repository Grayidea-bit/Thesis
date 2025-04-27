import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import GitHubLogin from './components/GitHubLogin';
import Profile from './components/Profile';
import Show from "./components/Show";

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<GitHubLogin />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/test" element={<Show />} />
      </Routes>
    </Router>
  );
};

export default App;
