import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Profile from './components/Profile';
import Home from './pages/Home';
import Login from './pages/Login';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="home/" element={<Home />} />
        <Route path="home/" element={<Home />} />
      </Routes>
    </Router>
  );
};

export default App;
