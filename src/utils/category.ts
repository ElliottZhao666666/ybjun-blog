export const CATEGORY_SEPARATOR = " / ";

export type CategoryPath = string[];

type CategoryInput =
    | string
    | string[]
    | Record<string, unknown>
    | Array<unknown>
    | null
    | undefined;

export function getCategoryPathParts(category: CategoryInput): CategoryPath | null {
    if (!category) return null;
    if (typeof category === "string") {
        const trimmed = category.trim();
        if (!trimmed) return null;
        const parts = trimmed
            .split(CATEGORY_SEPARATOR)
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
        return parts.length > 0 ? parts : null;
    }
    if (Array.isArray(category)) {
        const stringItems = category.filter((item) => typeof item === "string") as string[];
        if (stringItems.length === category.length) {
            const parts = stringItems
                .map((item) => item.trim())
                .filter((item) => item.length > 0);
            return parts.length > 0 ? parts : null;
        }
        for (const item of category) {
            const parts = getCategoryPathParts(item as CategoryInput);
            if (parts && parts.length > 0) return parts;
        }
        return null;
    }
    if (typeof category === "object") {
        const keys = Object.keys(category);
        for (const key of keys) {
            const name = key.trim();
            if (!name) continue;
            const child = (category as Record<string, unknown>)[key];
            const childParts = getCategoryPathParts(child as CategoryInput);
            return childParts ? [name, ...childParts] : [name];
        }
        return null;
    }
    return null;
}

export function getCategoryPathLabel(category: string | string[] | null | undefined): string | null {
    const parts = getCategoryPathParts(category);
    return parts ? parts.join(CATEGORY_SEPARATOR) : null;
}

export function categoryMatches(category: string | string[] | null | undefined, selected: string | string[], uncategorized = '未分类'): boolean {
    const actual = getCategoryPathParts(category) || [uncategorized];
    const expected = getCategoryPathParts(selected) || [uncategorized];
    return expected.length <= actual.length && expected.every((part, index) => actual[index] === part);
}

export type CategoryTreeItem = {
    name: string;
    count: number;
    path: CategoryPath;
    url: string;
    children: CategoryTreeItem[];
};

export function buildCategoryTree(categories: CategoryInput[], uncategorized: string, makeUrl: (path: string[]) => string): CategoryTreeItem[] {
    type Node = { name: string; count: number; path: string[]; children: Map<string, Node> };
    const root = new Map<string, Node>();
    for (const category of categories) {
        const parts = getCategoryPathParts(category) || [uncategorized];
        let level = root;
        const path: string[] = [];
        for (const name of parts) {
            path.push(name);
            let node = level.get(name);
            if (!node) { node = { name, count: 0, path: [...path], children: new Map() }; level.set(name, node); }
            node.count += 1;
            level = node.children;
        }
    }
    const build = (level: Map<string, Node>): CategoryTreeItem[] => [...level.values()]
        .sort((a,b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
        .map(node => ({ name: node.name, count: node.count, path: node.path, url: makeUrl(node.path), children: build(node.children) }));
    return build(root);
}
