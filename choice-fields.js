// Accessible, app-owned choice sheets replace platform-dependent select popups.
const bindings=new Map();
let describe=()=>'',active=null;
export function refreshChoiceFields(){
 for(const [select,button] of bindings){
  const option=select.selectedOptions[0];button.querySelector('.choice-value').textContent=option?.textContent||'请选择';button.disabled=select.disabled;
  const subtitle=button.querySelector('.choice-subtitle');if(subtitle)subtitle.textContent=describe(select,select.value,true)||'点此切换已保存的和弦组';
 }
}
export function initChoiceFields(description){
 describe=description;
 const dialog=document.getElementById('choiceDialog'),list=document.getElementById('choiceOptions');
 const close=()=>{dialog.close();active?.focus();};document.getElementById('closeChoices').onclick=close;
 for(const select of document.querySelectorAll('select')){
  const button=document.createElement('button');button.type='button';button.className='choice-field'+(select.id==='setSelect'?' set-choice':'');
  button.dataset.forSelect=select.id;button.setAttribute('aria-haspopup','dialog');
  const label=select.getAttribute('aria-label')||document.querySelector(`label[for="${select.id}"]`)?.textContent||select.closest('label')?.childNodes[0]?.textContent||'选择';
  button.setAttribute('aria-label',label.trim());
  button.innerHTML='<span class="choice-content"><span class="choice-value"></span>'+(select.id==='setSelect'?'<span class="choice-subtitle"></span>':'')+'</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>';
  select.hidden=true;select.after(button);bindings.set(select,button);
  button.onclick=()=>{
   active=button;document.getElementById('choiceTitle').textContent=select.id==='setSelect'?'我的和弦组':label.trim();
   const helper=document.getElementById('choiceHelp');helper.textContent=select.id==='setSelect'?'选好一组，接着弹。':'选择后立即应用到当前设置';list.replaceChildren();
   for(const option of select.options){
    const item=document.createElement('button');item.type='button';item.className='choice-option';item.setAttribute('aria-pressed',option.selected);item.disabled=option.disabled;
    const text=document.createElement('span'),name=document.createElement('strong');name.textContent=option.textContent;text.append(name);
    const detail=describe(select,option.value);if(detail){const small=document.createElement('small');small.textContent=detail;text.append(small);}
    const check=document.createElement('span');check.className='choice-check';check.textContent=option.selected?'✓':'';item.append(text,check);
    item.onclick=()=>{dialog.close();select.value=option.value;select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));refreshChoiceFields();if(!document.querySelector('dialog[open]'))button.focus();};list.append(item);
   }
   dialog.showModal();list.querySelector('[aria-pressed="true"]')?.scrollIntoView({block:'nearest'});
  };
  new MutationObserver(refreshChoiceFields).observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','selected']});
 }
 refreshChoiceFields();
}
