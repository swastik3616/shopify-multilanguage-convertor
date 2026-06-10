import "../styles/dashboard.css";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

function DashboardLayout({ children }) {
  return (
    <div className="layout">
      <Sidebar />

      <div className="main-content">
        <Navbar />

        <div className="page-content">
          {children}
        </div>
      </div>
    </div>
  );
}

export default DashboardLayout;