const DIRECTIVE = /^\s*(eslint(-disable|-enable)?(-next-line|-line)?|global|globals|exported)\b/;
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
        for (const comment of context.sourceCode.getAllComments()) {
          const text = comment.value;
          if (comment.type === "Line" && TRIPLE_SLASH.test(text)) continue;
          if (comment.type === "Shebang") continue;
          if (DIRECTIVE.test(text)) {
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

module.exports = { meta: { name: "house" }, rules: { "no-comments": noComments } };
