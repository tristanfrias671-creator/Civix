// Copies text to the clipboard and resolves true when it worked. Some phone browsers
// (the in-app browsers of Facebook and Messenger, older Android ones) have no modern
// clipboard, so a hidden text box and the older copy command are the fallback.
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the older way
  }
  const box = document.createElement('textarea');
  box.value = text;
  box.setAttribute('readonly', ''); // no keyboard popping up on phones
  box.style.cssText = 'position:fixed; top:0; left:0; width:1px; height:1px; opacity:0;';
  document.body.appendChild(box);
  try {
    box.select();
    box.setSelectionRange(0, text.length); // iPhone
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    box.remove();
  }
}
