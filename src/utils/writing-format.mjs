// Keep the text selection when focus moves to a formatting control.
export function initWritingFormat({ editor, color, size, toolbar, message }) {
  if (!editor || !toolbar) return;
  const textarea = editor instanceof HTMLTextAreaElement;
  let saved = null;
  let history = [], future = [];
  function remember() {
    if (textarea) saved = [editor.selectionStart, editor.selectionEnd];
    else {
      const selection = window.getSelection();
      if (selection?.rangeCount && editor.contains(selection.anchorNode) && editor.contains(selection.focusNode)) saved = selection.getRangeAt(0).cloneRange();
    }
  }
  editor.addEventListener('select', remember);
  editor.addEventListener('keyup', remember);
  editor.addEventListener('mouseup', remember);
  document.addEventListener('selectionchange', () => { if (document.activeElement === editor) remember(); });
  toolbar.addEventListener('pointerdown', () => { if (document.activeElement === editor) remember(); });
  function notify(text) { if (message) message.textContent = text; }
  function restore() {
    if (editor.readOnly || (!textarea && editor.contentEditable !== 'true')) return false;
    if (!saved || (textarea ? saved[0] === saved[1] : saved.collapsed)) { notify('请先选中需要调整的正文文字，再选择颜色或字号。'); return false; }
    editor.focus();
    if (textarea) editor.setSelectionRange(...saved);
    else { if (!editor.contains(saved.commonAncestorContainer)) return false; const selection=window.getSelection();selection.removeAllRanges();selection.addRange(saved); }
    return true;
  }
  function snapshot() { return {value:editor.value, selection:[editor.selectionStart,editor.selectionEnd]}; }
  function changed() { editor.dispatchEvent(new Event('input',{bubbles:true}));remember(); }
  function apply(property,value) {
    if (!restore()) return;
    if (textarea) {
      const [start,end]=saved;
      const selected=editor.value.slice(start,end);
      const frontmatter=editor.value.match(/^---\s*\n[\s\S]*?\n---\s*\n/);
      if ((frontmatter && start<frontmatter[0].length) || /```|\$|<\/?(?!span\b)[a-z][^>]*>/i.test(selected)) { notify('请只选择正文文字；公式、代码和元数据请使用对应编辑工具。'); return; }
      history.push(snapshot());future=[];
      const formatLine=line=>{
        if (!line.trim()) return line;
        // Keep Markdown headings, list markers and quotes outside the inline span.
        const prefix=line.match(/^(\s*(?:#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s*)?)/)[0];
        let text=line.slice(prefix.length), styles={};
        const outer=text.match(/^<span style="([^"]*)">([\s\S]*)<\/span>$/);
        if(outer) { for(const part of outer[1].split(';')) { const [key,val]=part.split(':');if(key&&val)styles[key.trim()]=val.trim(); }text=outer[2]; }
        text=text.replace(/<span style="([^"]*)">/g,(_,style)=>{const kept=style.split(';').filter(part=>part.trim()&&!part.trim().startsWith(property+':'));return kept.length?`<span style="${kept.join(';')}">`: '<span>';});
        if(property==='clear') {text=text.replace(/<\/?span(?: style="[^"]*")?>/g,'');styles={};}
        else styles[property]=value;
        const css=Object.entries(styles).map(([key,val])=>`${key}:${val}`).join(';');
        return prefix+(css?`<span style="${css}">${text}</span>`:text);
      };
      const replacement=selected.split('\n').map(formatLine).join('\n');
      editor.setRangeText(replacement,start,end,'select');changed();
    } else {
      document.execCommand('styleWithCSS',false,true);
      if(property==='clear') document.execCommand('removeFormat');
      else if(property==='color') document.execCommand('foreColor',false,value);
      else {
        document.execCommand('fontSize',false,'7');
        editor.querySelectorAll('font[size="7"],span').forEach(node=>{
          if(node.getAttribute('size')==='7'||node.style.fontSize==='xxx-large'){
            node.removeAttribute('size');node.style.fontSize=value;
          }
        });
      }
      changed();
    }
    notify(property==='clear'?'已清除所选文字格式':'已更新所选文字；可继续调整颜色或字号。');
  }
  color.addEventListener('change',()=>apply('color',color.value));
  size.addEventListener('change',()=>apply('font-size',size.value+'px'));
  toolbar.querySelectorAll('[data-text-color]').forEach(button=>button.addEventListener('click',()=>{color.value=button.dataset.textColor;apply('color',color.value);}));
  toolbar.querySelector('[data-clear-format]')?.addEventListener('click',()=>apply('clear',''));
  for(const direction of ['undo','redo']) toolbar.querySelector(`[data-format-${direction}]`)?.addEventListener('click',()=>{
    editor.focus();
    if(!textarea){document.execCommand(direction);changed();return;}
    const from=direction==='undo'?history:future,to=direction==='undo'?future:history;
    const state=from.pop();if(!state)return;to.push(snapshot());editor.value=state.value;editor.setSelectionRange(...state.selection);changed();
  });
  // Invalidate format-only history after ordinary typing or a document switch.
  editor.addEventListener('beforeinput',()=>{history=[];future=[];});
  document.querySelector('#docSection')?.addEventListener('change',()=>{saved=null;history=[];future=[];});
}
