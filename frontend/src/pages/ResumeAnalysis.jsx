import { useState } from 'react';
import { analyzeResume } from '../api/ats';
import { useToast } from '../context/ToastContext';
import ResumeScoreCard from '../components/ResumeScoreCard';
import SuggestionsList from '../components/SuggestionsList';

export default function ResumeAnalysis() {
  const [file, setFile] = useState(null);
  const [jobId, setJobId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return showToast('Please upload a resume file.', 'error');
    setLoading(true);
    try {
      const data = await analyzeResume({ resumeFile: file, jobId: jobId || undefined });
      setResult(data);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Analysis failed.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page container">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 18 }}>
        <div className="card" style={{ padding: 20 }}>
          <h2>Resume Analysis</h2>
          <p className="muted">Upload your resume to get an ATS score and improvement suggestions.</p>
          <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
            <div className="field">
              <label>Resume (PDF / DOCX)</label>
              <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files[0])} />
            </div>
            <div className="field">
              <label>Optional: Job ID to compare against</label>
              <input value={jobId} onChange={(e) => setJobId(e.target.value)} placeholder="123" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Analyzing…' : 'Analyze'}</button>
              <button type="button" className="btn btn-outline" onClick={() => { setFile(null); setResult(null); setJobId(''); }}>Reset</button>
            </div>
          </form>

          {result && (
            <div style={{ marginTop: 20 }}>
              <h3>Results</h3>
              <p className="muted" style={{ marginBottom: 12 }}>Detected skills: {result.present_skills?.join(', ') || 'None'}</p>
              <div style={{ marginTop: 8 }}>
                <ResumeScoreCard score={result.score} />
              </div>
              <div style={{ marginTop: 12 }}>
                <SuggestionsList suggestions={result.tips} />
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="card" style={{ padding: 16 }}>
            <h4>Tips</h4>
            <div className="muted" style={{ marginTop: 8 }}>
              - Mention concrete projects and technologies used. <br />
              - Add missing required skills as keywords or project bullets. <br />
              - Prefer concise action-oriented lines for achievements.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
