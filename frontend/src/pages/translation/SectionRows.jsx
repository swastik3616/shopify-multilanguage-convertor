import { useState, useEffect } from "react";
import { Edit3, X, Check, Save, Loader2, Zap, Trash2 } from "lucide-react";
import { translateContent, updateContent, updateTranslation, createManualTranslation } from "../../services/contentService";

export const LANG_FLAGS = { Hindi:"🇮🇳", Marathi:"🇮🇳", French:"🇫🇷", German:"🇩🇪", Spanish:"🇪🇸", Italian:"🇮🇹" };

function useTranslationRow(item, targetLanguage, allTranslations, onContentSaved, onTranslationSaved) {
  const findEx = () => allTranslations.find(h => h.source_text === item.source_text && h.target_language === targetLanguage);
  const [translated, setTranslated] = useState(findEx()?.translated_text || "");
  const [isTranslating, setIsTranslating] = useState(false);
  const [editOrig, setEditOrig] = useState(item.source_text);
  const [editingOrig, setEditingOrig] = useState(false);
  const [savingOrig, setSavingOrig] = useState(false);
  const [editTrans, setEditTrans] = useState("");
  const [editingTrans, setEditingTrans] = useState(false);
  const [savingTrans, setSavingTrans] = useState(false);

  useEffect(() => {
    const found = findEx();
    setTranslated(found?.translated_text || "");
    setEditingTrans(false);
  }, [targetLanguage, allTranslations, item.source_text]);

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
      onTranslationSaved();
    } catch (e) { alert(e.message); }
    finally { setSavingTrans(false); }
  };

  return { translated, isTranslating, translate, editOrig, setEditOrig, editingOrig, setEditingOrig, savingOrig, saveOrig, editTrans, setEditTrans, editingTrans, setEditingTrans, savingTrans, saveTrans };
}

function EditControls({ editing, saving, onEdit, onSave, onCancel, saveIcon: SaveIcon = Check }) {
  if (!editing) return <button onClick={onEdit} className="text-[11px] text-slate-400 hover:text-[#008060] flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><Edit3 className="h-3 w-3"/>Edit</button>;
  return (
    <div className="flex gap-2">
      <button onClick={onCancel} className="text-[11px] text-slate-400 flex items-center gap-0.5"><X className="h-3 w-3"/>Cancel</button>
      <button onClick={onSave} disabled={saving} className="text-[11px] text-[#008060] font-semibold flex items-center gap-0.5">
        {saving ? <Loader2 className="h-3 w-3 animate-spin"/> : <SaveIcon className="h-3 w-3"/>} Save
      </button>
    </div>
  );
}

function TransBtn({ loading, hasTranslation, onClick }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-[#008060] hover:bg-[#006e52] px-2 py-0.5 rounded-full disabled:opacity-60">
      {loading ? <Loader2 className="h-3 w-3 animate-spin"/> : <Zap className="h-3 w-3"/>}
      {loading ? "…" : hasTranslation ? "Re-do" : "Translate"}
    </button>
  );
}

