import React, {useState,useEffect}  from 'react';
import {BrowserRouter as Router, Route, Routes,Navigate} from 'react-router-dom';
import Login from './components/Login.jsx';
import Home from './components/Home.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';
import AddShift from './components/AddShift.jsx';
import ShiftHistory from './components/ShiftHistory.jsx';
import Profile from './components/Profile.jsx';


function App() {
  const [user, setUser] = React.useState(undefined);

  useEffect(() => {
    const savedUser = localStorage.getItem('loggedInUser');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
      } catch (error) {
        localStorage.removeItem('loggedInUser');
      }
    } else {
      setUser(null);
    }
  }, []);

  const ProtectedPages = [
    {path: "/home", Component: Home},
    {path: "/add-shift", Component: AddShift},
    {path: "/shift-history", Component: ShiftHistory},
    {path: "/profile", Component: Profile}
  ];
   
  return (
    <Router>
      <Routes>
        {/* Public route before login */}
        <Route path="/login" element={<Login setUser={setUser}/>}/>

        {/* Protected route after login */}
        {ProtectedPages.map((page) => {
          const PageComponent = page.Component; // Capitalize
          return (
            <Route
                key={page.path}
                path={page.path}
                element={
                    <ProtectedRoute user={user}>
                        <Layout user={user}>
                            <PageComponent user={user} />
                        </Layout>
                    </ProtectedRoute>
                }
            />
    );
})}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>         
    </Router>
  );

}

export default App;