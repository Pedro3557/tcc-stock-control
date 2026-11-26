export const STATUS = {
  em_estoque: 'Em estoque',
  com_tecnico: 'Com técnico',
  instalado_cliente: 'Comodato (cliente)',
  em_manutencao: 'Em manutenção',
  defeito: 'Defeito',
  baixado: 'Baixado',
};

export const TIPOS = {
  entrada_compra: 'Entrada (compra)',
  saida_tecnico: 'Saída para técnico',
  devolucao_tecnico: 'Devolução do técnico',
  instalacao_cliente: 'Instalação no cliente',
  retirada_cliente: 'Retirada do cliente',
  envio_manutencao: 'Envio para manutenção',
  retorno_manutencao: 'Retorno da manutenção',
  baixa: 'Baixa',
  ajuste_inventario: 'Ajuste de inventário',
};

export const PERFIS = {
  admin: 'Administrador',
  almoxarife: 'Almoxarife',
  consulta: 'Consulta',
};

export const UNIDADES = {
  un: 'Unidade (un)',
  m: 'Metro (m)',
  cx: 'Caixa (cx)',
  pct: 'Pacote (pct)',
  rolo: 'Rolo',
};

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatarMoeda = (v) => moeda.format(Number(v || 0));

export function formatarQtd(v, unidade) {
  const n = Number(v || 0);
  const texto = n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
  return unidade ? `${texto} ${unidade}` : texto;
}

export function formatarDataHora(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function hojeISO(deslocamentoDias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + deslocamentoDias);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
