import { useState } from "react";
import { Edit3, X, Check, Save, Loader2, Zap, Trash2 } from "lucide-react";
import { translateContent, updateContent, updateTranslation, createManualTranslation } from "../../services/contentService";

export const LANG_FLAGS = { 
  Hindi: "🇮🇳", Marathi: "🇮🇳", French: "🇫🇷", German: "🇩🇪", 
  Spanish: "🇪🇸", Italian: "🇮🇹", Portuguese: "🇵🇹", Arabic: "🇸🇦",
  Japanese: "🇯🇵", Chinese: "🇨🇳"
};

function useTranslationRow(item, targetLanguage, allTranslations, onContentSaved, onTranslationSaved) {
  const sourceText = item.originalText || item.text || "";
  const findEx = () => allTranslations.find(h => h.source_text === sourceText && h.target_language === targetLanguage);
  const [translated, setTranslated] = useState(item.translatedText || findEx()?.translated_text || "");
  const [isTranslating, setIsTranslating] = useState(false);
  const [editOrig, setEditOrig] = useState(sourceText);
  const [editingOrig, setEditingOrig] = useState(false);
  const [savingOrig, setSavingOrig] = useState(false);
  const [editTrans, setEditTrans] = useState(item.translatedText || "");
  const [editingTrans, setEditingTrans] = useState(false);
  const [savingTrans, setSavingTrans] = useState(false);
  const [showTransInput, setShowTransInput] = useState(false);

  const translate = async () => {
    setIsTranslating(true);
    try {
      const r = await translateContent(item.id, targetLanguage);
      if (!r.success) throw new Error(r.message);
      setTranslated(r.translated_text || "");
      onTranslationSaved();
    } catch (e) { alert(e.message); }
    finally { setIsTranslating(false); }
  };

  const saveOrig = async () => {
    setSavingOrig(true);
    try {
      const r = await updateContent(item.id, { page: item.page, key: item.key, source_text: editOrig });
      if (!r.success) throw new Error(r.message);
      setEditingOrig(false);
      onContentSaved();
    } catch (e) { alert(e.message); }
    finally { setSavingOrig(false); }
  };

  const saveTrans = async (text) => {
    const t = text ?? editTrans;
    if (!t.trim()) return;
    setSavingTrans(true);
    try {
      const ex = findEx();
      if (ex) await updateTranslation(ex.id, t);
      else await createManualTranslation(item.source_text, targetLanguage, t);
      setTranslated(t);
      setEditingTrans(false);
      setShowTransInput(false);
      onTranslationSaved();
    } catch (e) { alert(e.message); }
    finally { setSavingTrans(false); }
  };

  return { 
    translated, isTranslating, translate, 
    editOrig, setEditOrig, editingOrig, setEditingOrig, savingOrig, saveOrig, 
    editTrans, setEditTrans, editingTrans, setEditingTrans, savingTrans, saveTrans,
    showTransInput, setShowTransInput
  };
}

function getTruncated(text, length = 100) {
  if (!text) return "";
  return text.length > length ? text.substring(0, length) + "..." : text;
}

