import { User } from "lucide-react";

function Navbar() {
  return (
    <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-8 shrink-0">
      <div className="flex items-center gap-4 flex-1">
        {/* Placeholder for future left-side items */}
      </div>

      <div className="flex items-center gap-4">
        <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden cursor-pointer">
          <User className="h-4 w-4 text-slate-600" />
        </div>
      </div>
    </div>
  );
}

export default Navbar;