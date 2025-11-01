
import { Link, useNavigate } from 'react-router-dom';
import '../styles/header.css';

const Header = ({ user }) => {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('loggedInUser');
        navigate('/login');
    };

    return (
        <header className="header">
            <nav className="left-nav">
                <Link to="/home">Home</Link>
                <Link to="/add-shift">Add a shift</Link>
                <Link to="/shift-history">Shift History</Link>
                <Link to="/profile">Profile</Link>              
            </nav>
            <h1 className="logo">PackTrack</h1>
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </header>
    )
}

export default Header;