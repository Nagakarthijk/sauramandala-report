'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import type { Comment } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { postComment, resolveComment } from '@/components/comments/actions';
import { formatDateTime } from '@/lib/utils';

function ReplyBox({
  projectId,
  targetTable,
  targetId,
  parentId,
}: {
  projectId: string;
  targetTable: string;
  targetId: string;
  parentId: string;
}) {
  const pathname = usePathname();
  const [body, setBody] = useState('');
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="text-xs text-forest hover:underline" onClick={() => setOpen(true)}>
        Reply
      </button>
    );
  }

  return (
    <form
      action={async () => {
        await postComment({ projectId, targetTable, targetId, parentId, body, path: pathname });
        setBody('');
        setOpen(false);
      }}
      className="mt-2 space-y-2"
    >
      <Textarea
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Reply…"
      />
      <Button size="sm" type="submit">
        Post reply
      </Button>
    </form>
  );
}

function ThreadItem({ comment, currentUserId }: { comment: Comment; currentUserId?: string }) {
  return (
    <div className={comment.resolved ? 'opacity-50' : ''}>
      <p className="text-sm text-ink/90">{comment.body}</p>
      <p className="text-xs text-ink/40">{formatDateTime(comment.created_at)}</p>
    </div>
  );
}

export function CommentThread({
  comment,
  replies,
  currentUserId,
  projectId,
  targetTable,
  targetId,
}: {
  comment: Comment;
  replies: Comment[];
  currentUserId?: string;
  projectId: string;
  targetTable: string;
  targetId: string;
}) {
  const pathname = usePathname();

  return (
    <div className="rounded-md border border-ink/10 p-3">
      <ThreadItem comment={comment} currentUserId={currentUserId} />
      {replies.length > 0 && (
        <div className="ml-4 mt-2 space-y-2 border-l border-ink/10 pl-3">
          {replies.map((r) => (
            <ThreadItem key={r.id} comment={r} currentUserId={currentUserId} />
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center gap-3">
        <ReplyBox
          projectId={projectId}
          targetTable={targetTable}
          targetId={targetId}
          parentId={comment.id}
        />
        <button
          className="text-xs text-ink/40 hover:underline"
          onClick={() => resolveComment(comment.id, !comment.resolved, pathname)}
        >
          {comment.resolved ? 'Reopen' : 'Mark resolved'}
        </button>
      </div>
    </div>
  );
}

function NewTopLevel({
  projectId,
  targetTable,
  targetId,
}: {
  projectId: string;
  targetTable: string;
  targetId: string;
}) {
  const pathname = usePathname();
  const [body, setBody] = useState('');

  return (
    <form
      action={async () => {
        await postComment({ projectId, targetTable, targetId, body, path: pathname });
        setBody('');
      }}
      className="space-y-2"
    >
      <Textarea
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a comment…"
      />
      <Button size="sm" type="submit">
        Comment
      </Button>
    </form>
  );
}

CommentThread.NewTopLevel = NewTopLevel;
