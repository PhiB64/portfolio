import { Pill } from "./Pill";

export function PillRow({ items }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <Pill key={`${item}-${index}`}>{item}</Pill>
      ))}
    </div>
  );
}
