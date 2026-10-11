
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="navbar">
      <Link to="/" className="logo">
        THRONE<span>8</span>
      </Link>

      <nav>
        <Link to="/">Home</Link>
      </nav>

      <div className="nav-actions">
        {user ? (
          <>
            <Link to="/dashboard" className="btn btn-outline">
              Dashboard
            </Link>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleLogout}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn btn-outline">
              Login
            </Link>

            <Link to="/register" className="btn btn-primary">
              Register
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

export default Navbar;
