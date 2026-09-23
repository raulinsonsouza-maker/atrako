"use client";

import { useState, useEffect } from "react";
import { listTags } from "@/server/actions/tag";
import { getLeadTags, setLeadTags } from "@/server/actions/tag";
import { X } from "lucide-react";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface LeadTagsSelectorProps {
  leadId: string;
  tenantId: string;
  onUpdate?: () => void;
}

export function LeadTagsSelector({ leadId, tenantId, onUpdate }: LeadTagsSelectorProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    loadData();
  }, [leadId, tenantId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tags, leadTags] = await Promise.all([
        listTags(tenantId),
        getLeadTags(leadId, tenantId),
      ]);
      setAllTags(tags);
      setSelectedTagIds(leadTags.map((t) => t.id));
    } catch (e) {
      console.error("Erro ao carregar tags:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTag = async (tagId: string) => {
    const newSelected = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId];

    setSelectedTagIds(newSelected);
    setSaving(true);
    try {
      await setLeadTags(leadId, newSelected, tenantId);
      onUpdate?.();
    } catch (e) {
      console.error("Erro ao atualizar tags:", e);
      // Reverter em caso de erro
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    const newSelected = selectedTagIds.filter((id) => id !== tagId);
    setSelectedTagIds(newSelected);
    setSaving(true);
    try {
      await setLeadTags(leadId, newSelected, tenantId);
      onUpdate?.();
    } catch (e) {
      console.error("Erro ao remover tag:", e);
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const selectedTags = allTags.filter((t) => selectedTagIds.includes(t.id));
  const availableTags = allTags.filter((t) => !selectedTagIds.includes(t.id));

  if (loading) {
    return <p className="text-sm text-neutral-500">Carregando tags…</p>;
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Tags</label>

      {/* Tags selecionadas */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
              <button
                onClick={() => handleRemoveTag(tag.id)}
                disabled={saving}
                className="hover:opacity-75 disabled:opacity-50"
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown para adicionar tags */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowDropdown(!showDropdown)}
          className="rounded-sm border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
          disabled={saving || availableTags.length === 0}
        >
          {availableTags.length === 0 ? "Todas as tags foram adicionadas" : "+ Adicionar tag"}
        </button>

        {showDropdown && availableTags.length > 0 && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowDropdown(false)}
            />
            <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
              {availableTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => {
                    handleToggleTag(tag.id);
                    setShowDropdown(false);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700"
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span>{tag.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {allTags.length === 0 && (
        <p className="text-sm text-neutral-500">
          Nenhuma tag disponível. Crie tags em Configurações.
        </p>
      )}
    </div>
  );
}
