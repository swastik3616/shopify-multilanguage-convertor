import { Link } from "react-router-dom";
import {
  FaHome,
  FaLanguage,
  FaPlug,
  FaExchangeAlt,
  FaTasks,
  FaChartBar,
  FaCog
} from "react-icons/fa";

function Sidebar() {
  return (
    <div className="sidebar">
      <h2>Translator</h2>

      <Link to="/"><FaHome /> Dashboard</Link>
      <Link to="/languages"><FaLanguage /> Languages</Link>
      <Link to="/providers"><FaPlug /> Providers</Link>
      <Link to="/translations"><FaExchangeAlt /> Translations</Link>
      <Link to="/jobs"><FaTasks /> Jobs</Link>
      <Link to="/analytics"><FaChartBar /> Analytics</Link>
      <Link to="/settings"><FaCog /> Settings</Link>
      <Link to="/audit-history"><FaCog /> Audit History</Link>
      <Link to="/store-settings"><FaCog /> Store Settings</Link>
    </div>
  );
}

export default Sidebar;