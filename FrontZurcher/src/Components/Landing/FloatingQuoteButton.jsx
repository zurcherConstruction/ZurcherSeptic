import { useEffect, useRef } from 'react';

// El botón flotante ahora es uno solo (ZurcherChatWidget). Este componente ya no dibuja nada:
// solo conecta el "Schedule Free Quote" del chat con el modal de presupuesto de cada página.
export const OPEN_QUOTE_EVENT = 'zurcher:open-quote';

const FloatingQuoteButton = ({ onClick }) => {
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  useEffect(() => {
    const handler = (e) => {
      e.detail.handled = true;
      onClickRef.current?.();
    };
    window.addEventListener(OPEN_QUOTE_EVENT, handler);
    return () => window.removeEventListener(OPEN_QUOTE_EVENT, handler);
  }, []);

  return null;
};

export default FloatingQuoteButton;
