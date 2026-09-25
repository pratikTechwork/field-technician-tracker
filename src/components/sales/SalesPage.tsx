import SalesDashboard from "./SalesDashboard";

export default function SalesPage() {
  return (
    <main className="main">
      <div className="reports-intro">
        <h1 className="reports-page-title">Sales Visit Dashboard</h1>
        <p className="reports-page-desc">
          Client visits logged by the sales team — punch-in / punch-out time,
          location, and visit details.
        </p>
      </div>

      <div className="report-panel">
        <SalesDashboard />
      </div>
    </main>
  );
}
