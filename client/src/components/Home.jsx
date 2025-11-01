import React from "react";
import { useNavigate, Link } from "react-router-dom";

const Home = ({user}) => {
    if (!user) {
        return <div>Loading user data...</div>;
    }

    return(
        <div>
            <h2>Welcome to PackTrack, {user?.name || 'User'}!</h2>
            <p>This is your home page.</p>
        </div>
    );
}

export default Home;
   