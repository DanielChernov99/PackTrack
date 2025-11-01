
import '../styles/header.css';

const Header = () =>{
    return (
        <header className="header">
            
            <nav className="left-nav">
                <a href="#">Home</a>
                <a href="#">Add a shift</a>
                <a href="#">Shift History</a>
                <a href="#">Profile</a>              
            </nav>
            <h1 className="logo">PackTrack</h1>
            <button className="logout-btn">Logout</button>

        </header>
    )
}

export default Header;