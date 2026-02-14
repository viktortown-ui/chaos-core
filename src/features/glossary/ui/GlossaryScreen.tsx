import { glossaryEntries } from '../model/glossary';

export function GlossaryScreen() {
  return (
    <section className="stack">
      <h2>Glossary</h2>
      <div className="stack">
        {glossaryEntries.map((entry) => (
          <article key={entry.term} className="card stack">
            <h3>{entry.term}</h3>
            <p>{entry.definition}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
