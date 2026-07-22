import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Languages,
  Plug,
  ArrowRightLeft,
  Globe,
  BarChart3,
  Settings,
  History,
  Store,
  Search,
  DollarSign
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function Sidebar() {
  const location = useLocation();

  const overviewLinks = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Analytics", path: "/analytics", icon: BarChart3 },
    { name: "Audit History", path: "/audit-history", icon: History },
  ];

  const configLinks = [
    { name: "Languages", path: "/languages", icon: Languages },
    { name: "Providers", path: "/providers", icon: Plug },
    { name: "Currency", path: "/currency", icon: DollarSign },
  ];

  const contentLinks = [
    { name: "Translations", path: "/translations", icon: Globe },
  ];

  const seoLinks = [
    { name: "SEO Manager", path: "/seo", icon: Search },
  ];

  const systemLinks = [
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
      <div className="h-16 flex items-center px-6 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-[#008060] flex items-center justify-center">
            <span className="text-white font-bold text-lg">T</span>
          </div>
          <span className="font-semibold text-slate-900">Translator</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 px-3">Overview</div>
          {overviewLinks.map((link) => <NavLink key={link.path} item={link} />)}
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 px-3">Configuration</div>
          {configLinks.map((link) => <NavLink key={link.path} item={link} />)}
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 px-3">Content Translation</div>
          {contentLinks.map((link) => <NavLink key={link.path} item={link} />)}
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 px-3">SEO Management</div>
          {seoLinks.map((link) => <NavLink key={link.path} item={link} />)}
        </div>

        <div className="flex flex-col gap-1 mt-auto pt-4 border-t border-slate-100">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 px-3">System</div>
          {systemLinks.map((link) => <NavLink key={link.path} item={link} />)}
        </div>
      </div>
    </div>
  );
}

export default Sidebar;