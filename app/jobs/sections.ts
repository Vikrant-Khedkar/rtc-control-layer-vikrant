export function jobSectionPath(section: string) {
  return section === "exceptions" || section === "billing" ? `?tab=${section}` : "";
}
