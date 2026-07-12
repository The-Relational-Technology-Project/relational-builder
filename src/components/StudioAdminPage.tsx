import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStudioStore, adminMemberships } from '@/store/studio-store';
import {
  listStudioMembers,
  approveStudioMember,
  removeStudioMember,
  type StudioMemberRow,
} from '@/cloud/studios';
import {
  createStudioItem,
  updateStudioItem,
  deleteStudioItem,
  setStudioItemVisibility,
  shareStudioItemToCommons,
  STUDIO_ITEM_KINDS,
  type StudioLibraryItem,
  type StudioItemKind,
} from '@/cloud/studio-library';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import {
  Check, X, Loader2, Plus, Pencil, Trash2, Share2, Lock, KeyRound, Users, BookOpen,
} from 'lucide-react';

/**
 * The Studio Admin console — the door and the shelf of a gated studio, run
 * by its own admins (a role the steward grants). Two jobs:
 *  - Members: approve or decline builders asking to join, and tend the roster
 *  - Library: the studio's private principles, examples, and materials —
 *    what approved members see in the gallery and what the AI draws on
 *    while they build. Items stay studio-private until shared, explicitly.
 * RLS is the real boundary for everything here; this page is just its hands.
 */
export function StudioAdminPage() {
  const memberships = useStudioStore(s => s.memberships);
  const myAdminStudios = useMemo(() => adminMemberships(memberships), [memberships]);
  // Derived selection: the first admin studio until one is picked
  const [picked, setPicked] = useState<string>('');
  const slug = picked || myAdminStudios[0]?.studio_slug || '';
  const current = myAdminStudios.find(m => m.studio_slug === slug);

  if (myAdminStudios.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto h-full">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-12">
          <p className="text-sm text-muted-foreground">
            You're not a Studio Admin yet — the steward grants that role.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto h-full">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <KeyRound className="size-6 text-primary shrink-0" />
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Studio Admin</h1>
          {myAdminStudios.length > 1 && (
            <Select value={slug} onValueChange={v => { if (v) setPicked(v); }}>
              <SelectTrigger className="h-8 w-auto gap-1.5 text-xs px-2.5 ml-auto">
                {current?.studio_label ?? slug}
              </SelectTrigger>
              <SelectContent>
                {myAdminStudios.map(m => (
                  <SelectItem key={m.studio_slug} value={m.studio_slug}>
                    {m.studio_label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {myAdminStudios.length === 1 && (
            <Badge variant="outline" className="ml-auto">{current?.studio_label}</Badge>
          )}
        </div>

        {current && (
          <Tabs defaultValue="members">
            <TabsList>
              <TabsTrigger value="members" className="text-xs px-3 sm:px-4 gap-1.5">
                <Users className="size-3.5" /> Members
              </TabsTrigger>
              <TabsTrigger value="library" className="text-xs px-3 sm:px-4 gap-1.5">
                <BookOpen className="size-3.5" /> Library
              </TabsTrigger>
            </TabsList>
            <TabsContent value="members" className="pt-4">
              <MembersTab slug={current.studio_slug} />
            </TabsContent>
            <TabsContent value="library" className="pt-4">
              <LibraryTab slug={current.studio_slug} label={current.studio_label} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

// --- Members: the studio's door ---

function MembersTab({ slug }: { slug: string }) {
  const [members, setMembers] = useState<StudioMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMembers(await listStudioMembers(slug));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load members');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function decide(userId: string, approve: boolean) {
    setBusyId(userId);
    setError(null);
    const ok = approve
      ? await approveStudioMember(slug, userId)
      : await removeStudioMember(slug, userId);
    if (!ok) setError('That decision did not save');
    await refresh();
    setBusyId(null);
  }

  const pending = members.filter(m => m.status === 'pending');
  const approved = members.filter(m => m.status === 'approved');

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="size-3.5 animate-spin" /> Loading members…
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Waiting at the door {pending.length > 0 && `(${pending.length})`}
        </p>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending requests.</p>
        ) : (
          pending.map(m => (
            <div key={m.user_id} className="rounded-lg border p-3 flex items-center gap-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{m.display_name || 'A builder'}</p>
                <p className="text-xs text-muted-foreground">
                  Asked to join {new Date(m.joined_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </p>
              </div>
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={busyId !== null}
                onClick={() => decide(m.user_id, true)}
              >
                {busyId === m.user_id ? (
                  <Loader2 className="size-3 mr-1 animate-spin" />
                ) : (
                  <Check className="size-3 mr-1" />
                )}
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={busyId !== null}
                onClick={() => decide(m.user_id, false)}
              >
                <X className="size-3 mr-1" />
                Decline
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Members ({approved.length})
        </p>
        {approved.map(m => (
          <div key={m.user_id} className="rounded-lg border px-3 py-2 flex items-center gap-2.5">
            <div className="min-w-0 flex-1">
              <span className="text-sm truncate">{m.display_name || 'A builder'}</span>
              {m.role === 'admin' && (
                <Badge variant="outline" className="ml-2 text-[10px]">admin</Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground/60 shrink-0">
              {new Date(m.joined_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
            {m.role !== 'admin' && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-muted-foreground"
                disabled={busyId !== null}
                onClick={() => decide(m.user_id, false)}
              >
                Remove
              </Button>
            )}
          </div>
        ))}
        {approved.length === 0 && (
          <p className="text-sm text-muted-foreground">No members yet.</p>
        )}
      </div>
    </div>
  );
}

// --- Library: the studio's shelf ---

const EMPTY_DRAFT = {
  kind: 'principle' as StudioItemKind,
  title: '',
  summary: '',
  body: '',
  url: '',
  attribution: '',
  tags: '',
};

function LibraryTab({ slug, label }: { slug: string; label: string }) {
  const library = useStudioStore(s => s.library);
  const loadLibrary = useStudioStore(s => s.loadLibrary);
  const items = useMemo(
    () => library.filter(i => i.studio_slug === slug),
    [library, slug],
  );
  const [editing, setEditing] = useState<StudioLibraryItem | 'new' | null>(null);
  const [sharing, setSharing] = useState<StudioLibraryItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(item: StudioLibraryItem) {
    if (!window.confirm(`Delete "${item.title}" from the ${label} library?`)) return;
    setBusyId(item.id);
    setError(null);
    try {
      await deleteStudioItem(item.id);
      await loadLibrary();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete that item');
    } finally {
      setBusyId(null);
    }
  }

  async function makePrivate(item: StudioLibraryItem) {
    setBusyId(item.id);
    setError(null);
    try {
      await setStudioItemVisibility(item.id, 'studio');
      await loadLibrary();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change visibility');
    } finally {
      setBusyId(null);
    }
  }

  const byKind = useMemo(() => {
    const groups = new Map<StudioItemKind, StudioLibraryItem[]>();
    for (const { key } of STUDIO_ITEM_KINDS) groups.set(key, []);
    for (const item of items) groups.get(item.kind)?.push(item);
    return groups;
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-xs text-muted-foreground flex-1">
          Only approved {label} members see these — in the gallery, and woven
          into the AI's context while they build. Sharing an item is explicit
          and per-item.
        </p>
        <Button size="sm" className="h-7 text-xs shrink-0" onClick={() => setEditing('new')}>
          <Plus className="size-3 mr-1" /> Add item
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          The shelf is empty — add the studio's first principle or example.
        </p>
      ) : (
        [...byKind.entries()]
          .filter(([, group]) => group.length > 0)
          .map(([kind, group]) => (
            <div key={kind} className="space-y-1.5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {STUDIO_ITEM_KINDS.find(k => k.key === kind)?.label ?? kind}s ({group.length})
              </p>
              {group.map(item => (
                <div key={item.id} className="rounded-lg border px-3 py-2 flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{item.title}</span>
                      {item.visibility === 'shared' ? (
                        <Badge variant="outline" className="text-[9px] text-green-600 border-green-600/40 shrink-0">
                          shared
                        </Badge>
                      ) : (
                        <Lock className="size-3 text-muted-foreground/50 shrink-0" />
                      )}
                    </div>
                    {item.summary && (
                      <p className="text-xs text-muted-foreground truncate">{item.summary}</p>
                    )}
                  </div>
                  {busyId === item.id ? (
                    <Loader2 className="size-3.5 animate-spin text-muted-foreground shrink-0" />
                  ) : (
                    <div className="flex gap-0.5 shrink-0">
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0"
                        title="Edit"
                        onClick={() => setEditing(item)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      {item.visibility === 'shared' ? (
                        <Button
                          size="sm" variant="ghost" className="h-7 w-7 p-0"
                          title="Make studio-private again"
                          onClick={() => makePrivate(item)}
                        >
                          <Lock className="size-3.5" />
                        </Button>
                      ) : (
                        <Button
                          size="sm" variant="ghost" className="h-7 w-7 p-0"
                          title="Share beyond the studio"
                          onClick={() => setSharing(item)}
                        >
                          <Share2 className="size-3.5" />
                        </Button>
                      )}
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground"
                        title="Delete"
                        onClick={() => remove(item)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
      )}

      {editing && (
        <ItemEditorDialog
          slug={slug}
          label={label}
          item={editing === 'new' ? null : editing}
          onClose={async saved => {
            setEditing(null);
            if (saved) await loadLibrary();
          }}
        />
      )}
      {sharing && (
        <ShareDialog
          item={sharing}
          label={label}
          onClose={async shared => {
            setSharing(null);
            if (shared) await loadLibrary();
          }}
        />
      )}
    </div>
  );
}

function ItemEditorDialog({
  slug, label, item, onClose,
}: {
  slug: string;
  label: string;
  item: StudioLibraryItem | null;
  onClose: (saved: boolean) => void;
}) {
  const [draft, setDraft] = useState(() =>
    item
      ? {
          kind: item.kind,
          title: item.title,
          summary: item.summary ?? '',
          body: item.body ?? '',
          url: item.url ?? '',
          attribution: item.attribution ?? '',
          tags: item.tags.join(', '),
        }
      : EMPTY_DRAFT,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!draft.title.trim()) return;
    setSaving(true);
    setError(null);
    const payload = {
      studio_slug: slug,
      kind: draft.kind,
      title: draft.title.trim(),
      summary: draft.summary.trim() || null,
      body: draft.body.trim() || null,
      url: draft.url.trim() || null,
      attribution: draft.attribution.trim() || null,
      tags: draft.tags.split(',').map(t => t.trim()).filter(Boolean),
    };
    try {
      if (item) await updateStudioItem(item.id, payload);
      else await createStudioItem(payload);
      onClose(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the item');
      setSaving(false);
    }
  }

  const field = (key: keyof typeof EMPTY_DRAFT) => ({
    value: draft[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(d => ({ ...d, [key]: e.target.value })),
  });

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(false); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit item' : `Add to the ${label} library`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Kind</Label>
              <Select
                value={draft.kind}
                onValueChange={v => { if (v) setDraft(d => ({ ...d, kind: v as StudioItemKind })); }}
              >
                <SelectTrigger className="h-9 w-32 text-xs">
                  {STUDIO_ITEM_KINDS.find(k => k.key === draft.kind)?.label}
                </SelectTrigger>
                <SelectContent>
                  {STUDIO_ITEM_KINDS.map(k => (
                    <SelectItem key={k.key} value={k.key}>{k.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs">Title</Label>
              <Input {...field('title')} placeholder="e.g. Meet people where they are" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Summary — one or two sentences</Label>
            <Input {...field('summary')} placeholder="What this is, at a glance" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">
              Full text (markdown) — principles ride into the AI's context in full
            </Label>
            <textarea
              {...field('body')}
              rows={6}
              placeholder="The principle, example, or material itself"
              className="w-full resize-y rounded-md border bg-background px-2.5 py-1.5 text-base sm:text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2">
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs">Attribution (optional)</Label>
              <Input {...field('attribution')} placeholder="Who this comes from" />
            </div>
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs">Link (optional)</Label>
              <Input {...field('url')} placeholder="https://…" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tags — comma separated (optional)</Label>
            <Input {...field('tags')} placeholder="youth, mentorship, baltimore" />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button size="sm" disabled={saving || !draft.title.trim()} onClick={save}>
              {saving && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
              {item ? 'Save changes' : 'Add to library'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => onClose(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShareDialog({
  item, label, onClose,
}: {
  item: StudioLibraryItem;
  label: string;
  onClose: (shared: boolean) => void;
}) {
  const [toCommons, setToCommons] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function share() {
    setSharing(true);
    setError(null);
    try {
      if (toCommons) {
        const result = await shareStudioItemToCommons(item, label);
        if (!result.ok) throw new Error(result.error ?? 'Sharing failed');
      } else {
        await setStudioItemVisibility(item.id, 'shared');
      }
      onClose(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sharing failed');
      setSharing(false);
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(false); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share "{item.title}"</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Right now only approved {label} members see this. Sharing makes it
          visible to every signed-in Relational Builder builder in the gallery
          — you can make it studio-private again anytime.
        </p>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={toCommons}
            onChange={e => setToCommons(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Also submit it to the <strong>RT Commons</strong> review queue, so
            it can join the canonical commons with {label}'s attribution.
          </span>
        </label>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button size="sm" disabled={sharing} onClick={share}>
            {sharing ? (
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            ) : (
              <Share2 className="size-3.5 mr-1.5" />
            )}
            Share it
          </Button>
          <Button size="sm" variant="outline" onClick={() => onClose(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
