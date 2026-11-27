import { useCallback, useEffect, useRef, useState } from 'react';
import Icone from './Icone.jsx';

/**
 * Leitor de QR Code / código de barras com três formas de entrada:
 * 1. Câmera (computador ou celular) — usa o BarcodeDetector nativo quando o navegador tem
 *    (lê QR e códigos de barras) e o jsQR como alternativa (QR Code)
 * 2. Foto — tira/escolhe uma foto da etiqueta (funciona mesmo sem HTTPS)
 * 3. Digitação ou leitor USB/Bluetooth (que "digita" o código e aperta Enter)
 *
 * onLeitura(texto) é chamado a cada leitura. A mesma leitura repetida em menos de 2,5 s é ignorada.
 */
const FORMATOS = ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'data_matrix', 'upc_a'];

async function criarDetector() {
  if ('BarcodeDetector' in window) {
    try {
      const suportados = await window.BarcodeDetector.getSupportedFormats();
      const formatos = FORMATOS.filter((f) => suportados.includes(f));
      if (formatos.includes('qr_code')) {
        const detector = new window.BarcodeDetector({ formats: formatos });
        return async (fonte) => (await detector.detect(fonte))[0]?.rawValue || null;
      }
    } catch {
      /* usa o jsQR */
    }
  }
  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return async (fonte) => {
    const largura = fonte.videoWidth || fonte.naturalWidth || fonte.width;
    const altura = fonte.videoHeight || fonte.naturalHeight || fonte.height;
    if (!largura || !altura) return null;
    // Reduz imagens grandes (fotos do celular) para ganhar velocidade
    const escala = Math.min(1, 1000 / Math.max(largura, altura));
    canvas.width = Math.round(largura * escala);
    canvas.height = Math.round(altura * escala);
    ctx.drawImage(fonte, 0, 0, canvas.width, canvas.height);
    const imagem = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(imagem.data, imagem.width, imagem.height, { inversionAttempts: 'attemptBoth' })?.data || null;
  };
}

export default function LeitorCodigo({ onLeitura, rotuloManual = 'Código, nº de série ou MAC', autoFocoManual = true, iniciarCamera = false }) {
  const video = useRef(null);
  const fluxo = useRef(null);
  const detector = useRef(null);
  const ultima = useRef({ texto: '', em: 0 });
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [erroCamera, setErroCamera] = useState('');
  const [manual, setManual] = useState('');
  const [processandoFoto, setProcessandoFoto] = useState(false);

  const entregar = useCallback(
    (texto) => {
      const valor = String(texto || '').trim();
      if (!valor) return;
      const agora = Date.now();
      if (valor === ultima.current.texto && agora - ultima.current.em < 2500) return;
      ultima.current = { texto: valor, em: agora };
      navigator.vibrate?.(80);
      onLeitura(valor);
    },
    [onLeitura]
  );

  const pararCamera = useCallback(() => {
    fluxo.current?.getTracks().forEach((t) => t.stop());
    fluxo.current = null;
    setCameraAtiva(false);
  }, []);

  async function ligarCamera() {
    setErroCamera('');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setErroCamera(
        'O navegador só libera a câmera em endereço seguro (HTTPS) ou em localhost. Use "Ler por foto" ou configure HTTPS (ver Guia de Instalação).'
      );
      return;
    }
    try {
      detector.current = detector.current || (await criarDetector());
      fluxo.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      video.current.srcObject = fluxo.current;
      await video.current.play();
      setCameraAtiva(true);
    } catch (erro) {
      pararCamera();
      setErroCamera(
        erro.name === 'NotAllowedError'
          ? 'Permissão da câmera negada. Libere o acesso à câmera nas configurações do navegador.'
          : erro.name === 'NotFoundError'
            ? 'Nenhuma câmera encontrada neste dispositivo.'
            : `Não foi possível abrir a câmera: ${erro.message}`
      );
    }
  }

  // Varre os quadros do vídeo enquanto a câmera está ligada
  useEffect(() => {
    if (!cameraAtiva) return undefined;
    let parado = false;
    let ocupado = false;
    const timer = setInterval(async () => {
      if (parado || ocupado || !video.current || video.current.readyState < 2) return;
      ocupado = true;
      try {
        const texto = await detector.current(video.current);
        if (texto && !parado) entregar(texto);
      } catch {
        /* quadro ilegível */
      } finally {
        ocupado = false;
      }
    }, 250);
    return () => {
      parado = true;
      clearInterval(timer);
    };
  }, [cameraAtiva, entregar]);

  useEffect(() => {
    if (iniciarCamera) ligarCamera();
    return () => pararCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lerFoto(e) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    setProcessandoFoto(true);
    setErroCamera('');
    try {
      detector.current = detector.current || (await criarDetector());
      const imagem = new Image();
      const url = URL.createObjectURL(arquivo);
      await new Promise((ok, falha) => {
        imagem.onload = ok;
        imagem.onerror = falha;
        imagem.src = url;
      });
      const texto = await detector.current(imagem);
      URL.revokeObjectURL(url);
      if (texto) entregar(texto);
      else setErroCamera('Nenhum código encontrado na foto. Aproxime a câmera da etiqueta, com boa luz, e tente de novo.');
    } catch {
      setErroCamera('Não foi possível ler a foto.');
    } finally {
      setProcessandoFoto(false);
    }
  }

  function enviarManual(e) {
    e.preventDefault();
    if (!manual.trim()) return;
    ultima.current = { texto: '', em: 0 }; // digitação sempre conta, mesmo repetida
    entregar(manual);
    setManual('');
  }

  return (
    <div className="leitor">
      <div className={`leitor-video ${cameraAtiva ? 'ativo' : ''}`}>
        <video ref={video} playsInline muted aria-label="Imagem da câmera" />
        {cameraAtiva && <div className="leitor-mira" aria-hidden="true" />}
        {!cameraAtiva && (
          <div className="leitor-desligado">
            <Icone nome="qrcode" tamanho={40} />
            <span>Aponte a câmera para o QR Code da etiqueta</span>
          </div>
        )}
      </div>

      <div className="leitor-botoes">
        {cameraAtiva ? (
          <button type="button" className="botao" onClick={pararCamera}>Desligar câmera</button>
        ) : (
          <button type="button" className="botao botao-primario" onClick={ligarCamera}>
            <Icone nome="camera" tamanho={16} /> Ligar câmera
          </button>
        )}
        <label className="botao">
          <Icone nome="foto" tamanho={16} /> {processandoFoto ? 'Lendo…' : 'Ler por foto'}
          <input type="file" accept="image/*" capture="environment" onChange={lerFoto} hidden />
        </label>
      </div>

      {erroCamera && <div className="aviso aviso-erro" role="alert">{erroCamera}</div>}

      <form className="leitor-manual" onSubmit={enviarManual}>
        <label className="campo">
          <span className="campo-rotulo">{rotuloManual}</span>
          <span className="texto-suave campo-dica">Leitor de código de barras USB/Bluetooth: clique aqui e bipe a etiqueta.</span>
          <div className="leitor-manual-linha">
            <input
              className="mono"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              autoFocus={autoFocoManual}
              autoCapitalize="characters"
              autoComplete="off"
              enterKeyHint="search"
              placeholder="Bipe ou digite e aperte Enter"
            />
            <button type="submit" className="botao">Buscar</button>
          </div>
        </label>
      </form>
    </div>
  );
}
