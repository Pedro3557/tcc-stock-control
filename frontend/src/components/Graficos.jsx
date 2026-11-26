import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { STATUS } from '../services/formatos.js';

// Cores das séries (paleta categórica validada para daltonismo: azul e laranja).
// Texto, eixos e legendas usam as cores de texto do sistema, nunca a cor da série.
const COR = { entradas: '#257de0', saidas: '#f47230' };
const TEXTO_2 = '#555555';
const GRADE = '#ececec';

const diaCurto = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function Legenda({ itens }) {
  return (
    <ul className="grafico-legenda">
      {itens.map((i) => (
        <li key={i.rotulo}>
          <span className="grafico-legenda-cor" style={{ background: i.cor }} aria-hidden="true" />
          {i.rotulo}
        </li>
      ))}
    </ul>
  );
}

function DicaMovimentacoes({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const linha = payload[0].payload;
  return (
    <div className="grafico-dica">
      <strong>{diaCurto(label)}</strong>
      <div><span className="grafico-legenda-cor" style={{ background: COR.entradas }} /> Entradas: {linha.entradas}</div>
      <div><span className="grafico-legenda-cor" style={{ background: COR.saidas }} /> Saídas: {linha.saidas}</div>
    </div>
  );
}

/** Barras empilhadas: entradas x saídas por dia (últimos 14 dias). */
export function GraficoMovimentacoes({ dados }) {
  const total = dados.reduce((s, d) => s + d.entradas + d.saidas, 0);
  return (
    <section className="cartao grafico">
      <div className="grafico-cabecalho">
        <div>
          <h2>Movimentações por dia</h2>
          <p className="texto-suave">Últimos 14 dias · {total} registro(s) · cada unidade serializada conta como 1</p>
        </div>
        <Legenda itens={[{ rotulo: 'Entradas', cor: COR.entradas }, { rotulo: 'Saídas', cor: COR.saidas }]} />
      </div>
      <div className="grafico-area" role="img" aria-label={`Gráfico de entradas e saídas por dia nos últimos 14 dias, total de ${total} registros. A tabela abaixo traz os mesmos números.`}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dados} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={GRADE} />
            <XAxis dataKey="dia" tickFormatter={diaCurto} tick={{ fill: TEXTO_2, fontSize: 11 }} axisLine={{ stroke: '#d6d6d6' }} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
            <YAxis allowDecimals={false} tick={{ fill: TEXTO_2, fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
            <Tooltip content={<DicaMovimentacoes />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
            {/* Contorno da cor do fundo = 2px de respiro entre os segmentos empilhados */}
            <Bar dataKey="entradas" stackId="m" fill={COR.entradas} stroke="#fff" strokeWidth={2} maxBarSize={24} isAnimationActive={false} />
            <Bar dataKey="saidas" stackId="m" fill={COR.saidas} stroke="#fff" strokeWidth={2} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="grafico-tabela">
        <summary>Ver em tabela</summary>
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead><tr><th>Dia</th><th className="num">Entradas</th><th className="num">Saídas</th></tr></thead>
            <tbody>
              {dados.map((d) => (
                <tr key={d.dia}>
                  <td data-rotulo="Dia">{diaCurto(d.dia)}</td>
                  <td data-rotulo="Entradas" className="num">{d.entradas}</td>
                  <td data-rotulo="Saídas" className="num">{d.saidas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function DicaStatus({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { rotulo, total } = payload[0].payload;
  return (
    <div className="grafico-dica">
      <strong>{rotulo}</strong>
      <div>{total} unidade(s)</div>
    </div>
  );
}

/** Barras horizontais: quantas unidades serializadas há em cada status. */
export function GraficoStatus({ equipamentos }) {
  const dados = [
    { status: 'em_estoque', total: equipamentos.emEstoque },
    { status: 'com_tecnico', total: equipamentos.comTecnico },
    { status: 'instalado_cliente', total: equipamentos.emComodato },
    { status: 'em_manutencao', total: equipamentos.emManutencao },
    { status: 'defeito', total: equipamentos.comDefeito },
    { status: 'baixado', total: equipamentos.baixados },
  ].map((d) => ({ ...d, rotulo: d.status === 'instalado_cliente' ? 'Comodato' : STATUS[d.status] }));
  const total = dados.reduce((s, d) => s + d.total, 0);

  return (
    <section className="cartao grafico">
      <div className="grafico-cabecalho">
        <div>
          <h2>Equipamentos por status</h2>
          <p className="texto-suave">{total} unidade(s) serializada(s) cadastrada(s)</p>
        </div>
      </div>
      <div className="grafico-area" role="img" aria-label={`Equipamentos por status: ${dados.map((d) => `${d.rotulo} ${d.total}`).join(', ')}.`}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 36, left: 0, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid horizontal={false} stroke={GRADE} />
            <XAxis type="number" allowDecimals={false} tick={{ fill: TEXTO_2, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="rotulo" width={128} tick={{ fill: '#111', fontSize: 12 }} axisLine={{ stroke: '#d6d6d6' }} tickLine={false} />
            <Tooltip content={<DicaStatus />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
            <Bar dataKey="total" fill={COR.entradas} maxBarSize={20} radius={[0, 4, 4, 0]} isAnimationActive={false}>
              <LabelList dataKey="total" position="right" fill="#111" fontSize={12} fontWeight={600} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
