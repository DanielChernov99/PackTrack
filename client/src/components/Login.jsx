import React from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/login.css";


const Login =({setUser}) => {
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [error,setError]= React.useState("");
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();

        // Simple validation
        if (!email || !password) {
            setError("Please fill in all fields.");
            return;
        }
        // Simulate login process
        try {
            // Here you would typically make an API call to your backend for authentication
            const mockUser = { id: 1, name: "alice", email: "alice@gmail.com" };
            // Simulate successful login
            setUser(mockUser);
            localStorage.setItem('loggedInUser', JSON.stringify(mockUser));
            navigate("/home"); // Redirect to home page after login
        } catch (err) {
            setError("Invalid email or password.");
        }

    }




    return(
        <div className="login-container">
        {/* Login Form */}
        <form onSubmit={handleLogin} className="login-form">  
            <h2>Login</h2>       
            <label>
                Email:
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="form-input"
                />
                </label>
            <label>
                Password:
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input"

                />
            </label>
            <button type="submit" className="login-btn">
                Login
            </button> 

            <p>
                Don't have an account? <Link to="/register">Register here</Link>
            </p>

            {error && <p className="error-message">{error}</p>}

        </form>
    </div>
    )

}

export default Login;