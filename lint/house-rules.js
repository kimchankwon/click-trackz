const PRAGMA = /^\s*(@ts-(expect-error|ignore|nocheck|check)|@vitest-environment|prettier-ignore|@license|@preserve|SPDX-License-Identifier:|@generated\b|istanbul ignore|c8 ignore|#__PURE__|@__PURE__)/;
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

const IDENTIFIER_ATTRIBUTES = new Set(["testID", "key", "nativeID", "id", "name", "href", "src", "role", "accessibilityRole", "type"]);
const COPY_KEYS = new Set(["title", "subtitle", "body", "label", "message", "description", "caption", "hint", "placeholder", "text", "accessibilityLabel"]);

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
      if (parent.type === "JSXAttribute") return !IDENTIFIER_ATTRIBUTES.has(parent.name.name);
      if (parent.type === "JSXExpressionContainer") return parent.parent.type === "JSXElement" || parent.parent.type === "JSXFragment" || isPeopleFacing(parent);
      if (parent.type === "Property" && parent.value === node) return COPY_KEYS.has(parent.key.name ?? parent.key.value);
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

const ROUTE_EXPORTS = new Set(["ErrorBoundary"]);

const isComponentName = (name) => /^[A-Z]/.test(name);

const isFunction = (node) => node?.type === "ArrowFunctionExpression" || node?.type === "FunctionExpression";

const routeOnlyScreen = {
  meta: {
    type: "problem",
    docs: { description: "AGENTS.md: a route file holds only its screen; other components live in src/components." },
    schema: [],
    messages: { extra: "A route file holds only its screen (AGENTS.md). Move {{name}} to src/components." },
  },
  create(context) {
    return {
      Program(program) {
        const exportDefault = program.body.find((node) => node.type === "ExportDefaultDeclaration");
        const specifiers = program.body
          .filter((node) => node.type === "ExportNamedDeclaration" && !node.declaration && !node.source)
          .flatMap((node) => node.specifiers);
        const defaultSpecifier = specifiers.find((specifier) => specifier.exported.name === "default");
        const screen = exportDefault?.declaration.type === "Identifier" ? exportDefault.declaration.name : (defaultSpecifier?.local.name ?? null);
        const listed = new Set(specifiers.filter((specifier) => specifier.exported.name === specifier.local.name).map((specifier) => specifier.local.name));
        const report = (id, exported) => {
          if (id.name === screen || ((exported || listed.has(id.name)) && ROUTE_EXPORTS.has(id.name))) return;
          context.report({ node: id, messageId: "extra", data: { name: id.name } });
        };
        for (const statement of program.body) {
          const exported = statement.type === "ExportNamedDeclaration";
          const declaration = exported ? statement.declaration : statement;
          if (declaration?.type === "FunctionDeclaration" && declaration.id && isComponentName(declaration.id.name)) report(declaration.id, exported);
          if (declaration?.type === "VariableDeclaration") {
            for (const declarator of declaration.declarations) {
              if (declarator.id.type === "Identifier" && isComponentName(declarator.id.name) && isFunction(declarator.init)) report(declarator.id, exported);
            }
          }
        }
      },
    };
  },
};

module.exports = {
  meta: { name: "house" },
  rules: { "no-comments": noComments, "glossary-terms": glossaryTerms, "route-only-screen": routeOnlyScreen },
};
