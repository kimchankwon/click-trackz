import { internalMutation } from "./_generated/server";

const OLD_LIBRARY_NAME = "Offline";
const LIBRARY_NAME = "My Library";

export const oneAdminPerGroup = internalMutation({
  args: {},
  handler: async (ctx) => {
    let demoted = 0;
    let newOwners = 0;
    let renamedLibraries = 0;
    for (const group of await ctx.db.query("groups").collect()) {
      if (group.offline === true) {
        if (group.name === OLD_LIBRARY_NAME) {
          await ctx.db.patch(group._id, { name: LIBRARY_NAME, libraryRevision: (group.libraryRevision ?? 0) + 1 });
          renamedLibraries++;
        }
        continue;
      }
      const memberships = await ctx.db
        .query("memberships")
        .withIndex("by_group", (q) => q.eq("groupId", group._id))
        .collect();
      const admins = memberships.filter((membership) => membership.role === "admin").sort((a, b) => a._creationTime - b._creationTime);
      const creatorIsMember = memberships.some((membership) => membership.userId === group.createdBy);
      const owner = creatorIsMember ? group.createdBy : admins[0]?.userId;
      if (owner === undefined) continue;
      if (owner !== group.createdBy) {
        await ctx.db.patch(group._id, { createdBy: owner });
        newOwners++;
      }
      for (const membership of memberships) {
        const role = membership.userId === owner ? "admin" : membership.role === "admin" ? "groupManager" : membership.role;
        if (role === membership.role) continue;
        await ctx.db.patch(membership._id, { role });
        if (role === "groupManager") demoted++;
      }
    }
    return { demoted, newOwners, renamedLibraries };
  },
});
