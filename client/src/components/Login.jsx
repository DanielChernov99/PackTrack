import React from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/login.css";


const Login =({setUser}) => {
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [error,setError]= React.useState("");
    const navigate = useNavigate();

    const handleLogin = async (e) => {

    }




    return(
        <div className="login-container">
        {/* Login Form */}
        <form onSubmit={handleLogin} className="login-form">         
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