function getTagColor(tag) {
  if (["H1", "H2", "H3", "H4", "H5", "H6"].includes(tag)) return "bg-emerald-100 text-emerald-700";
  if (tag === "P") return "bg-slate-100 text-slate-700";
  if (tag === "BUTTON") return "bg-violet-100 text-violet-700";
  if (tag === "A") return "bg-sky-100 text-sky-700";
  if (tag === "IMG") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

export function GridViewTable({ items, targetLanguage, allTranslations, onDelete, onContentSaved, onTranslationSaved }) {
  const [expandedRow, setExpandedRow] = useState(null);

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        No content items to display
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto border border-slate-200 rounded-lg bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
          <tr className="divide-x divide-slate-200">
            <th className="px-4 py-3 text-left font-semibold text-slate-700 w-20">Tag</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-700 w-32">Key</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-700 flex-1 min-w-64">Source Text</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-700 flex-1 min-w-64">{LANG_FLAGS[targetLanguage]} {targetLanguage}</th>
            <th className="px-4 py-3 text-center font-semibold text-slate-700 w-40">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {items.map((item, idx) => {
            const h = useTranslationRow(item, targetLanguage, allTranslations, onContentSaved, onTranslationSaved);
            const isExpanded = expandedRow === item.id;

            return (
              <tr 
                key={item.id}
                className="divide-x divide-slate-200 hover:bg-slate-50 transition-colors group"
              >
                {/* Tag Column */}
                <td className="px-4 py-3">
                  <span className={`inline-block px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap ${getTagColor(item.tag || "P")}`}>
                    {item.tag || "P"}
                  </span>
                </td>

                {/* Key Column */}
                <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                  {getTruncated(item.key || item.sectionId || item.id, 30)}
                </td>

                {/* Source Text Column */}
                <td className="px-4 py-3">
                  {h.editingOrig ? (
                    <input
                      type="text"
                      className="input-field w-full text-sm"
                      value={h.editOrig}
                      onChange={e => h.setEditOrig(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    <div 
                      className="text-sm text-slate-700 cursor-pointer hover:text-slate-900 break-words"
                      title={sourceText}
                    >
                      {getTruncated(sourceText, 80)}
                    </div>
                  )}
                </td>

                {/* Translation Column */}
                <td className="px-4 py-3">
                  {h.editingTrans ? (
                    <input
                      type="text"
                      className="input-field w-full text-sm"
                      value={h.editTrans}
                      onChange={e => h.setEditTrans(e.target.value)}
                      autoFocus
                    />
                  ) : h.translated ? (
                    <div 
                      className="text-sm text-slate-800 font-medium break-words"
                      title={h.translated}
                    >
                      {getTruncated(h.translated, 80)}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">Not translated</div>
                  )}
                </td>

                {/* Actions Column */}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                    {/* Edit Source */}
                    {!h.editingOrig ? (
                      <button
                        onClick={() => { h.setEditingOrig(true); h.setEditOrig(sourceText); }}
                        className="p-1.5 rounded hover:bg-blue-100 text-blue-600 hover:text-blue-700 transition-colors opacity-0 group-hover:opacity-100"
                        title="Edit source"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={h.saveOrig}
                          disabled={h.savingOrig}
                          className="p-1.5 rounded bg-green-100 text-green-600 hover:text-green-700 transition-colors disabled:opacity-50"
                          title="Save source"
                        >
                          {h.savingOrig ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => h.setEditingOrig(false)}
                          className="p-1.5 rounded hover:bg-red-100 text-red-600 hover:text-red-700 transition-colors"
                          title="Cancel"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}

                    {/* Translate Button */}
                    <button
                      onClick={h.translate}
                      disabled={h.isTranslating}
                      className="p-1.5 rounded bg-[#008060] hover:bg-[#006e52] text-white transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100"
                      title={h.translated ? "Re-translate" : "Translate"}
                    >
                      {h.isTranslating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                    </button>

                    {/* Edit Translation */}
                    {h.translated && !h.editingTrans ? (
                      <button
                        onClick={() => { h.setEditingTrans(true); h.setEditTrans(h.translated); }}
                        className="p-1.5 rounded hover:bg-purple-100 text-purple-600 hover:text-purple-700 transition-colors opacity-0 group-hover:opacity-100"
                        title="Edit translation"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    ) : h.editingTrans ? (
                      <>
                        <button
                          onClick={() => h.saveTrans(h.editTrans)}
                          disabled={h.savingTrans}
                          className="p-1.5 rounded bg-green-100 text-green-600 hover:text-green-700 transition-colors disabled:opacity-50"
                          title="Save translation"
                        >
                          {h.savingTrans ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => h.setEditingTrans(false)}
                          className="p-1.5 rounded hover:bg-red-100 text-red-600 hover:text-red-700 transition-colors"
                          title="Cancel"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : null}

                    {/* Delete Button */}
                    <button
                      onClick={() => onDelete(item.id)}
                      className="p-1.5 rounded hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
