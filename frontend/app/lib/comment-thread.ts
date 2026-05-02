import type { NewsCommentResponse } from "~/lib/api-client"

export type CommentThreadNode = NewsCommentResponse & {
  children: CommentThreadNode[]
}

/** Build a nested tree from a flat list (parent ids may be missing from the page). */
export function buildCommentThreadTree(flat: NewsCommentResponse[]): CommentThreadNode[] {
  const byId = new Map<string, CommentThreadNode>()
  for (const c of flat) {
    byId.set(c.id, { ...c, children: [] })
  }
  const roots: CommentThreadNode[] = []
  for (const c of flat) {
    const node = byId.get(c.id)!
    const pid = c.parent_comment_id
    if (pid && byId.has(pid)) {
      byId.get(pid)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  const byTime = (a: CommentThreadNode, b: CommentThreadNode) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  roots.sort(byTime)
  const sortDeep = (n: CommentThreadNode) => {
    n.children.sort(byTime)
    n.children.forEach(sortDeep)
  }
  roots.forEach(sortDeep)
  return roots
}
