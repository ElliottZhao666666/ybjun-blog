export type VisibilityRule = { mode: 'include' | 'exclude'; paths: string[] };

export function matchesWidgetVisibility(rule: VisibilityRule | undefined, currentPath?: string): boolean {
    if (!rule || !currentPath) return true;
    let path = currentPath.startsWith('/') ? currentPath : '/' + currentPath;
    if (path.length > 1) path = path.replace(/\/+$/, '');
    const matches = rule.paths.some(pattern => {
        try { return new RegExp(pattern).test(path); }
        catch { console.warn('侧栏显示规则包含无效的正则表达式：', pattern); return false; }
    });
    return rule.mode === 'include' ? matches : !matches;
}
