/** Rótulo + campo de formulário com dica opcional. */
export default function Campo({ rotulo, dica, obrigatorio, children, className = '' }) {
  return (
    <label className={`campo ${className}`}>
      <span className="campo-rotulo">
        {rotulo}
        {obrigatorio && <span className="obrigatorio"> *</span>}
      </span>
      {children}
      {dica && <small className="campo-dica">{dica}</small>}
    </label>
  );
}
