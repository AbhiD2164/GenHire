import { Link } from "react-router-dom";

const highlights = [
  ["01", "Signal-first matching", "Resume text becomes structured evidence, not a keyword pile."],
  ["02", "Clearer job decisions", "People can review applications and communicate with applicants directly."],
  ["03", "One professional graph", "Jobs, conversations, and career momentum stay in one place."],
];

export default function Landing() {
  return (
    <main className="landing-page">
      <section className="landing-hero">
        <div className="container landing-hero-grid">
          <div className="landing-copy">
            <span className="eyebrow">The signal layer for ambitious work</span>
            <h1>Find work that fits the person, not just the keywords.</h1>
            <p>
              GenHire brings intelligent resume reading, thoughtful shortlisting, and a real professional network into one focused workspace.
            </p>
            <div className="landing-actions">
              <Link to="/signup" className="btn btn-primary">Create your profile</Link>
              <Link to="/jobs" className="landing-text-link">Explore open roles <span aria-hidden="true">↗</span></Link>
            </div>
            <div className="landing-proof">
              <span className="proof-dot" />
              <span>Built for professionals and organizations across every industry</span>
            </div>
          </div>
          <div className="signal-board" aria-label="GenHire matching overview">
            <div className="board-topline"><span>GENHIRE / MATCH ENGINE</span><span className="board-status">● LIVE</span></div>
            <div className="board-role"><span>Senior Product Designer</span><strong>92%</strong></div>
            <div className="board-meter"><span style={{ width: "92%" }} /></div>
            <div className="board-grid">
              <div><span>Resume signal</span><strong>Strong</strong></div>
              <div><span>Role fit</span><strong>High</strong></div>
              <div><span>Experience</span><strong>6.4 yrs</strong></div>
              <div><span>Work mode</span><strong>Hybrid</strong></div>
            </div>
            <div className="board-profile">
              <div className="board-avatar">AK</div>
              <div><strong>Aria Khan</strong><span>Product, design systems, research</span></div>
              <span className="board-pill">SHORTLISTED</span>
            </div>
            <div className="board-footer"><span>Skills detected</span><div><i>Figma</i><i>Research</i><i>Systems</i></div></div>
          </div>
        </div>
      </section>

      <section className="landing-strip">
        <div className="container landing-highlights">
          {highlights.map(([number, title, description]) => (
            <article key={number} className="highlight-item">
              <span>{number}</span><div><h3>{title}</h3><p>{description}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-bottom container">
        <div><span className="eyebrow">Start with intent</span><h2>Your next move should feel more informed.</h2></div>
        <div className="landing-bottom-actions"><Link to="/login" className="btn btn-outline">Log in</Link><Link to="/signup" className="btn btn-primary">Join GenHire</Link></div>
      </section>
    </main>
  );
}
