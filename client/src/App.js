import React, {useState,useEffect, }  from 'react';
import {BrowserRouter as Router, Route, Routes,Navigate} from 'react-router-dom';
import Login from './components/Login.jsx';
import Home from './components/Home.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';
/*import AddShift from './components/AddShift.jsx';
import ShiftHistory from './components/ShiftHistory.jsx';
import Profile from './components/Profile.jsx';

*/


function App() {
  const [user, setUser] = React.useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('loggedInUser');
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
  }, []);

  const ProtectedPages = [
    {path: "/home", Component:Home},
    {/*}
    {path: "/AddShift", Component:AddShift},
    {path: "/ShiftHistory", Component:ShiftHistory},
    {path: "/Profile", Component:Profile},
    */}
  ];
   
  return (
    <Router>
      <Routes>
        {/* Public route before login */}
        <Route path="/login" element={<Login setUser={setUser}/>}/>

        {/* Protected route after login */}
        {ProtectedPages.map((page)=>(
          <Route
          key = {page.path}
          path = {page.path}
          element = {
            <ProtectedRoute user={user}>
              <Layout>
                <page.Component user={user} />
              </Layout>
            </ProtectedRoute>
          }
          />
        ))}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>         
    </Router>
  );

}

export default App;