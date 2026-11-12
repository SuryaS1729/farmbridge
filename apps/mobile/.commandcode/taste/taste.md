# Taste

- Prefers tightly scoped changes: when asked to finish or fix a file, stay inside that file — do not create new pages/routes or extra files unless explicitly requested. Confidence: 0.6
- Wants an honest correctness assessment of existing code (e.g. "tell me if it's functionally wired up well") in addition to the requested styling/implementation work, rather than silent edits. Confidence: 0.5
- Edits files himself in his own editor while the agent works, so he expects the agent to re-read the file from disk before editing and to merge its changes onto his saved version rather than overwrite from memory. Confidence: 0.65
- Wants to approve the approach first: state the concrete plan (what changes, in which file, and any assumptions) before touching code when he says so. Confidence: 0.7
- Prefers country-specific input UI over free-form entry: show a fixed country prefix (e.g. non-editable "+91" plus divider), let the user type only the national digits, strip non-digits and cap the length, and construct the canonical E.164 value in the client to send to the backend — keeping the server free of normalization logic. Confidence: 0.6
