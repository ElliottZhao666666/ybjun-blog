import { h } from "hastscript";
import { SKIP, visit } from "unist-util-visit";

const supportedDirectives = new Set([
	"spoiler", "github", "music", "note", "tip", "important", "warning", "caution",
]);

export function parseDirectiveNode() {
	return (tree, file) => {
		const source = String(file.value ?? "");
		visit(tree, (node, index, parent) => {
			if (
				node.type === "containerDirective" ||
				node.type === "leafDirective" ||
				node.type === "textDirective"
			) {
				// Ordinary times/ratios such as 01:16 and 16:9 also match directive syntax.
				// Keep unregistered directives verbatim instead of emitting invalid HTML tags.
				if (!supportedDirectives.has(node.name)) {
					if (parent && typeof index === "number") {
						const { start, end } = node.position ?? {};
						parent.children[index] = {
							type: "text",
							value: typeof start?.offset === "number" && typeof end?.offset === "number"
								? source.slice(start.offset, end.offset)
								: `:${node.name}`,
							position: node.position,
						};
					}
					return SKIP;
				}
				// biome-ignore lint/suspicious/noAssignInExpressions: <check later>
				const data = node.data || (node.data = {});
				node.attributes = node.attributes || {};
				if (
					node.children.length > 0 &&
					node.children[0].data &&
					node.children[0].data.directiveLabel
				) {
					// Add a flag to the node to indicate that it has a directive label
					node.attributes["has-directive-label"] = true;
				}
				const hast = h(node.name, node.attributes);

				data.hName = hast.tagName;
				data.hProperties = hast.properties;
			}
		});
	};
}
