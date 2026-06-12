import StatCard from "../components/StatCard";
import { Languages, Plug, ArrowRightLeft, ListTodo, MoreVertical } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { name: 'Mon', translations: 4000 },
  { name: 'Tue', translations: 3000 },
  { name: 'Wed', translations: 2000 },
  { name: 'Thu', translations: 2780 },
  { name: 'Fri', translations: 1890 },
  { name: 'Sat', translations: 2390 },
  { name: 'Sun', translations: 3490 },
];

function DashboardPage() {
  const stats = [
    {
      title: "Languages",
      value: 4,
      icon: Languages,
      trend: "+1 this week"
    },
    {
      title: "Providers",
      value: 1,
      icon: Plug,
      trend: "Active"
    },
    {
      title: "Translations",
      value: 12,
      icon: ArrowRightLeft,
      trend: "+3 today"
    },
    {
      title: "Jobs",
      value: 0,
      icon: ListTodo,
      trend: "None pending"
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Dashboard</h1>
        <button className="btn btn-primary px-4 py-2">
          New Translation
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((item, index) => (
          <StatCard key={index} {...item} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card-container p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-slate-900">Translation Volume</h3>
            <button className="p-1 hover:bg-slate-100 rounded text-slate-400">
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTranslations" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#008060" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#008060" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="translations" stroke="#008060" strokeWidth={2} fillOpacity={1} fill="url(#colorTranslations)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-container p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-slate-900">Recent Activity</h3>
            <button className="text-sm font-medium text-[#008060] hover:text-[#006e52]">View all</button>
          </div>
          <div className="flex flex-col gap-4 flex-1">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <ArrowRightLeft className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-900 font-medium">Translated Homepage</p>
                <p className="text-xs text-slate-500">English to French • 2 mins ago</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <Languages className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-900 font-medium">Added German Language</p>
                <p className="text-xs text-slate-500">Settings updated • 1 hr ago</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <Plug className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-900 font-medium">Provider updated</p>
                <p className="text-xs text-slate-500">OpenAI API Key changed • 3 hrs ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;