/** Tiny element builder. Text always goes through text nodes, never HTML. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { className?: string; text?: string; attrs?: Record<string, string> } = {},
  ...children: Array<Node | string | null | false>
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (props.className) element.className = props.className;
  if (props.text !== undefined) element.textContent = props.text;
  for (const [name, value] of Object.entries(props.attrs ?? {})) element.setAttribute(name, value);
  for (const child of children) {
    if (child === null || child === false) continue;
    element.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return element;
}

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

/** A role="switch" checkbox inside the shared switch markup. */
export function switchControl(key: string, label?: string): { root: HTMLSpanElement; input: HTMLInputElement } {
  const input = h('input', { attrs: { type: 'checkbox', role: 'switch', 'data-key': key } });
  if (label) input.setAttribute('aria-label', label);
  const root = h('span', { className: 'switch' }, input, h('span', { attrs: { 'aria-hidden': 'true' } }));
  return { root, input };
}
