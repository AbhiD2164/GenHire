import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getFeed, getCommunities } from "../api/network";
import { searchPeople } from "../api/auth";
import { listJobs } from "../api/jobs";

function itemsFrom(response) {
  return response?.results || response || [];
}

export default function Search() {
  const [params] = useSearchParams();
  const query = (params.get("q") || "").trim();
  const [results, setResults] = useState({ people: [], jobs: [], communities: [], posts: [] });
  const [failedCategories, setFailedCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) {
      setResults({ people: [], jobs: [], communities: [], posts: [] });
      setFailedCategories([]);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setFailedCategories([]);
    const isHashtag = query.startsWith("#");
    Promise.allSettled([
      searchPeople({ search: query.replace(/^#/, "") }),
      listJobs({ search: query.replace(/^#/, "") }),
      getCommunities({ search: query.replace(/^#/, "") }),
      getFeed(isHashtag
        ? { hashtag: query.slice(1) }
        : { search: query }),
    ]).then(([people, jobs, communities, posts]) => {
      if (active) {
        const responses = [people, jobs, communities, posts].map((result, index) => {
          if (result.status === "fulfilled") return result.value;
          console.error(`Search category ${index + 1} failed.`, result.reason);
          return [];
        });
        setFailedCategories(
          [people, jobs, communities, posts]
            .map((result, index) => result.status === "rejected"
              ? ["people", "jobs", "communities", "posts"][index]
              : null)
            .filter(Boolean)
        );
        setResults({
          people: itemsFrom(responses[0]),
          jobs: itemsFrom(responses[1]),
          communities: itemsFrom(responses[2]),
          posts: itemsFrom(responses[3]),
        });
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [query]);

  const total = Object.values(results).reduce((count, list) => count + list.length, 0);

  return (
    <div className="page container">
      <div className="page-header">
        <div>
          <span className="eyebrow">Explore GenHire</span>
          <h1>Search results</h1>
          <p className="muted">{query ? `Results for “${query}”` : "Search people, jobs, communities, and posts."}</p>
        </div>
      </div>
      {loading ? (
        <div className="card empty-state"><div className="spinner" /></div>
      ) : !query ? (
        <div className="card empty-state">Enter a search term in the navigation bar.</div>
      ) : total === 0 ? (
        <div className="card empty-state">
          {failedCategories.length
            ? "Search could not load results. Please try again."
            : "No results found. Try a different name, skill, company, or hashtag."}
        </div>
      ) : (
        <>
        {failedCategories.length > 0 && (
          <p className="text-sm" role="status">
            Some results could not be loaded: {failedCategories.join(", ")}.
          </p>
        )}
        <div className="search-results-grid">
          <ResultSection title="People" items={results.people}>
            {(person) => (
              <Link key={person.id} to={`/profile/${person.id}`} className="search-result-item">
                <strong>{person.first_name || person.last_name
                  ? `${person.first_name || ""} ${person.last_name || ""}`.trim()
                  : person.username}</strong>
                <span>{person.headline || "Professional member"}</span>
                {person.industry && <small>{person.industry}</small>}
              </Link>
            )}
          </ResultSection>
          <ResultSection title="Jobs" items={results.jobs}>
            {(job) => (
              <Link key={job.id} to={`/jobs/${job.id}`} className="search-result-item">
                <strong>{job.title}</strong>
                <span>{job.company_name || "Company not specified"} · {job.location || "Location flexible"}</span>
              </Link>
            )}
          </ResultSection>
          <ResultSection title="Communities" items={results.communities}>
            {(community) => (
              <Link key={community.id} to="/network" className="search-result-item">
                <strong>{community.name}</strong>
                <span>{community.description || "Professional community"} · {community.members_count || 0} members</span>
              </Link>
            )}
          </ResultSection>
          <ResultSection title="Posts" items={results.posts}>
            {(post) => (
              <Link key={post.id} to="/feed" className="search-result-item">
                <strong>{post.author_name || "GenHire member"}</strong>
                <span>{post.content}</span>
              </Link>
            )}
          </ResultSection>
        </div>
        </>
      )}
    </div>
  );
}

function ResultSection({ title, items, children }) {
  return (
    <section className="card search-result-section">
      <h2>{title} <span className="text-xs muted">{items.length}</span></h2>
      {items.length ? items.slice(0, 10).map(children) : <p className="text-sm muted">No matches.</p>}
    </section>
  );
}
