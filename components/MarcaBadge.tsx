export function MarcaBadge({ nome, cor }: { nome: string; cor: string }) {
  const inicial = nome.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      title={nome}
      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white shrink-0"
      style={{ backgroundColor: cor }}
    >
      {inicial}
    </span>
  );
}
