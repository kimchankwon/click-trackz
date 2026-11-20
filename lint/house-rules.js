const PRAGMA = /^\s*(@ts-(expect-error|ignore|nocheck|check)|@vitest-environment|prettier-ignore|@license|@preserve|istanbul ignore|c8 ignore|#__PURE__|@__PURE__)/;
const TRIPLE_SLASH = /^\/\s*<(reference|amd-module)\b/;
const DISABLE = /^\s*eslint-disable/;

const noComments = {
  meta: {
    type: "suggestion",
    docs: { description: "AGENTS.md: no code comments of any kind. Pragmas are allowed, and an eslint-disable must say why after `--`." },
    schema: [],
    messages: {
      comment: "No code comments (AGENTS.md). Rename or restructure instead.",
      unjustified: "An eslint-disable needs a reason: `eslint-disable-next-line <rule> -- <why>`.",
    },
  },
  create(context) {
    return {
      Program() {
        const directives = new Set(context.sourceCode.getInlineConfigNodes());
        for (const comment of context.sourceCode.getAllComments()) {
          const text = comment.value;
          if (comment.type === "Line" && TRIPLE_SLASH.test(text)) continue;
          if (comment.type === "Shebang") continue;
          if (directives.has(comment)) {
            if (DISABLE.test(text) && !/\s--\s+\S/.test(text)) context.report({ loc: comment.loc, messageId: "unjustified" });
            continue;
          }
          if (PRAGMA.test(text.replace(/^\*+/, ""))) continue;
          context.report({ loc: comment.loc, messageId: "comment" });
        }
      },
    };
  },
};

const AVOIDED_WORDS = [
  [/\bbands?\b/i, "Group"],
  [/\b(users?|musicians?)\b/i, "Member"],
  [/\bplaylists?\b/i, "Setlist"],
  [/\b(metronome|beeps?)\b/i, "Click"],
  [/\bpre-?roll\b/i, "Count-in or Cue lead"],
];

const glossaryTerms = {
  meta: {
    type: "suggestion",
    docs: { description: "CONTEXT.md: people-facing text uses the glossary terms, not the words it says to avoid." },
    schema: [],
    messages: { avoid: "CONTEXT.md says to avoid \"{{word}}\" here. Say {{term}}." },
  },
  create(context) {
    const check = (node, text) => {
      for (const [pattern, term] of AVOIDED_WORDS) {
        const match = pattern.exec(text);
        if (match) context.report({ node, messageId: "avoid", data: { word: match[0], term } });
      }
    };
    const isPeopleFacing = (node) => {
      const parent = node.parent;
      if (!parent) return false;
      if (parent.type === "JSXAttribute") return parent.name.name !== "testID" && parent.name.name !== "key";
      if (parent.type === "JSXExpressionContainer") return parent.parent.type === "JSXElement" || parent.parent.type === "JSXFragment" || isPeopleFacing(parent);
      if (parent.type === "NewExpression" && parent.callee.name === "ConvexError") return true;
      if (parent.type === "CallExpression" && parent.callee.type === "Identifier" && /^(showToast|toast)$/.test(parent.callee.name)) return true;
      if (parent.type === "TemplateLiteral" || parent.type === "ConditionalExpression" || parent.type === "LogicalExpression") return isPeopleFacing(parent);
      return false;
    };
    return {
      JSXText: (node) => check(node, node.value),
      Literal: (node) => typeof node.value === "string" && isPeopleFacing(node) && check(node, node.value),
      TemplateElement: (node) => isPeopleFacing(node.parent) && check(node, node.value.cooked ?? ""),
    };
  },
};

module.exports = { meta: { name: "house" }, rules: { "no-comments": noComments, "glossary-terms": glossaryTerms } };
