import { FilePlus2 } from 'lucide-react';
import { useTranslation } from '../i18n';
import { useFormattingStore } from '../editor/useFormattingEditor';

/** Independent of the selection popup. The active editor owns the command
 * so a header click never inserts a note into an unrelated document. */
export function HeaderNoteInsertButton({className='focus-menu-button',publication=false}:{className?:string;publication?:boolean}) {
  const {t}=useTranslation();
  const target=useFormattingStore(state=>state.target);
  const label=t('editor.insertNote');
  const available=Boolean(target?.insertNote && !target.editor.isDestroyed && target.editor.isEditable
    && Boolean(target.editor.view.dom.closest('.publication-document-canvas'))===publication);
  return <button type="button" className={className+' focus-insert-note-button'} aria-label={label} title={label}
    disabled={!available} onMouseDown={event=>event.preventDefault()}
    onClick={()=>{
      const current=useFormattingStore.getState().target;
      if(current?.insertNote&&!current.editor.isDestroyed&&current.editor.isEditable
        && Boolean(current.editor.view.dom.closest('.publication-document-canvas'))===publication)current.insertNote();
    }}>
    <FilePlus2 size={18} aria-hidden="true"/>
  </button>;
}
