import { createClient } from '@/lib/supabase/server';
import type { Comment } from '@/lib/types';
import { CommentThread } from '@/components/comments/CommentThread';

export async function Comments({
  targetTable,
  targetId,
  projectId,
}: {
  targetTable: string;
  targetId: string;
  projectId: string;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from('comments')
    .select('*')
    .eq('target_table', targetTable)
    .eq('target_id', targetId)
    .order('created_at', { ascending: true })
    .returns<Comment[]>();

  const comments = data ?? [];
  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesByParent = new Map<string, Comment[]>();
  for (const c of comments) {
    if (!c.parent_id) continue;
    const list = repliesByParent.get(c.parent_id) ?? [];
    list.push(c);
    repliesByParent.set(c.parent_id, list);
  }

  return (
    <div className="space-y-4">
      <h3 className="font-heading text-base">Comments</h3>
      {topLevel.length === 0 ? (
        <p className="text-sm text-ink/50">No comments yet.</p>
      ) : (
        <div className="space-y-4">
          {topLevel.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              replies={repliesByParent.get(comment.id) ?? []}
              currentUserId={user?.id}
              projectId={projectId}
              targetTable={targetTable}
              targetId={targetId}
            />
          ))}
        </div>
      )}
      <CommentThread.NewTopLevel
        projectId={projectId}
        targetTable={targetTable}
        targetId={targetId}
      />
    </div>
  );
}
