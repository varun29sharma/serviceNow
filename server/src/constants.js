/**
 * Shared vocabulary — ServiceNow terms, used across the whole backend.
 *
 * Case · assignmentGroup · Assignment Rule (triage lookup) · SLA target
 * Status values are exactly: New / Assigned / In Progress / Resolved
 */
export const CATEGORIES = [
  'Mental Health',
  'Academic',
  'Financial',
  'Housing',
  'Other',
];

export const ASSIGNMENT_GROUPS = [
  'Counseling',
  'Academic Advising',
  'Financial Aid',
  'Peer Support',
];

export const URGENCIES = ['Low', 'Medium', 'High'];

export const STATUSES = ['New', 'Assigned', 'In Progress', 'Resolved'];

/** SLA target windows in hours, keyed by urgency. createdAt + window = slaTarget. */
export const SLA_HOURS = { High: 2, Medium: 24, Low: 72 };
