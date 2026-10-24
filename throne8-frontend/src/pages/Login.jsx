
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Login.css";

function Login() {

  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const loggedInUser = await login(email, password);

      if (loggedInUser.role === "admin") {
        navigate("/admin-dashboard");
      } else if (loggedInUser.role === "mentor") {
        navigate("/mentor-dashboard");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="throne-auth-page">
      <div className="auth-glow auth-glow-one"></div>
      <div className="auth-glow auth-glow-two"></div>

      <Link to="/" className="auth-brand">
        <span className="auth-brand-icon">T8</span>
        <span>Throne8</span>
      </Link>

      <section className="auth-layout">
        <div className="auth-welcome">
          <span className="auth-eyebrow">
            YOUR JOURNEY STARTS HERE
          </span>

          <h1>
            Unlock your
            <br />
            <span>next level.</span>
          </h1>

          <p>
            Connect with experienced mentors, build your
            skills, and turn your ambitions into achievements.
          </p>

          <div className="auth-feature">
            <span className="auth-feature-icon">✦</span>
            <div>
              <strong>Learn from the best</strong>
              <p>Guidance that moves you forward.</p>
            </div>
          </div>

          <div className="auth-feature">
            <span className="auth-feature-icon">↗</span>
            <div>
              <strong>Grow with confidence</strong>
              <p>Your goals deserve a clear direction.</p>
            </div>
          </div>
        </div>

        <form className="auth-card" onSubmit={handleSubmit}>
          <div className="auth-card-heading">
            <span className="auth-mini-label">
              WELCOME BACK
            </span>
            <h2>Sign in to Throne8</h2>
            <p>Enter your details to access your account.</p>
          </div>

          {error && (
            <div className="auth-error" role="alert">
              <span>!</span>
              {error}
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="auth-field">
            <div className="auth-label-row">
              <label htmlFor="password">Password</label>
            </div>

            <div className="auth-password-wrap">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />

              <button
                type="button"
                className="auth-show-password"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={
                  showPassword ? "Hide password" : "Show password"
                }
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="auth-spinner"></span>
                Signing in...
              </>
            ) : (
              <>
                Sign in <span>→</span>
              </>
            )}
          </button>

          <div className="auth-divider">
            <span>NEW TO THRONE8?</span>
          </div>

          <p className="auth-register-text">
            Don't have an account?{" "}
            <Link to="/register">Create account</Link>
          </p>

          <Link to="/" className="auth-home-link">
            ← Back to home
          </Link>
        </form>
      </section>

      <footer className="auth-footer">
        © {new Date().getFullYear()} Throne8. Empowering your journey.
      </footer>
    </main>
  );
}

export default Login;
