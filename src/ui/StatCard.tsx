interface StatCardProps {
  label: string;
  value: number;
}

export function StatCard({ label, value }: StatCardProps) {
  return (
    <article className="card">
      <h3>{label}</h3>
      <p>{value}</p>
    </article>
  );
}
