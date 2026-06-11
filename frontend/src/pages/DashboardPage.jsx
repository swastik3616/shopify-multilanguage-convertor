function DashboardPage() {
  const stats = [
    {
      title: "Languages",
      value: 4,
    },
    {
      title: "Providers",
      value: 1,
    },
    {
      title: "Translations",
      value: 12,
    },
    {
      title: "Jobs",
      value: 0,
    },
  ];

  return (
    <div>
      <h1>Dashboard</h1>

      <div className="dashboard-grid">
        {stats.map((item, index) => (
          <div className="stat-card" key={index}>
            <h3>{item.title}</h3>
            <h1>{item.value}</h1>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DashboardPage;