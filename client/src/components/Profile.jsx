import React from 'react';

const Profile = ({ user }) => {
    return (
        <div>
            <h2>Profile</h2>
            <p>Welcome, {user.name}</p>
            <p>Email: {user.email}</p>
        </div>
    );
};

export default Profile;