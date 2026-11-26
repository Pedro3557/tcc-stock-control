const PERFIS = ['admin', 'almoxarife', 'consulta'];

const TIPOS_CONTROLE = ['serializado', 'quantidade'];

const UNIDADES = ['un', 'm', 'cx', 'pct', 'rolo'];
// Unidades que só aceitam quantidades inteiras
const UNIDADES_INTEIRAS = ['un', 'cx', 'pct', 'rolo'];

const STATUS_EQUIPAMENTO = [
  'em_estoque',
  'com_tecnico',
  'instalado_cliente',
  'em_manutencao',
  'defeito',
  'baixado',
];

const STATUS_ROTULO = {
  em_estoque: 'Em estoque',
  com_tecnico: 'Com técnico',
  instalado_cliente: 'Instalado no cliente (comodato)',
  em_manutencao: 'Em manutenção',
  defeito: 'Defeito',
  baixado: 'Baixado',
};

const TIPOS_MOVIMENTACAO = [
  'entrada_compra',
  'saida_tecnico',
  'devolucao_tecnico',
  'instalacao_cliente',
  'retirada_cliente',
  'envio_manutencao',
  'retorno_manutencao',
  'baixa',
  'ajuste_inventario',
];

const TIPO_ROTULO = {
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

module.exports = {
  PERFIS,
  TIPOS_CONTROLE,
  UNIDADES,
  UNIDADES_INTEIRAS,
  STATUS_EQUIPAMENTO,
  STATUS_ROTULO,
  TIPOS_MOVIMENTACAO,
  TIPO_ROTULO,
};
