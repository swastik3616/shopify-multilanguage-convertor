function StatCard({ title, value, icon: Icon, trend }) {
    return (
        <div className="card-container p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-500">{title}</h3>
                {Icon && (
                    <div className="p-2 bg-slate-50 rounded-md">
                        <Icon className="h-4 w-4 text-slate-400" />
                    </div>
                )}
            </div>
            <div className="flex items-baseline gap-2">
                <h2 className="text-3xl font-bold text-slate-900">{value}</h2>
                {trend && (
                    <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                        {trend}
                    </span>
                )}
            </div>
        </div>
    );
}
export default StatCard;