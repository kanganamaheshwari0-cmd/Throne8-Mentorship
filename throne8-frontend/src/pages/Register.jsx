
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import "./Register.css";

function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const response = await register(name, email, password);

      if (!response.success) {
        throw new Error(response.message || "Registration failed");
      }

      setMessage("Registration successful! Redirecting to login...");

      setTimeout(() => {
        navigate("/login");
      }, 1000);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Registration failed"
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
            YOUR FUTURE STARTS HERE
          </span>

          <h1>
            Build your
            <br />
            <span>next chapter.</span>
          </h1>

          <p>
            Join Throne8 to connect with experienced mentors,
            discover new opportunities, and take the next step
            toward your goals.
          </p>

          <div className="auth-feature">
            <span className="auth-feature-icon">✦</span>
            <div>
              <strong>A community that inspires</strong>
              <p>Learn, connect, and grow together.</p>
            </div>
          </div>

          <div className="auth-feature">
            <span className="auth-feature-icon">↗</span>
            <div>
              <strong>Your growth, your journey</strong>
              <p>Make every learning opportunity count.</p>
            </div>
          </div>
        </div>

        <form className="auth-card" onSubmit={handleSubmit}>
          <div className="auth-card-heading">
            <span className="auth-mini-label">
              GET STARTED
            </span>

            <h2>Create your account</h2>

            <p>
              Fill in your details to join the Throne8 community.
            </p>
          </div>

          {error && (
            <div className="auth-error" role="alert">
              <span>!</span>
              {error}
            </div>
          )}

          {message && (
            <div className="auth-success" role="status">
              <span>✓</span>
              {message}
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="register-name">Full name</label>

            <input
              id="register-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              autoComplete="name"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="register-email">Email address</label>

            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="register-password">Password</label>

            <div className="auth-password-wrap">
              <input
                id="register-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
                minLength={8}
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

            <p className="auth-field-hint">
              Use at least 8 characters.
            </p>
          </div>

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="auth-spinner"></span>
                Creating account...
              </>
            ) : (
              <>
                Create account <span>→</span>
              </>
            )}
          </button>

          <div className="auth-divider">
            <span>ALREADY A MEMBER?</span>
          </div>

          <p className="auth-register-text">
            Already registered?{" "}
            <Link to="/login">Sign in</Link>
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

export default Register;
