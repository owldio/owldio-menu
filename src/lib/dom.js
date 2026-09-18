export function createElement(tagName, className, value) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (value !== undefined && value !== null) node.textContent = value;
  return node;
}