function ManualInput({ editTrans, setEditTrans, saveTrans, savingTrans, targetLanguage }) {
  return (
    <div className="flex items-center gap-2 mt-1">
      <input type="text" className="input-field h-7 flex-1 text-sm" placeholder={`Type ${targetLanguage} translation…`}
        value={editTrans} onChange={e => setEditTrans(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") saveTrans(editTrans); }} />
      {editTrans.trim() && (
        <button onClick={() => saveTrans(editTrans)} disabled={savingTrans} className="btn btn-primary h-7 px-2 text-xs">
          {savingTrans ? <Loader2 className="h-3 w-3 animate-spin"/> : <Save className="h-3 w-3"/>}
        </button>
      )}
    </div>
  );
}

// ── HEADING ROW: large text, prominent ─────────────────────────────
export function HeadingRow({ item, targetLanguage, allTranslations, onDelete, onContentSaved, onTranslationSaved }) {
  const h = useTranslationRow(item, targetLanguage, allTranslations, onContentSaved, onTranslationSaved);
  return (
    <div className="group grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100 last:border-b-0 hover:bg-violet-50/30 transition-colors">
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400">{item.key}</span>
          <div className="flex items-center gap-2">
            <EditControls editing={h.editingOrig} saving={h.savingOrig} onEdit={() => { h.setEditingOrig(true); h.setEditOrig(item.source_text); }} onSave={h.saveOrig} onCancel={() => h.setEditingOrig(false)} />
            <button onClick={() => onDelete(item.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"><Trash2 className="h-3 w-3"/></button>
          </div>
        </div>
        {h.editingOrig
          ? <input type="text" className="input-field w-full text-xl font-bold" value={h.editOrig} onChange={e => h.setEditOrig(e.target.value)} autoFocus/>
          : <p className="text-xl font-bold text-slate-900 leading-tight">{item.source_text}</p>}
      </div>
      <div className="px-5 py-4 bg-violet-50/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-violet-500">{LANG_FLAGS[targetLanguage]} {targetLanguage}</span>
          <div className="flex items-center gap-2">
            {h.translated && <EditControls editing={h.editingTrans} saving={h.savingTrans} onEdit={() => { h.setEditingTrans(true); h.setEditTrans(h.translated); }} onSave={() => h.saveTrans(h.editTrans)} onCancel={() => h.setEditingTrans(false)} saveIcon={Save}/>}
            <TransBtn loading={h.isTranslating} hasTranslation={!!h.translated} onClick={h.translate}/>
          </div>
        </div>
        {h.editingTrans
          ? <input type="text" className="input-field w-full text-xl font-bold" value={h.editTrans} onChange={e => h.setEditTrans(e.target.value)} autoFocus/>
          : h.translated
            ? <p className="text-xl font-bold text-violet-800 leading-tight">{h.translated}</p>
            : <ManualInput editTrans={h.editTrans} setEditTrans={h.setEditTrans} saveTrans={h.saveTrans} savingTrans={h.savingTrans} targetLanguage={targetLanguage}/>}
      </div>
    </div>
  );
}

// ── PRODUCT NAME ROW: card with product pill ────────────────────────
export function ProductNameRow({ item, targetLanguage, allTranslations, onDelete, onContentSaved, onTranslationSaved }) {
  const h = useTranslationRow(item, targetLanguage, allTranslations, onContentSaved, onTranslationSaved);
  return (
    <div className="group grid grid-cols-2 divide-x divide-blue-100 border-b border-blue-50 last:border-b-0 hover:bg-blue-50/40 transition-colors">
      <div className="px-5 py-3 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wide">📦 {item.key}</span>
          <div className="flex items-center gap-2">
            <EditControls editing={h.editingOrig} saving={h.savingOrig} onEdit={() => { h.setEditingOrig(true); h.setEditOrig(item.source_text); }} onSave={h.saveOrig} onCancel={() => h.setEditingOrig(false)} />
            <button onClick={() => onDelete(item.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"><Trash2 className="h-3 w-3"/></button>
          </div>
        </div>
        {h.editingOrig
          ? <input type="text" className="input-field w-full text-base font-semibold" value={h.editOrig} onChange={e => h.setEditOrig(e.target.value)} autoFocus/>
          : <p className="text-base font-semibold text-slate-800">{item.source_text}</p>}
      </div>
      <div className="px-5 py-3 flex flex-col gap-1.5 bg-blue-50/30">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-200 text-blue-800 text-[10px] font-bold uppercase tracking-wide">{LANG_FLAGS[targetLanguage]} {targetLanguage}</span>
          <div className="flex items-center gap-2">
            {h.translated && <EditControls editing={h.editingTrans} saving={h.savingTrans} onEdit={() => { h.setEditingTrans(true); h.setEditTrans(h.translated); }} onSave={() => h.saveTrans(h.editTrans)} onCancel={() => h.setEditingTrans(false)} saveIcon={Save}/>}
            <TransBtn loading={h.isTranslating} hasTranslation={!!h.translated} onClick={h.translate}/>
          </div>
        </div>
        {h.editingTrans
          ? <input type="text" className="input-field w-full text-base font-semibold" value={h.editTrans} onChange={e => h.setEditTrans(e.target.value)} autoFocus/>
          : h.translated
            ? <p className="text-base font-semibold text-blue-900">{h.translated}</p>
            : <ManualInput editTrans={h.editTrans} setEditTrans={h.setEditTrans} saveTrans={h.saveTrans} savingTrans={h.savingTrans} targetLanguage={targetLanguage}/>}
      </div>
    </div>
  );
}

// ── PRICE ROW: badge style ──────────────────────────────────────────
export function PriceRow({ item, targetLanguage, allTranslations, onDelete, onContentSaved, onTranslationSaved }) {
  const h = useTranslationRow(item, targetLanguage, allTranslations, onContentSaved, onTranslationSaved);
  return (
    <div className="group grid grid-cols-2 divide-x divide-amber-100 border-b border-amber-50 last:border-b-0 hover:bg-amber-50/40 transition-colors">
      <div className="px-5 py-3 flex items-center gap-4">
        <span className="text-2xl font-black text-amber-700 bg-amber-100 px-4 py-2 rounded-xl">{item.source_text}</span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500">{item.key}</p>
          {h.editingOrig && <input type="text" className="input-field mt-1 text-sm" value={h.editOrig} onChange={e => h.setEditOrig(e.target.value)} autoFocus/>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <EditControls editing={h.editingOrig} saving={h.savingOrig} onEdit={() => { h.setEditingOrig(true); h.setEditOrig(item.source_text); }} onSave={h.saveOrig} onCancel={() => h.setEditingOrig(false)} />
          <button onClick={() => onDelete(item.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"><Trash2 className="h-3 w-3"/></button>
        </div>
      </div>
      <div className="px-5 py-3 flex items-center gap-4 bg-amber-50/30">
        {h.translated
          ? <span className="text-2xl font-black text-amber-800 bg-amber-200 px-4 py-2 rounded-xl">{h.translated}</span>
          : <span className="text-sm text-amber-400 italic">not translated</span>}
        <div className="ml-auto flex items-center gap-2">
          {h.translated && <EditControls editing={h.editingTrans} saving={h.savingTrans} onEdit={() => { h.setEditingTrans(true); h.setEditTrans(h.translated); }} onSave={() => h.saveTrans(h.editTrans)} onCancel={() => h.setEditingTrans(false)} saveIcon={Save}/>}
          <TransBtn loading={h.isTranslating} hasTranslation={!!h.translated} onClick={h.translate}/>
        </div>
        {h.editingTrans && <input type="text" className="input-field mt-1 text-sm" value={h.editTrans} onChange={e => h.setEditTrans(e.target.value)} autoFocus/>}
      </div>
    </div>
  );
}

// ── COLLECTION ROW: tag style ───────────────────────────────────────
export function CollectionRow({ item, targetLanguage, allTranslations, onDelete, onContentSaved, onTranslationSaved }) {
  const h = useTranslationRow(item, targetLanguage, allTranslations, onContentSaved, onTranslationSaved);
  return (
    <div className="group grid grid-cols-2 divide-x divide-pink-100 border-b border-pink-50 last:border-b-0 hover:bg-pink-50/30 transition-colors">
      <div className="px-5 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-lg">🏷️</span>
          {h.editingOrig
            ? <input type="text" className="input-field text-sm font-semibold" value={h.editOrig} onChange={e => h.setEditOrig(e.target.value)} autoFocus/>
            : <p className="text-sm font-semibold text-slate-800">{item.source_text}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <EditControls editing={h.editingOrig} saving={h.savingOrig} onEdit={() => { h.setEditingOrig(true); h.setEditOrig(item.source_text); }} onSave={h.saveOrig} onCancel={() => h.setEditingOrig(false)} />
          <button onClick={() => onDelete(item.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"><Trash2 className="h-3 w-3"/></button>
        </div>
      </div>
      <div className="px-5 py-3 flex items-center justify-between gap-3 bg-pink-50/20">
        <div className="flex items-center gap-3">
          <span className="text-lg">{LANG_FLAGS[targetLanguage]}</span>
          {h.editingTrans
            ? <input type="text" className="input-field text-sm font-semibold" value={h.editTrans} onChange={e => h.setEditTrans(e.target.value)} autoFocus/>
            : h.translated
              ? <p className="text-sm font-semibold text-pink-800">{h.translated}</p>
              : <ManualInput editTrans={h.editTrans} setEditTrans={h.setEditTrans} saveTrans={h.saveTrans} savingTrans={h.savingTrans} targetLanguage={targetLanguage}/>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {h.translated && <EditControls editing={h.editingTrans} saving={h.savingTrans} onEdit={() => { h.setEditingTrans(true); h.setEditTrans(h.translated); }} onSave={() => h.saveTrans(h.editTrans)} onCancel={() => h.setEditingTrans(false)} saveIcon={Save}/>}
          <TransBtn loading={h.isTranslating} hasTranslation={!!h.translated} onClick={h.translate}/>
        </div>
      </div>
    </div>
  );
}

// ── DESCRIPTION ROW: multi-line text area ───────────────────────────
export function DescriptionRow({ item, targetLanguage, allTranslations, onDelete, onContentSaved, onTranslationSaved }) {
  const h = useTranslationRow(item, targetLanguage, allTranslations, onContentSaved, onTranslationSaved);
  return (
    <div className="group grid grid-cols-2 divide-x divide-emerald-100 border-b border-emerald-50 last:border-b-0 hover:bg-emerald-50/20 transition-colors">
      <div className="px-5 py-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">{item.key}</span>
          <div className="flex items-center gap-2">
            <EditControls editing={h.editingOrig} saving={h.savingOrig} onEdit={() => { h.setEditingOrig(true); h.setEditOrig(item.source_text); }} onSave={h.saveOrig} onCancel={() => h.setEditingOrig(false)} />
            <button onClick={() => onDelete(item.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"><Trash2 className="h-3 w-3"/></button>
          </div>
        </div>
        {h.editingOrig
          ? <textarea rows={4} className="input-field resize-none text-sm leading-relaxed" value={h.editOrig} onChange={e => h.setEditOrig(e.target.value)} autoFocus/>
          : <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{item.source_text}</p>}
      </div>
      <div className="px-5 py-4 flex flex-col gap-2 bg-emerald-50/30">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">{LANG_FLAGS[targetLanguage]} {targetLanguage}</span>
          <div className="flex items-center gap-2">
            {h.translated && <EditControls editing={h.editingTrans} saving={h.savingTrans} onEdit={() => { h.setEditingTrans(true); h.setEditTrans(h.translated); }} onSave={() => h.saveTrans(h.editTrans)} onCancel={() => h.setEditingTrans(false)} saveIcon={Save}/>}
            <TransBtn loading={h.isTranslating} hasTranslation={!!h.translated} onClick={h.translate}/>
          </div>
        </div>
        {h.editingTrans
          ? <textarea rows={4} className="input-field resize-none text-sm leading-relaxed" value={h.editTrans} onChange={e => h.setEditTrans(e.target.value)} autoFocus/>
          : h.translated
            ? <p className="text-sm text-emerald-900 leading-relaxed whitespace-pre-wrap">{h.translated}</p>
            : <ManualInput editTrans={h.editTrans} setEditTrans={h.setEditTrans} saveTrans={h.saveTrans} savingTrans={h.savingTrans} targetLanguage={targetLanguage}/>}
      </div>
    </div>
  );
}

// ── PARAGRAPH ROW: body text with line count ────────────────────────
export function ParagraphRow({ item, targetLanguage, allTranslations, onDelete, onContentSaved, onTranslationSaved }) {
  const h = useTranslationRow(item, targetLanguage, allTranslations, onContentSaved, onTranslationSaved);
  return (
    <div className="group grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors">
      <div className="px-5 py-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{item.key} · {item.source_text.length} chars</span>
          <div className="flex items-center gap-2">
            <EditControls editing={h.editingOrig} saving={h.savingOrig} onEdit={() => { h.setEditingOrig(true); h.setEditOrig(item.source_text); }} onSave={h.saveOrig} onCancel={() => h.setEditingOrig(false)} />
            <button onClick={() => onDelete(item.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"><Trash2 className="h-3 w-3"/></button>
          </div>
        </div>
        {h.editingOrig
          ? <textarea rows={5} className="input-field resize-none text-sm leading-relaxed" value={h.editOrig} onChange={e => h.setEditOrig(e.target.value)} autoFocus/>
          : <p className="text-sm text-slate-600 leading-loose">{item.source_text}</p>}
      </div>
      <div className="px-5 py-4 flex flex-col gap-2 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{LANG_FLAGS[targetLanguage]} {targetLanguage}{h.translated ? ` · ${h.translated.length} chars` : ""}</span>
          <div className="flex items-center gap-2">
            {h.translated && <EditControls editing={h.editingTrans} saving={h.savingTrans} onEdit={() => { h.setEditingTrans(true); h.setEditTrans(h.translated); }} onSave={() => h.saveTrans(h.editTrans)} onCancel={() => h.setEditingTrans(false)} saveIcon={Save}/>}
            <TransBtn loading={h.isTranslating} hasTranslation={!!h.translated} onClick={h.translate}/>
          </div>
        </div>
        {h.editingTrans
          ? <textarea rows={5} className="input-field resize-none text-sm leading-relaxed" value={h.editTrans} onChange={e => h.setEditTrans(e.target.value)} autoFocus/>
          : h.translated
            ? <p className="text-sm text-slate-700 leading-loose">{h.translated}</p>
            : <ManualInput editTrans={h.editTrans} setEditTrans={h.setEditTrans} saveTrans={h.saveTrans} savingTrans={h.savingTrans} targetLanguage={targetLanguage}/>}
      </div>
    </div>
  );
}
