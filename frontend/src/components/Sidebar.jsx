import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Languages,
  Plug,
  ArrowRightLeft,
  ListTodo,
  BarChart3,
  Settings,
  History,
  Store
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function Sidebar() {
  const location = useLocation();

  const links = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Languages", path: "/languages", icon: Languages },
    { name: "Providers", path: "/providers", icon: Plug },
    { name: "Translations", path: "/translations", icon: ArrowRightLeft },
    { name: "Jobs", path: "/jobs", icon: ListTodo },
    { name: "Analytics", path: "/analytics", icon: BarChart3 },
    { name: "Audit History", path: "/audit-history", icon: History },
  ];

  const bottomLinks = [
    { name: "Store Settings", path: "/store-settings", icon: Store },
    { name: "Settings", path: "/settings", icon: Settings },
  ];

  const NavLink = ({ item }) => {
    const isActive = location.pathname === item.path;
    const Icon = item.icon;
    return (
      <Link
        to={item.path}
        className={twMerge(
          clsx(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            isActive
              ? "bg-slate-100 text-slate-900"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          )
        )}
      >
        <Icon className={clsx("h-5 w-5", isActive ? "text-[#008060]" : "text-slate-400")} />
        {item.name}
      </Link>
    );
  };

  return (
    <div className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex">
      <div className="h-16 flex items-center px-6 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-[#008060] flex items-center justify-center">
            <span className="text-white font-bold text-lg">T</span>
          </div>
          <span className="font-semibold text-slate-900">Translator</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3">Menu</div>
        {links.map((link) => (
          <NavLink key={link.path} item={link} />
        ))}
      </div>

      <div className="p-3 border-t border-slate-200 flex flex-col gap-1">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3">System</div>
        {bottomLinks.map((link) => (
          <NavLink key={link.path} item={link} />
        ))}
      </div>
    </div>
  );
}

export default Sidebar;