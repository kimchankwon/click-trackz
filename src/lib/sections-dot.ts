export const showsSectionsDot = (needsSections: boolean | undefined, shownParts: readonly string[]) => needsSections === true && shownParts.length > 0;

export const anySectionsDot = (entries: readonly { needsStructure: boolean; leader: string | null }[]) =>
  entries.some((entry) => showsSectionsDot(entry.needsStructure, entry.leader ? [entry.leader] : []));
