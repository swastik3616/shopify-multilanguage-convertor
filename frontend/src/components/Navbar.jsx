import { Bell, Search, User } from "lucide-react";

function Navbar() {
  return (
    <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-8 shrink-0">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-64 hidden sm:block">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-[#008060] focus:ring-1 focus:ring-[#008060] transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-100 hidden sm:block">
          Demo Store
        </div>
        
        <button className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-red-500 border-2 border-white"></span>
        </button>
        
        <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden cursor-pointer">
          <User className="h-4 w-4 text-slate-600" />
        </div>
      </div>
    </div>
  );
}

export default Navbar;