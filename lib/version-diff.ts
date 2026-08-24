/**
 * Generic diff for the array-of-objects JSONB fields on ProductVersion
 * (dimensions, materials, finishes, components, specifications).
 *
 * Each entry is matched between two versions by its "key field" (e.g. a
 * dimension's `name`, a material's `component`). Entries are classified as
 * added, removed, or changed (any other field differs), or unchanged.
 */

type Entry = Record<string, unknown>;

export type FieldDiff = {
  key: string;
  status: "added" | "removed" | "changed" | "unchanged";
  before: Entry | null;
  after: Entry | null;
};

export function diffEntryLists(
  before: Entry[],
  after: Entry[],
  keyField: string
): FieldDiff[] {
  const beforeMap = new Map(before.map((e) => [String(e[keyField]), e]));
  const afterMap = new Map(after.map((e) => [String(e[keyField]), e]));

  const allKeys = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  const results: FieldDiff[] = [];

  for (const key of allKeys) {
    const b = beforeMap.get(key) ?? null;
    const a = afterMap.get(key) ?? null;

    if (b && !a) {
      results.push({ key, status: "removed", before: b, after: null });
    } else if (!b && a) {
      results.push({ key, status: "added", before: null, after: a });
    } else if (b && a) {
      const changed = JSON.stringify(b) !== JSON.stringify(a);
      results.push({ key, status: changed ? "changed" : "unchanged", before: b, after: a });
    }
  }

  // Stable order: changed/added/removed first, unchanged last, alphabetical within group.
  const order = { added: 0, removed: 1, changed: 2, unchanged: 3 };
  return results.sort((x, y) => order[x.status] - order[y.status] || x.key.localeCompare(y.key));
}

export type VersionComparison = {
  dimensions: FieldDiff[];
  materials: FieldDiff[];
  finishes: FieldDiff[];
  components: FieldDiff[];
  specifications: FieldDiff[];
  descriptionChanged: boolean;
};

export function compareVersions(
  before: {
    dimensions: unknown;
    materials: unknown;
    finishes: unknown;
    components: unknown;
    specifications: unknown;
    description: string | null;
  },
  after: {
    dimensions: unknown;
    materials: unknown;
    finishes: unknown;
    components: unknown;
    specifications: unknown;
    description: string | null;
  }
): VersionComparison {
  return {
    dimensions: diffEntryLists(
      (before.dimensions as Entry[]) ?? [],
      (after.dimensions as Entry[]) ?? [],
      "name"
    ),
    materials: diffEntryLists(
      (before.materials as Entry[]) ?? [],
      (after.materials as Entry[]) ?? [],
      "component"
    ),
    finishes: diffEntryLists(
      (before.finishes as Entry[]) ?? [],
      (after.finishes as Entry[]) ?? [],
      "component"
    ),
    components: diffEntryLists(
      (before.components as Entry[]) ?? [],
      (after.components as Entry[]) ?? [],
      "name"
    ),
    specifications: diffEntryLists(
      (before.specifications as Entry[]) ?? [],
      (after.specifications as Entry[]) ?? [],
      "key"
    ),
    descriptionChanged: (before.description ?? "") !== (after.description ?? ""),
  };
}
