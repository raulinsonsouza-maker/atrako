"use client";

import { useState, useEffect } from "react";
import { listTags, createTag, updateTag, deleteTag } from "@/server/actions/tag";
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from "@/design/components";
import { Plus, X, Edit2, Trash2 } from "lucide-react";

interface Tag {
  id: string;
  name: string;
  color: string;
  _count?: {
    leads: number;
  };
}

export function TagsSection({ tenantId }: { tenantId: string }) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3B82F6");
  const [error, setError] = useState<string | null>(null);

  const loadTags = async () => {
    setLoading(true);
    try {
      const t = await listTags(tenantId);
      setTags(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar tags");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTags();
  }, [tenantId]);

  const handleCreate = async () => {
    if (!newTagName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createTag(tenantId, { name: newTagName.trim(), color: newTagColor });
      setNewTagName("");
      setNewTagColor("#3B82F6");
      await loadTags();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar tag");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string, name: string, color: string) => {
    setSaving(true);
    setError(null);
    try {
      await updateTag(id, tenantId, { name: name.trim(), color });
      setEditingId(null);
      await loadTags();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar tag");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta tag? Ela será removida de todos os leads.")) return;
    setSaving(true);
    setError(null);
    try {
      await deleteTag(id, tenantId);
      await loadTags();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao excluir tag");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-neutral-500">Carregando tags…</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tags</CardTitle>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-4 text-sm text-error-600">{error}</p>}

        {/* Criar nova tag */}
        <div className="mb-6 flex flex-wrap gap-2">
          <Input
            label="Nome da tag"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="Ex: Cliente VIP"
            className="flex-1 min-w-[200px]"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
          />
          <div className="flex items-end gap-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Cor</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="h-10 w-16 cursor-pointer rounded border border-neutral-300"
                />
                <input
                  type="text"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  placeholder="#3B82F6"
                  className="w-24 rounded-sm border border-neutral-300 bg-white px-2 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800"
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
            </div>
            <Button onClick={handleCreate} isLoading={saving} disabled={!newTagName.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              Criar
            </Button>
          </div>
        </div>

        {/* Lista de tags */}
        {tags.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhuma tag criada ainda.</p>
        ) : (
          <div className="space-y-2">
            {tags.map((tag) => (
              <TagItem
                key={tag.id}
                tag={tag}
                editing={editingId === tag.id}
                onEdit={() => setEditingId(tag.id)}
                onCancel={() => setEditingId(null)}
                onSave={(name, color) => handleUpdate(tag.id, name, color)}
                onDelete={() => handleDelete(tag.id)}
                saving={saving}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TagItem({
  tag,
  editing,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  saving,
}: {
  tag: Tag;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (name: string, color: string) => void;
  onDelete: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);

  useEffect(() => {
    if (editing) {
      setName(tag.name);
      setColor(tag.color);
    }
  }, [editing, tag.name, tag.color]);

  if (editing) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800/50">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-sm border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-800"
          autoFocus
        />
        <div className="flex items-center gap-1">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-8 w-12 cursor-pointer rounded border border-neutral-300"
          />
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-20 rounded-sm border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-600 dark:bg-neutral-800"
            pattern="^#[0-9A-Fa-f]{6}$"
          />
        </div>
        <Button
          size="sm"
          onClick={() => onSave(name, color)}
          isLoading={saving}
          disabled={!name.trim()}
        >
          Salvar
        </Button>
        <button
          onClick={onCancel}
          className="rounded p-1 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-800">
      <div className="flex items-center gap-2">
        <span
          className="h-4 w-4 rounded-full"
          style={{ backgroundColor: tag.color }}
        />
        <span className="font-medium text-neutral-900 dark:text-neutral-100">{tag.name}</span>
        {tag._count && (
          <span className="text-sm text-neutral-500">
            ({tag._count.leads} {tag._count.leads === 1 ? "lead" : "leads"})
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onEdit}
          className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-700"
          title="Editar"
        >
          <Edit2 className="h-4 w-4" />
        </button>
        <button
          onClick={onDelete}
          className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-error-600 dark:hover:bg-neutral-700"
          title="Excluir"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
