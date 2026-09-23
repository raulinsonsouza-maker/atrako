/** Split a Markdown table row without treating escaped pipes as separators. */
export function splitMarkdownTableRow(line: string): string[] {
  let source = line.trim();
  if (source.startsWith("|")) source = source.slice(1);
  if (source.endsWith("|")) {
    let slashCount = 0;
    for (let index = source.length - 2; index >= 0 && source[index] === "\\"; index -= 1) slashCount += 1;
    if (slashCount % 2 === 0) source = source.slice(0, -1);
  }
  const cells: string[] = [];
  let current = "";
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === "\\" && source[index + 1] === "|") {
      current += "|";
      index += 1;
    } else if (character === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  cells.push(current.trim());
  return cells;
}