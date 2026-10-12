
import { useEffect, useState } from "react";
import {
  Routes,
  Route,
  useNavigate,
  Link,
} from "react-router-dom";

import { useAuth } from "./context/useAuth";
import api from "./services/api";
import Login from "./pages/Login";
import Register from "./pages/Register";
import StudentDashboard from "./pages/StudentDashboard";
import Mentors from "./pages/Mentors";
import MyBookings from "./pages/MyBookings";
import MyPayments from "./pages/MyPayments";
import MentorDashboard from "./pages/MentorDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AdminMentors from "./pages/AdminMentors";
import AdminPayouts from "./pages/AdminPayouts";
import "./index.css";

function Home() {
  const [apiStatus, setApiStatus] = useState("checking");

  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await api.get("/health");

        setApiStatus(
          response.data.success ? "connected" : "error"
        );
      } catch (error) {
        console.error("Backend connection failed:", error);
        setApiStatus("error");
      }
    };

    checkBackend();
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="app">
      {/* Navbar */}
      <header className="navbar">
        <Link className="logo" to="/">
          THRONE<span>8</span>
        </Link>

        <nav>
          <a href="#home">Home</a>
          <a href="#features">Features</a>
          <a href="#about">About</a>
        </nav>

        {/* Login status ke according buttons */}
        <div className="nav-actions">
          {user ? (
            <>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => navigate("/dashboard")}
              >
                My Dashboard
              </button>

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
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => navigate("/login")}
              >
                Login
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate("/register")}
              >
                Get Started
              </button>
            </>
          )}
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="hero" id="home">
          <div className="hero-content">
            <p className="eyebrow">
              YOUR CAREER. YOUR FUTURE.
            </p>

            <h1>
              Learn from mentors.
              <br />
              <span>Grow with confidence.</span>
            </h1>

            <p className="hero-description">
              Connect with experienced mentors, book
              mentorship sessions, and take the next
              step in your career journey.
            </p>

            <div className="hero-actions">
              <button
                type="button"
                className="btn btn-primary btn-large"
                onClick={() => navigate("/mentors")}
              >
                Explore Mentors →
              </button>

              <button
                type="button"
                className="btn btn-outline btn-large"
                onClick={() => navigate("/register")}
              >
                Become a Mentor
              </button>
            </div>

            <div className="trust-note">
              Personalized guidance. Meaningful growth.
            </div>
          </div>

          <div className="hero-visual">
            <div className="visual-card">
              <div className="visual-icon">✦</div>

              <p className="visual-label">
                YOUR NEXT CHAPTER
              </p>

              <h2>
                Great things happen when you learn together.
              </h2>

              <div className="visual-line" />

              <p className="visual-footer">
                Discover. Connect. Achieve.
              </p>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="features" id="features">
          <p className="eyebrow">WHY THRONE8?</p>

          <h2>
            Your growth starts with the right guidance.
          </h2>

          <div className="feature-grid">
            <article className="feature-card">
              <div className="feature-icon">01</div>

              <h3>Find Your Mentor</h3>

              <p>
                Discover mentors who can guide your
                learning and career goals.
              </p>
            </article>

            <article className="feature-card">
              <div className="feature-icon">02</div>

              <h3>Book a Session</h3>

              <p>
                Choose a suitable slot and manage your
                mentorship bookings.
              </p>
            </article>

            <article className="feature-card">
              <div className="feature-icon">03</div>

              <h3>Grow Your Skills</h3>

              <p>
                Get personalized guidance and work
                towards your career goals.
              </p>
            </article>
          </div>
        </section>

        {/* Backend Status */}
        <section className="backend-status" id="about">
          <div>
            <p className="eyebrow">SYSTEM STATUS</p>

            <h2>Backend Connection</h2>

            <p>
              Checking your existing THRONE8 API.
            </p>
          </div>

          <div className={`status status-${apiStatus}`}>
            <span className="status-dot" />

            {apiStatus === "checking" &&
              "Checking connection..."}

            {apiStatus === "connected" &&
              "Backend connected"}

            {apiStatus === "error" &&
              "Connection failed"}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer>
        <Link className="logo" to="/">
          THRONE<span>8</span>
        </Link>

        <p>
          Empowering your journey through mentorship.
        </p>

        <p>© 2026 THRONE8 Mentorship</p>
      </footer>
    </div>
  );
}

function NotFound() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Page not found</h1>

        <p>
          The page you are looking for does not exist.
        </p>

        <Link to="/">Back to Home</Link>
      </div>
    </main>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />

      <Route path="/login" element={<Login />} />

      <Route path="/register" element={<Register />} />

      <Route path="/dashboard" element={<StudentDashboard />}/>

      <Route path="/mentors" element={<Mentors />} />

      <Route path="/my-bookings" element={<MyBookings />} />

      <Route path="/my-payments" element={<MyPayments />} />

      <Route path="/mentor-dashboard" element={<MentorDashboard />}/>

      <Route path="/admin-dashboard" element={<AdminDashboard />} />

      <Route path="/admin/mentors" element={<AdminMentors />}/>

      <Route path="/admin/payouts" element={<AdminPayouts />}/>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;