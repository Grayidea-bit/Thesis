import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Repos from './components/Repos';
import './App.css';

function App() {
  const isAuthenticated = () => {
    const accessToken = localStorage.getItem('access_token');
    const user = localStorage.getItem('user');
    try {
      const parsedUser = user ? JSON.parse(user) : null;
      return accessToken && parsedUser && parsedUser.login;
    } catch (e) {
      return false;
    }
  };

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route
            path="/"
            element={isAuthenticated() ? <Navigate to="/repos" replace /> : <Login />}
          />
          <Route
            path="/repos"
            element={isAuthenticated() ? <Repos /> : <Navigate to="/" replace />}
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;