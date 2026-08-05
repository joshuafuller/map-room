const REQUIRED_SECTIONS = [
  "Acceptance Criteria",
  "Definition of Done",
  "Verification",
  "Validation Boundaries"
];

function sections(body) {
  const result = new Map();
  let active = null;
  for (const line of body.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      active = heading[1].trim().toLowerCase();
      result.set(active, []);
    } else if (active) {
      result.get(active).push(line);
    }
  }
  return new Map([...result].map(([key, lines]) => [key, lines.join("\n").trim()]));
}

function isPlaceholder(value) {
  const meaningful = value
    .replace(/<!--[\s\S]*?-->/g, "")
    .split(/\r?\n/)
    .filter((line) => !/^\s*[-*]\s*(?:\[\s*\])?\s*$/.test(line))
    .join("\n")
    .trim();
  return meaningful === "" || /^(?:todo|tbd|n\/a|none)[.!]?$/i.test(meaningful);
}

export function validatePullRequestBody(body) {
  if (typeof body !== "string" || body.trim() === "") return ["Pull request body is required"];
  const parsed = sections(body);
  const errors = [];
  const tracking = parsed.get("tracking");
  if (tracking === undefined) {
    errors.push("Missing section: Tracking");
  } else if (!/(?:closes|fixes|resolves|tracks|refs?|tracking)\s*:?\s+(?:joshuafuller\/map-room)?#\d+/i.test(tracking)) {
    errors.push("Tracking must link a Map Room issue, for example: Closes #123");
  }
  for (const name of REQUIRED_SECTIONS) {
    const value = parsed.get(name.toLowerCase());
    if (value === undefined) errors.push(`Missing section: ${name}`);
    else if (isPlaceholder(value)) errors.push(`Section is empty or still contains a placeholder: ${name}`);
  }
  return errors;
}

export { REQUIRED_SECTIONS };
