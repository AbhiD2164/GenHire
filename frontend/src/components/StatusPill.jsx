const LABELS = {
  selected: "Selected",
  consider: "Consider",
  rejected: "Rejected",
  pending: "Pending",
};

export default function StatusPill({ status }) {
  return (
    <span className={`status-pill status-${status}`}>
      {LABELS[status] || status}
    </span>
  );
}
