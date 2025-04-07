import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import GitHubLogin from './components/GitHubLogin';
import Profile from './components/Profile';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<GitHubLogin />} />
        <Route path="profile/" element={<Profile />} />
      </Routes>
    </Router>
  );
};

export default App;
