import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const proximoId = useRef(1);

  const remover = useCallback((id) => setToasts((lista) => lista.filter((t) => t.id !== id)), []);

  const mostrar = useCallback(
    (tipo, mensagem) => {
      const id = proximoId.current++;
      setToasts((lista) => [...lista.slice(-3), { id, tipo, mensagem }]);
      setTimeout(() => remover(id), tipo === 'erro' ? 6000 : 3500);
    },
    [remover]
  );

  const valor = useMemo(
    () => ({ sucesso: (m) => mostrar('sucesso', m), erro: (m) => mostrar('erro', m), info: (m) => mostrar('info', m) }),
    [mostrar]
  );

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tipo}`}>
            <span className="toast-icone" aria-hidden="true">{t.tipo === 'erro' ? '!' : t.tipo === 'sucesso' ? '✓' : 'i'}</span>
            <span className="toast-texto">{t.mensagem}</span>
            <button type="button" className="toast-fechar" onClick={() => remover(t.id)} aria-label="Fechar">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
