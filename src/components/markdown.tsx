/* Простой рендеринг markdown-документов (заголовки, абзацы, списки) */
export function Markdown({ text }: { text: string }) {
  const blocks = text.split("\n\n");
  return (
    <div className="space-y-5">
      {blocks.map((block, i) => {
        if (block.startsWith("## ")) {
          return (
            <h2 key={i} className="font-display font-bold text-[20px] text-ink pt-3 first:pt-0">
              {block.replace("## ", "")}
            </h2>
          );
        }
        if (block.startsWith("- ")) {
          return (
            <ul key={i} className="space-y-2">
              {block.split("\n").map((li, j) => (
                <li key={j} className="flex gap-3 text-[14.5px] leading-relaxed text-ink-soft">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 mt-2.5" />
                  <span>{li.replace("- ", "")}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-[14.5px] leading-relaxed text-ink-soft">
            {block}
          </p>
        );
      })}
    </div>
  );
}
