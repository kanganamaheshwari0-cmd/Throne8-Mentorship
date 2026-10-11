
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";

function StudentDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="app">
      <header className="navbar">
        <Link className="logo" to="/">
          THRONE<span>8</span>
        </Link>

        <nav>
          <Link to="/">Home</Link>
        </nav>

        <div className="nav-actions">
          <button
            className="btn btn-outline"
            onClick={() => navigate("/")}
          >
            Home
          </button>

          <button
            className="btn btn-primary"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-page">
        <section className="dashboard-welcome">
          <p className="eyebrow">STUDENT DASHBOARD</p>

          <h1>
            Welcome{user?.name ? `, ${user.name}` : ""}!
          </h1>

          <p>
            Your mentorship journey starts here.
            Explore mentors, manage your bookings,
            and track your payments.
          </p>
        </section>

        <section className="dashboard-grid">
          <article className="dashboard-card">
            <div className="dashboard-card-icon">✦</div>
            <h2>Find a Mentor</h2>
            <p>
              Discover experienced mentors for your
              learning and career goals.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => navigate("/mentors")}
            >
              Explore Mentors →
            </button>
          </article>

          <article className="dashboard-card">
            <div className="dashboard-card-icon">▣</div>
            <h2>My Bookings</h2>
            <p>
              View and manage your mentorship sessions.
            </p>
            <button
              className="btn btn-outline"
              onClick={() => navigate("/my-bookings")}
            >
              View Bookings →
            </button>
          </article>

          <article className="dashboard-card">
            <div className="dashboard-card-icon">₹</div>
            <h2>My Payments</h2>
            <p>
              Check your mentorship payment records.
            </p>
            <button
              className="btn btn-outline"
              onClick={() => navigate("/my-payments")}
            >
              View Payments →
            </button>
          </article>

          <article className="dashboard-card">
            <div className="dashboard-card-icon">◎</div>
            <h2>My Profile</h2>
            <p>
              View your account and student details.
            </p>
            <p className="profile-detail">
              <strong>Name:</strong>{" "}
              {user?.name || "Student"}
            </p>
            <p className="profile-detail">
              <strong>Email:</strong>{" "}
              {user?.email || "Not available"}
            </p>
          </article>
        </section>
      </main>

      <footer>
        <Link className="logo" to="/">
          THRONE<span>8</span>
        </Link>
        <p>Empowering your journey through mentorship.</p>
        <p>© 2026 THRONE8 Mentorship</p>
      </footer>
    </div>
  );
}

export default StudentDashboard;
