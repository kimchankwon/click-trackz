import { execFileSync } from "node:child_process";

const CODERABBIT_LOGINS = new Set(["coderabbitai", "coderabbitai[bot]"]);
const DEFAULT_WAIT_SECONDS = 60 * 60;

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function repoParts() {
  const [owner, name] = gh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]).trim().split("/");
  return { owner, name };
}

const THREADS_QUERY = `query($owner: String!, $name: String!, $pr: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $pr) {
      reviewThreads(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id isResolved isOutdated path line
          comments(first: 50) { nodes { author { login } body url createdAt } }
        }
      }
    }
  }
}`;

function reviewThreads(pr) {
  const { owner, name } = repoParts();
  const threads = [];
  let after = null;
  for (;;) {
    const args = ["api", "graphql", "-f", `query=${THREADS_QUERY}`, "-F", `owner=${owner}`, "-F", `name=${name}`, "-F", `pr=${pr}`];
    if (after) args.push("-F", `after=${after}`);
    const page = JSON.parse(gh(args)).data.repository.pullRequest.reviewThreads;
    threads.push(...page.nodes);
    if (!page.pageInfo.hasNextPage) return threads;
    after = page.pageInfo.endCursor;
  }
}

function isCodeRabbit(login) {
  return CODERABBIT_LOGINS.has(login);
}

function parseWaitSeconds(body) {
  const minutes = /(\d+)\s*minutes?/i.exec(body);
  const seconds = /(\d+)\s*seconds?/i.exec(body);
  if (!minutes && !seconds) return DEFAULT_WAIT_SECONDS;
  return (minutes ? Number(minutes[1]) * 60 : 0) + (seconds ? Number(seconds[1]) : 0);
}

function codeRabbitActivity(pr) {
  const { owner, name } = repoParts();
  const comments = JSON.parse(gh(["api", "--paginate", "--slurp", `repos/${owner}/${name}/issues/${pr}/comments`])).flat();
  const reviews = JSON.parse(gh(["api", "--paginate", "--slurp", `repos/${owner}/${name}/pulls/${pr}/reviews`])).flat();
  const head = gh(["pr", "view", String(pr), "--json", "headRefOid", "-q", ".headRefOid"]).trim();
  const ours = reviews.filter((r) => isCodeRabbit(r.user?.login) && r.body.trim() !== "");
  const passedRuns = JSON.parse(gh(["api", "--paginate", "--slurp", `repos/${owner}/${name}/commits/${head}/check-runs`]))
    .flatMap((page) => page.check_runs)
    .filter((run) => run.app?.slug === "coderabbitai" && run.conclusion === "success" && new RegExp(`/pull/${pr}(\\?|$)`).test(run.details_url ?? ""));
  const reviewedHead = passedRuns.length > 0 || ours.some((r) => r.commit_id === head);
  const draftSkipped = !reviewedHead && comments.some((c) => isCodeRabbit(c.user?.login) && /Draft PR not reviewed/i.test(c.body));
  const finishedAt = [...ours.map((r) => Date.parse(r.submitted_at)), ...passedRuns.map((run) => Date.parse(run.completed_at))];
  return { head, reviewedHead, draftSkipped, fileLimit: fileLimit(comments, finishedAt), rateLimit: rateLimit(comments, finishedAt) };
}

const FILE_LIMIT = /contains (\d+) files, which is \d+ over the limit of (\d+)/i;

function fileLimit(comments, finishedAt) {
  const notice = comments.filter((c) => isCodeRabbit(c.user?.login) && FILE_LIMIT.test(c.body)).at(-1);
  if (!notice || finishedAt.some((at) => at > Date.parse(notice.updated_at))) return null;
  const [, files, limit] = FILE_LIMIT.exec(notice.body);
  return { url: notice.html_url, files: Number(files), limit: Number(limit) };
}

function rateLimit(comments, finishedAt) {
  const notices = comments
    .filter((c) => isCodeRabbit(c.user?.login) && /rate limit|review limit/i.test(c.body) && !FILE_LIMIT.test(c.body))
    .map((c) => ({ at: Date.parse(c.updated_at), body: c.body, url: c.html_url }));
  if (notices.length === 0) return null;
  const latest = notices.reduce((a, b) => (b.at > a.at ? b : a));
  if (finishedAt.some((at) => at > latest.at)) return null;
  const readyAt = latest.at + parseWaitSeconds(latest.body) * 1000;
  return { url: latest.url, readyAt: new Date(readyAt).toISOString(), waitSeconds: Math.max(0, Math.ceil((readyAt - Date.now()) / 1000)) };
}

function status(pr) {
  const open = reviewThreads(pr)
    .filter((t) => !t.isResolved && isCodeRabbit(t.comments.nodes[0]?.author?.login))
    .map((t) => {
      const [first, ...replies] = t.comments.nodes;
      return {
        id: t.id,
        path: t.path,
        line: t.line,
        outdated: t.isOutdated,
        url: first.url,
        severity: /<\/picture>\s*([A-Za-z]+)\*\*/.exec(first.body)?.[1] ?? null,
        summary: first.body.split("\n").find((l) => l.trim() && !/^(_|<|\*\*<picture>)/.test(l)) ?? "",
        replies: replies.map((r) => `${r.author?.login}: ${r.body.slice(0, 200)}`),
      };
    });
  const checks = JSON.parse(gh(["pr", "checks", String(pr), "--json", "name,state,link"]).trim() || "[]");
  return { pr, checks, unresolvedCodeRabbitThreads: open, codeRabbit: codeRabbitActivity(pr) };
}

function resolve(threadId) {
  const mutation = "mutation($id: ID!) { resolveReviewThread(input: { threadId: $id }) { thread { id isResolved } } }";
  return JSON.parse(gh(["api", "graphql", "-f", `query=${mutation}`, "-F", `id=${threadId}`])).data.resolveReviewThread.thread;
}

function reply(threadId, body) {
  const mutation = "mutation($id: ID!, $body: String!) { addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $id, body: $body }) { comment { url } } }";
  return JSON.parse(gh(["api", "graphql", "-f", `query=${mutation}`, "-F", `id=${threadId}`, "-f", `body=${body}`])).data.addPullRequestReviewThreadReply.comment;
}

const [command, ...rest] = process.argv.slice(2);
const usage = "usage: node scripts/pr-shepherd.mjs status <pr> | resolve <threadId> | reply <threadId> <body>";

switch (command) {
  case "status":
    console.log(JSON.stringify(status(Number(rest[0])), null, 2));
    break;
  case "resolve":
    console.log(JSON.stringify(resolve(rest[0])));
    break;
  case "reply":
    console.log(JSON.stringify(reply(rest[0], rest.slice(1).join(" "))));
    break;
  default:
    console.error(usage);
    process.exit(2);
}
