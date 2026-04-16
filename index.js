require('dotenv').config();
const axios = require('axios');

const VTLOG_TOKEN = process.env.VTLOG_TOKEN;

async function buscarVTLogSimples(username) {
  try {
    const res = await axios.get(`https://api.vtlog.net/v3/users?search=${username}`, {
      headers: {
        Authorization: `Bearer ${VTLOG_TOKEN}`
      }
    });

    if (!res.data || res.data.length === 0) return null;

    return res.data[0];
  } catch (err) {
    console.log("Erro VTLOG:", err.message);
    return null;
  }
}

const express = require('express');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const path = require('path');

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});


const app = express();
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));

const db = new Database(path.join(__dirname, 'bot.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS trucky_links (
    discord_user_id TEXT PRIMARY KEY,
    trucky_username TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS trucky_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_name TEXT NOT NULL,
    trucky_username TEXT,
    payload_json TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// =====================
// CONFIGURAÇÕES
// =====================
const RH_CHANNEL_ID = '1494230375348699146';
const APROVACAO_CHANNEL_ID = '1494166444739399752';
const CARGO_EM_TESTE_ID = 1494223535017562204;
const CARGO_MOTORISTA_ID = '1224512468697743390';
const TRUCKY_LOG_CHANNEL_ID = process.env.TRUCKY_LOG_CHANNEL_ID || '';
const TRUCKY_WEBHOOK_SECRET = process.env.TRUCKY_WEBHOOK_SECRET || '';
const PORT = Number(process.env.PORT || 3000);

// =====================
// IDENTIDADE VISUAL
// =====================
const BRAND = {
  nome: 'Pimentel Turismo VTC',
  rodape: 'Pimentel Turismo VTC • Operação Virtual',
  slogan: 'Simulação com padrão de empresa real.',
  cores: {
    curta: 0x16a34a,
    media: 0xeab308,
    longa: 0xdc2626,
    funcionarios: 0x7c3aed,
    andamento: 0x2563eb,
    finalizada: 0x0ea5e9,
    historico: 0x64748b,
    index: 0x1d4ed8,
    base: 0x0f766e,
    embarque: 0x2563eb,
    desembarque: 0xf97316,
    descanso: 0x4b5563,
    abastecimento: 0x0f766e,
    limpeza: 0x7c3aed,
    rh: 0x2563eb,
    aprovacao: 0x16a34a,
    reprovacao: 0xdc2626
  }
};

const TEMPO_EMBARQUE_MS = 20000;
const TEMPO_DESEMBARQUE_MS = 20000;
const TEMPO_ABASTECIMENTO_MS = 15000;
const TEMPO_LIMPEZA_MS = 15000;

// =====================
// BASES
// =====================
const basesDeApoio = [
  { id: 'bh', cidade: 'Belo Horizonte', nome: 'Garagem original do mapa', abastecimento: false },
  { id: 'jf', cidade: 'Juiz de Fora', nome: 'Guanabara / Expresso', abastecimento: true },
  { id: 'rj', cidade: 'Rio de Janeiro', nome: 'Guanabara', abastecimento: false },
  { id: 'catanduva', cidade: 'Catanduva', nome: 'Real Expresso', abastecimento: false },
  { id: 'itaruma', cidade: 'Itarumã', nome: 'Húngaro', abastecimento: true },
  { id: 'cassilandia', cidade: 'Cassilândia', nome: 'Itapemirim', abastecimento: true },
  { id: 'aparecida_taboado', cidade: 'Aparecida do Taboado', nome: 'Itapemirim', abastecimento: true },
  { id: 'campo_grande', cidade: 'Campo Grande', nome: 'Itapemirim', abastecimento: true },
  { id: 'rio_verde', cidade: 'Rio Verde', nome: 'Itapemirim', abastecimento: true }
];

// =====================
// CIDADES
// =====================
const cidades = {
  1: "Belo Horizonte",
  4: "Ouro Branco",
  5: "Conselheiro Lafaiete",
  6: "Carandaí",
  8: "Barbacena",
  9: "Santos Dumont",
  10: "Juiz de Fora",
  18: "Rio de Janeiro",
  39: "São José dos Campos",
  47: "São Paulo",
  55: "Santos",
  66: "Catanduva",
  87: "Curitiba",
  100: "Campo Grande",
  110: "Itarumã",
  111: "Rio Verde",
  119: "Goiânia"
};

const lanches = {
  1: "☕ Graal Juiz de Fora",
  2: "☕ Graal Resende",
  3: "☕ Graal Aparecida",
  4: "☕ Graal Campinas",
  5: "☕ Parada de apoio Rio Verde",
  7: "☕ Parada de apoio Curitiba",
  8: "☕ Parada de apoio São José dos Campos",
  9: "☕ Parada de apoio São Paulo"
};

// =====================
// ROTAS
// =====================
const rotasCurtas = [
  { origem: 1, destino: 4, escalas: [] },
  { origem: 1, destino: 5, escalas: [4] },
  { origem: 1, destino: 6, escalas: [4, 5] },
  { origem: 1, destino: 8, escalas: [4, 5, 6] },
  { origem: 8, destino: 10, escalas: [9] }
];

const rotasMedias = [
  { origem: 1, destino: 18, escalas: [5, 8, 10], lanches: [1] },
  { origem: 18, destino: 1, escalas: [10, 8, 5], lanches: [1] },
  { origem: 47, destino: 55, escalas: [], lanches: [] },
  { origem: 47, destino: 87, escalas: [], lanches: [7] }
];

const rotasLongas = [
  { origem: 1, destino: 119, escalas: [111], lanches: [5] },
  { origem: 119, destino: 1, escalas: [111], lanches: [5] },
  { origem: 1, destino: 100, escalas: [47], lanches: [4, 9] }
];

const rotasFuncionariosFixas = [
  {
    empresa: "Itaipava",
    origem: "Três Rios",
    destino: "Itaipava",
    rota: "Três Rios > Petrópolis > Itaipava > Juiz de Fora",
    turno: "Manhã"
  },
  {
    empresa: "Mercedes-Benz",
    origem: "Santos Dumont",
    destino: "Juiz de Fora",
    rota: "Santos Dumont > Juiz de Fora",
    turno: "Manhã"
  },
  {
    empresa: "Húngaro Transportes",
    origem: "Aparecida do Rio Doce",
    destino: "Itarumã",
    rota: "Aparecida do Rio Doce > Caçu > Itajá > Itarumã",
    turno: "Tarde"
  }
];

// =====================
// ESTADO
// =====================
const viagensFixas = {};
const viagensManuais = {};
const viagensFuncionarios = {};

let proximoIdManual = 900001;
let proximoIdFuncionario = 990001;
let proximoServicoId = 1;

// {
//   status: 'livre' | 'viagem' | 'funcionarios',
//   tipo: 'normal' | 'funcionarios' | null,
//   viagemId: string | number | null
// }
const estadoMotoristas = new Map();

// base separada
const estadoBaseMotoristas = new Map();

// id => { id, tipo, motoristaId, status, canalId, criadoEm }
const solicitacoesServico = new Map();

// =====================
// AUXILIARES
// =====================
function nomeCidade(id) {
  return cidades[id] || `ID ${id}`;
}

function textoEscalas(ids) {
  if (!ids || ids.length === 0) return 'Sem escalas';
  return ids.map(nomeCidade).join(', ');
}

function textoLanches(ids) {
  if (!ids || ids.length === 0) return 'Sem parada de apoio';
  return ids.map(id => lanches[id] || `Parada ${id}`).join(', ');
}

function obterViagem(id) {
  return viagensFixas[id] || viagensManuais[id] || null;
}

function obterFuncionario(id) {
  return viagensFuncionarios[id] || null;
}

function obterBase(id) {
  return basesDeApoio.find(b => b.id === id) || null;
}

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function estadoLivre() {
  return {
    status: 'livre',
    tipo: null,
    viagemId: null
  };
}

function getEstado(userId) {
  return estadoMotoristas.get(userId) || estadoLivre();
}

function setEstado(userId, novoEstado) {
  estadoMotoristas.set(userId, {
    ...estadoLivre(),
    ...novoEstado
  });
}

function limparEstadoMotorista(userId) {
  estadoMotoristas.delete(userId);
  estadoBaseMotoristas.delete(userId);
}

function textoBloqueio(userId) {
  const estado = getEstado(userId);

  if (estado.status === 'viagem') {
    return '❌ Você já está em uma viagem em andamento. Finalize essa operação antes de assumir outra.';
  }

  if (estado.status === 'funcionarios') {
    return '❌ Você já está em um transporte de funcionários em andamento. Finalize essa operação antes de assumir outra.';
  }

  return '❌ Você já possui uma operação em andamento.';
}

function resumoEstado(userId) {
  const estado = getEstado(userId);
  const base = estadoBaseMotoristas.get(userId) || null;

  const partes = [`status: ${estado.status}`];
  if (estado.tipo) partes.push(`tipo: ${estado.tipo}`);
  if (estado.viagemId) partes.push(`id: ${estado.viagemId}`);
  if (base) partes.push(`base: ${base.cidade} • ${base.nome}`);

  return partes.join(' | ');
}

function nomeBaseCanal(viagem) {
  return `${viagem.distancia}s-${viagem.tipo}`;
}

function encontrarCanalViagem(guild, viagem) {
  return guild.channels.cache.find(c => c.name.includes(nomeBaseCanal(viagem)));
}

function encontrarCanalIndex(guild) {
  return guild.channels.cache.find(c => c.name === '📌・index-de-viagens');
}

function encontrarCanalAndamento(guild) {
  return guild.channels.cache.find(c => c.name === '🚛・viagens-em-andamento');
}

function encontrarCanalHistorico(guild) {
  return guild.channels.cache.find(c => c.name === '📁・historico-de-viagens');
}

function encontrarCanalFuncionarios(guild) {
  return guild.channels.cache.find(c => c.name === '🏭・funcionarios-operacao');
}

function encontrarHistoricoFuncionarios(guild) {
  return guild.channels.cache.find(c => c.name === '📁・historico-funcionarios');
}

function corPorDistancia(distancia) {
  if (distancia === 'curta') return BRAND.cores.curta;
  if (distancia === 'media') return BRAND.cores.media;
  return BRAND.cores.longa;
}

function emojiDistancia(distancia) {
  if (distancia === 'curta') return '🟢';
  if (distancia === 'media') return '🟡';
  return '🔴';
}

function montarRotaIdaVolta(rotaTexto, origem, destino) {
  const partes = rotaTexto.split('>').map(t => t.trim()).filter(Boolean);
  if (!partes.length) return `IDA: ${origem} > ${destino}\nVOLTA: ${destino} > ${origem}`;
  return `IDA: ${partes.join(' > ')}\nVOLTA: ${[...partes].reverse().join(' > ')}`;
}

function gerarServicoId() {
  return String(proximoServicoId++);
}

function buscarSolicitacaoAbertaDoMotorista(motoristaId, tipos = []) {
  for (const [, solicitacao] of solicitacoesServico) {
    const tipoValido = tipos.length === 0 || tipos.includes(solicitacao.tipo);
    if (
      solicitacao.motoristaId === motoristaId &&
      tipoValido &&
      solicitacao.status !== 'finalizado'
    ) {
      return solicitacao;
    }
  }
  return null;
}

function dadosTipoServico(tipo) {
  if (tipo === 'abastecimento_base') {
    return {
      titulo: '⛽ Solicitação de abastecimento na base',
      cor: BRAND.cores.abastecimento,
      pedido: 'Motorista informou ao sistema/gestor que o ônibus precisa abastecer na base.',
      gestor: '🤖 Sistema/Gestor autorizou o abastecimento na base. O funcionário já está realizando o serviço.',
      pronto: 'Funcionário da base informa: o ônibus já está abastecido.',
      final: 'Motorista confirma o abastecimento concluído. Ônibus liberado para viagem.'
    };
  }

  if (tipo === 'abastecimento_rua') {
    return {
      titulo: '🛣️ Solicitação de abastecimento na rua',
      cor: 0x2563eb,
      pedido: 'Motorista informou ao sistema/gestor que o ônibus está na rua e precisa de autorização para abastecer em posto externo.',
      gestor: '🤖 Sistema/Gestor autorizou o abastecimento fora da base. O motorista está liberado para abastecer no posto.',
      pronto: 'Abastecimento externo concluído. O posto liberou o ônibus.',
      final: 'Motorista confirma o abastecimento na rua concluído. Ônibus liberado para viagem.'
    };
  }

  return {
    titulo: '🧼 Solicitação de limpeza / manutenção',
    cor: BRAND.cores.limpeza,
    pedido: 'Motorista informou ao sistema/gestor da base que o ônibus precisa de limpeza/manutenção.',
    gestor: '🤖 Sistema/Gestor acionou automaticamente o funcionário responsável pela limpeza/manutenção.',
    pronto: 'Funcionário da base informa: o ônibus já foi limpo/revisado.',
    final: 'Motorista confirma o serviço concluído. Ônibus liberado para viagem.'
  };
}

// =====================
// EMBEDS
// =====================
function montarEmbedViagem(viagem, reaberta = false, motorista = null) {
  const titulo = reaberta ? '♻️ Operação liberada novamente' : '🚌 Operação disponível';

  const embed = new EmbedBuilder()
    .setAuthor({ name: BRAND.nome })
    .setTitle(titulo)
    .setColor(corPorDistancia(viagem.distancia))
    .setDescription(BRAND.slogan)
    .addFields(
      { name: '🏢 Empresa', value: viagem.empresa || BRAND.nome, inline: true },
      { name: '🛣️ Serviço', value: viagem.tipo, inline: true },
      { name: '📏 Distância', value: `${emojiDistancia(viagem.distancia)} ${viagem.distancia}`, inline: true },
      { name: '📍 Origem', value: viagem.origemNome, inline: true },
      { name: '🏁 Destino', value: viagem.destinoNome, inline: true },
      { name: '⭐ Prioridade', value: viagem.prioridade || 'Normal', inline: true },
      { name: '🧭 Escalas', value: viagem.escalasTexto || 'Sem escalas', inline: false },
      { name: '☕ Paradas de apoio', value: viagem.lanchesTexto || 'Sem parada de apoio', inline: false }
    )
    .setFooter({ text: BRAND.rodape })
    .setTimestamp();

  if (motorista) embed.addFields({ name: '👤 Motorista vinculado', value: motorista, inline: false });

  return embed;
}

function montarEmbedFuncionario(dados, motorista = null) {
  const embed = new EmbedBuilder()
    .setAuthor({ name: BRAND.nome })
    .setTitle('🏭 Fretamento corporativo')
    .setColor(BRAND.cores.funcionarios)
    .setDescription('Operação corporativa registrada no sistema.')
    .addFields(
      { name: '🏢 Empresa', value: dados.empresa, inline: true },
      { name: '🕒 Turno', value: dados.turno, inline: true },
      { name: '🔁 Operação', value: 'Ida e Volta', inline: true },
      { name: '📍 Saída', value: dados.origem, inline: true },
      { name: '🏁 Destino', value: dados.destino, inline: true },
      { name: '🏭 Categoria', value: 'Transporte de Funcionários', inline: true },
      { name: '🛣️ Escala automática', value: dados.rotaCompleta, inline: false }
    )
    .setFooter({ text: BRAND.rodape })
    .setTimestamp();

  if (motorista) embed.addFields({ name: '👤 Motorista vinculado', value: motorista, inline: false });

  return embed;
}

function montarEmbedIndex() {
  return new EmbedBuilder()
    .setAuthor({ name: BRAND.nome })
    .setTitle('📊 Central Operacional Pimentel')
    .setColor(BRAND.cores.index)
    .setDescription([
      'Escolha abaixo o setor operacional desejado.',
      '',
      '🟢 **Curtas**',
      '🟡 **Médias**',
      '🔴 **Longas**',
      '🏭 **Funcionários**',
      '',
      'Depois clique em **Assumir viagem** ou **Assumir transporte**.'
    ].join('\n'))
    .addFields(
      { name: '🚛 Operação', value: 'Acompanhe também **🚛・viagens-em-andamento**.', inline: false },
      { name: '📁 Histórico', value: 'Consulte **📁・historico-de-viagens** e **📁・historico-funcionarios**.', inline: false }
    )
    .setFooter({ text: BRAND.rodape })
    .setTimestamp();
}

function montarEmbedPainelBase() {
  return new EmbedBuilder()
    .setAuthor({ name: BRAND.nome })
    .setTitle('🅿️ Controle de Base')
    .setColor(BRAND.cores.base)
    .setDescription(
      'Use este painel para registrar entrada e saída da base.\n\n' +
      'Esse sistema é separado das viagens e não bloqueia novas operações.'
    )
    .setFooter({ text: BRAND.rodape })
    .setTimestamp();
}

function criarPainelAbastecimento() {
  return new EmbedBuilder()
    .setAuthor({ name: BRAND.nome })
    .setTitle('⛽ Painel de abastecimento')
    .setColor(BRAND.cores.abastecimento)
    .setDescription(
      'Escolha abaixo o tipo de solicitação:\n\n' +
      '• Abastecimento na base\n' +
      '• Abastecimento na rua com autorização automática'
    )
    .setFooter({ text: BRAND.rodape })
    .setTimestamp();
}

function criarPainelLimpeza() {
  return new EmbedBuilder()
    .setAuthor({ name: BRAND.nome })
    .setTitle('🧼 Painel de limpeza / manutenção')
    .setColor(BRAND.cores.limpeza)
    .setDescription(
      'Use o botão abaixo para solicitar limpeza ou manutenção do ônibus.\n' +
      'O sistema faz o papel do gestor automaticamente.'
    )
    .setFooter({ text: BRAND.rodape })
    .setTimestamp();
}

function montarEmbedSolicitacaoServico(solicitacao) {
  const info = dadosTipoServico(solicitacao.tipo);

  let statusTexto = '📝 Solicitado';
  let fraseStatus = info.pedido;

  if (solicitacao.status === 'autorizado') {
    statusTexto = '🤖 Autorizado pelo sistema';
    fraseStatus = info.gestor;
  }

  if (solicitacao.status === 'pronto') {
    statusTexto = '✅ Serviço concluído';
    fraseStatus = info.pronto;
  }

  if (solicitacao.status === 'finalizado') {
    statusTexto = '💼 Ônibus liberado';
    fraseStatus = info.final;
  }

  return new EmbedBuilder()
    .setAuthor({ name: BRAND.nome })
    .setTitle(info.titulo)
    .setColor(info.cor)
    .setDescription(fraseStatus)
    .addFields(
      { name: '👤 Motorista', value: `<@${solicitacao.motoristaId}>`, inline: true },
      { name: '🆔 Solicitação', value: `#${solicitacao.id}`, inline: true },
      { name: '📌 Status', value: statusTexto, inline: true }
    )
    .setFooter({ text: BRAND.rodape })
    .setTimestamp();
}

function embedConferindoPassagem(viagem, userId) {
  return new EmbedBuilder()
    .setAuthor({ name: BRAND.nome })
    .setTitle('🎫 Conferindo passagens')
    .setColor(BRAND.cores.embarque)
    .setDescription('Conferindo passagens e organizando embarque dos passageiros...')
    .addFields(
      { name: '👤 Motorista', value: `<@${userId}>`, inline: true },
      { name: '📍 Rota', value: `${viagem.origemNome} → ${viagem.destinoNome}`, inline: false }
    )
    .setFooter({ text: BRAND.rodape })
    .setTimestamp();
}

function embedEmbarqueConcluido(viagem, userId) {
  return new EmbedBuilder()
    .setAuthor({ name: BRAND.nome })
    .setTitle('🧳 Passageiros embarcados')
    .setColor(BRAND.cores.embarque)
    .setDescription('Passageiros embarcados com sucesso.\n💼 Bom trabalho, motorista.')
    .addFields(
      { name: '👤 Motorista', value: `<@${userId}>`, inline: true },
      { name: '🛣️ Serviço', value: viagem.tipo, inline: true },
      { name: '📏 Distância', value: viagem.distancia, inline: true },
      { name: '📍 Rota', value: `${viagem.origemNome} → ${viagem.destinoNome}`, inline: false }
    )
    .setFooter({ text: BRAND.rodape })
    .setTimestamp();
}

function embedDesembarqueIniciado(rotaTexto, userId) {
  return new EmbedBuilder()
    .setAuthor({ name: BRAND.nome })
    .setTitle('🚏 Desembarque em andamento')
    .setColor(BRAND.cores.desembarque)
    .setDescription('Realizando desembarque dos passageiros...')
    .addFields(
      { name: '👤 Motorista', value: `<@${userId}>`, inline: true },
      { name: '📍 Rota concluída', value: rotaTexto, inline: false }
    )
    .setFooter({ text: BRAND.rodape })
    .setTimestamp();
}

function embedHistoricoNormal(viagem, userId) {
  return new EmbedBuilder()
    .setAuthor({ name: BRAND.nome })
    .setTitle('📁 Histórico operacional')
    .setColor(BRAND.cores.historico)
    .setDescription('Viagem concluída e arquivada.')
    .addFields(
      { name: '👤 Motorista', value: `<@${userId}>`, inline: true },
      { name: '⭐ Prioridade', value: viagem.prioridade, inline: true },
      { name: '🛣️ Serviço', value: viagem.tipo, inline: true },
      { name: '📍 Rota', value: `${viagem.origemNome} → ${viagem.destinoNome}`, inline: false },
      { name: '📏 Distância', value: viagem.distancia, inline: true }
    )
    .setFooter({ text: BRAND.rodape })
    .setTimestamp();
}

function embedHistoricoFuncionario(dados, userId) {
  return new EmbedBuilder()
    .setAuthor({ name: BRAND.nome })
    .setTitle('📁 Histórico fretamento corporativo')
    .setColor(BRAND.cores.historico)
    .setDescription('Transporte de funcionários concluído e arquivado.')
    .addFields(
      { name: '👤 Motorista', value: `<@${userId}>`, inline: true },
      { name: '🏢 Empresa', value: dados.empresa, inline: true },
      { name: '🕒 Turno', value: dados.turno, inline: true },
      { name: '📍 Saída', value: dados.origem, inline: true },
      { name: '🏁 Destino', value: dados.destino, inline: true },
      { name: '🛣️ Escala', value: dados.rotaCompleta, inline: false }
    )
    .setFooter({ text: BRAND.rodape })
    .setTimestamp();
}

function embedEntradaBase(userId, base) {
  return new EmbedBuilder()
    .setAuthor({ name: BRAND.nome })
    .setTitle('🌙 Entrada na base registrada')
    .setColor(BRAND.cores.descanso)
    .setDescription('Ônibus recolhido na base com sucesso.')
    .addFields(
      { name: '👤 Motorista', value: `<@${userId}>`, inline: true },
      { name: '🏢 Base', value: `${base.cidade} • ${base.nome}`, inline: false },
      { name: '⛽ Abastecimento', value: base.abastecimento ? 'Autorizado nesta base' : 'Não autorizado nesta base', inline: true },
      { name: '💤 Mensagem', value: 'Bom descanso, motorista.', inline: false }
    )
    .setFooter({ text: BRAND.rodape })
    .setTimestamp();
}

function embedSaidaBase(userId, base) {
  return new EmbedBuilder()
    .setAuthor({ name: BRAND.nome })
    .setTitle('💼 Saída da base registrada')
    .setColor(BRAND.cores.base)
    .setDescription('Ônibus liberado para operação.')
    .addFields(
      { name: '👤 Motorista', value: `<@${userId}>`, inline: true },
      { name: '🏢 Base', value: `${base.cidade} • ${base.nome}`, inline: false },
      { name: '🚍 Mensagem', value: 'Bom trabalho, motorista.', inline: false }
    )
    .setFooter({ text: BRAND.rodape })
    .setTimestamp();
}

function montarEmbedPainelRH() {
  return new EmbedBuilder()
    .setAuthor({ name: BRAND.nome })
    .setTitle('📝 Recrutamento Oficial - Pimentel Turismo VTC')
    .setColor(BRAND.cores.rh)
    .setDescription(
      'Seja bem-vindo ao recrutamento oficial da **Pimentel Turismo VTC**.\n\n' +
      'A Pimentel Turismo VTC é uma empresa virtual voltada para a simulação com organização, compromisso e padrão de empresa real dentro do ETS2.\n\n' +
      'Nosso objetivo é proporcionar aos motoristas uma experiência séria e bem estruturada, com operações rodoviárias, transporte de funcionários, controle logístico, base operacional, histórico de viagens e rotina de empresa no mapa RBR.\n\n' +
      'A empresa busca motoristas comprometidos, que gostem de simulação, saibam trabalhar em equipe e tenham interesse em crescer dentro de um projeto organizado.\n\n' +
      'Ao preencher este formulário, o candidato demonstra interesse em fazer parte da nossa equipe e concorda em seguir a proposta da empresa, respeitando a organização, os processos internos e o padrão operacional da Pimentel Turismo VTC.\n\n' +
      'Clique no botão abaixo para enviar sua inscrição ao RH.'
    )
    .addFields(
      { name: '🚍 O que a empresa propõe ao candidato', value: '• Ambiente organizado\n• Operação séria\n• Simulação realista\n• Sistema logístico estruturado\n• Possibilidade de crescimento dentro da empresa', inline: false },
      { name: '📌 Importante', value: 'Preencha todas as informações com atenção e sinceridade.', inline: false }
    )
    .setFooter({ text: BRAND.rodape })
    .setTimestamp();
}

// =====================
// BOTÕES
// =====================
function criarBotaoAssumir(id) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`assumir_${id}`)
      .setLabel('✅ Assumir viagem')
      .setStyle(ButtonStyle.Success)
  );
}

function criarBotaoFinalizar(id) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`finalizar_${id}`)
      .setLabel('🏁 Finalizar viagem')
      .setStyle(ButtonStyle.Danger)
  );
}

function criarBotaoAssumirFuncionario(id) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`assumirfunc_${id}`)
      .setLabel('🚌 Assumir transporte')
      .setStyle(ButtonStyle.Success)
  );
}

function criarBotaoFinalizarFuncionario(id) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`finalizarfunc_${id}`)
      .setLabel('🏁 Finalizar transporte')
      .setStyle(ButtonStyle.Danger)
  );
}

function criarBotoesIndex() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('abrir_curtas').setLabel('🟢 Curtas').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('abrir_medias').setLabel('🟡 Médias').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('abrir_longas').setLabel('🔴 Longas').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('abrir_funcionarios').setLabel('🏭 Funcionários').setStyle(ButtonStyle.Secondary)
    )
  ];
}

function criarBotoesPainelBase() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('abrir_entrada_base')
        .setLabel('🅿️ Entrar na base')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('sair_da_base')
        .setLabel('🚌 Sair da base')
        .setStyle(ButtonStyle.Success)
    )
  ];
}

function criarBotoesEscolhaEntradaBase() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('entrarbase_bh').setLabel('BH').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('entrarbase_jf').setLabel('Juiz de Fora').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('entrarbase_rj').setLabel('Rio de Janeiro').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('entrarbase_catanduva').setLabel('Catanduva').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('entrarbase_itaruma').setLabel('Itarumã').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('entrarbase_cassilandia').setLabel('Cassilândia').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('entrarbase_aparecida_taboado').setLabel('Ap. do Taboado').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('entrarbase_campo_grande').setLabel('Campo Grande').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('entrarbase_rio_verde').setLabel('Rio Verde').setStyle(ButtonStyle.Secondary)
    )
  ];
}

function criarBotoesPainelAbastecimento() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('solicitar_abastecimento_base')
        .setLabel('⛽ Pedir abastecimento na base')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('solicitar_abastecimento_rua')
        .setLabel('🛣️ Pedir abastecimento na rua')
        .setStyle(ButtonStyle.Primary)
    )
  ];
}

function criarBotoesPainelLimpeza() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('solicitar_limpeza')
        .setLabel('🧼 Pedir limpeza / manutenção')
        .setStyle(ButtonStyle.Primary)
    )
  ];
}

function criarBotoesSolicitacaoServico(id, pronto = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`liberar_servico_${id}`)
        .setLabel(pronto ? '✅ Motorista confirmar liberação' : '⏳ Aguardando conclusão')
        .setStyle(pronto ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(!pronto)
    )
  ];
}

function criarBotaoPainelRH() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('abrir_formulario_rh')
        .setLabel('📝 Fazer inscrição')
        .setStyle(ButtonStyle.Success)
    )
  ];
}

function textoCanaisPorGrupo(guild, grupo) {
  const canais = guild.channels.cache
    .filter(c => c.name.includes(`${grupo}s-`))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(c => `• <#${c.id}>`);

  if (canais.length === 0) return `Nenhum canal de ${grupo} encontrado.`;
  return canais.join('\n');
}

// =====================
// GERAÇÃO DE VIAGENS
// =====================
function gerarViagensFixas() {
  let proximo = 5001;

  for (const rota of rotasCurtas) {
    for (const tipo of ['direto', 'paradas']) {
      viagensFixas[proximo] = {
        idInterno: proximo,
        empresa: BRAND.nome,
        origemNome: nomeCidade(rota.origem),
        destinoNome: nomeCidade(rota.destino),
        distancia: 'curta',
        tipo,
        prioridade: 'Normal',
        escalasTexto: tipo === 'direto' ? 'Sem escalas' : textoEscalas(rota.escalas),
        lanchesTexto: 'Sem parada de apoio'
      };
      proximo++;
    }
  }

  for (const rota of rotasMedias) {
    for (const tipo of ['direto', 'paradas']) {
      viagensFixas[proximo] = {
        idInterno: proximo,
        empresa: BRAND.nome,
        origemNome: nomeCidade(rota.origem),
        destinoNome: nomeCidade(rota.destino),
        distancia: 'media',
        tipo,
        prioridade: 'Normal',
        escalasTexto: tipo === 'direto' ? 'Sem escalas' : textoEscalas(rota.escalas),
        lanchesTexto: textoLanches(rota.lanches || [])
      };
      proximo++;
    }
  }

  for (const rota of rotasLongas) {
    for (const tipo of ['direto', 'paradas']) {
      viagensFixas[proximo] = {
        idInterno: proximo,
        empresa: BRAND.nome,
        origemNome: nomeCidade(rota.origem),
        destinoNome: nomeCidade(rota.destino),
        distancia: 'longa',
        tipo,
        prioridade: 'VIP',
        escalasTexto: tipo === 'direto' ? 'Sem escalas' : textoEscalas(rota.escalas),
        lanchesTexto: textoLanches(rota.lanches || [])
      };
      proximo++;
    }
  }
}

function gerarFuncionariosFixos() {
  let proximo = 990001;

  for (const rota of rotasFuncionariosFixas) {
    viagensFuncionarios[proximo] = {
      idInterno: proximo,
      empresa: rota.empresa,
      origem: rota.origem,
      destino: rota.destino,
      turno: rota.turno,
      rotaCompleta: montarRotaIdaVolta(rota.rota, rota.origem, rota.destino)
    };
    proximo++;
  }

  proximoIdFuncionario = proximo;
}

gerarViagensFixas();
gerarFuncionariosFixos();

// =====================
// PUBLICAÇÃO
// =====================
async function publicarViagemNoCanal(guild, id, reaberta = false) {
  const viagem = obterViagem(id);
  if (!viagem) return false;

  const canal = encontrarCanalViagem(guild, viagem);
  if (!canal) return false;

  await canal.send({
    embeds: [montarEmbedViagem(viagem, reaberta)],
    components: [criarBotaoAssumir(id)]
  });

  return true;
}

async function publicarFuncionarioNoCanal(guild, id) {
  const dados = obterFuncionario(id);
  if (!dados) return false;

  const canal = encontrarCanalFuncionarios(guild);
  if (!canal) return false;

  await canal.send({
    embeds: [montarEmbedFuncionario(dados)],
    components: [criarBotaoAssumirFuncionario(id)]
  });

  return true;
}


function normalizarNomeTrucky(nome) {
  return String(nome || '').trim();
}

function obterNomeUsuarioTrucky(data = {}) {
  return normalizarNomeTrucky(
    data?.user?.username ||
    data?.user?.name ||
    data?.username ||
    data?.driver?.username ||
    data?.driver?.name ||
    ''
  );
}

function obterIdEventoTrucky(data = {}) {
  return String(
    data?.job?.id ||
    data?.jobId ||
    data?.id ||
    Date.now()
  );
}

function salvarEventoTrucky(eventName, truckyUsername, payload) {
  const stmt = db.prepare(`
    INSERT INTO trucky_events (event_name, trucky_username, payload_json)
    VALUES (?, ?, ?)
  `);
  stmt.run(eventName, truckyUsername || null, JSON.stringify(payload || {}));
}

function vincularUsuarioTrucky(discordUserId, truckyUsername) {
  const nome = normalizarNomeTrucky(truckyUsername);
  const stmt = db.prepare(`
    INSERT INTO trucky_links (discord_user_id, trucky_username)
    VALUES (?, ?)
    ON CONFLICT(discord_user_id) DO UPDATE SET trucky_username = excluded.trucky_username
  `);
  stmt.run(String(discordUserId), nome);
}

function buscarVinculoPorDiscord(discordUserId) {
  const stmt = db.prepare('SELECT * FROM trucky_links WHERE discord_user_id = ?');
  return stmt.get(String(discordUserId)) || null;
}

function buscarVinculoPorTrucky(truckyUsername) {
  const stmt = db.prepare('SELECT * FROM trucky_links WHERE lower(trucky_username) = lower(?)');
  return stmt.get(normalizarNomeTrucky(truckyUsername)) || null;
}

function removerVinculoTrucky(discordUserId) {
  const stmt = db.prepare('DELETE FROM trucky_links WHERE discord_user_id = ?');
  return stmt.run(String(discordUserId));
}

function validarAssinaturaTrucky(req) {
  if (!TRUCKY_WEBHOOK_SECRET) return false;

  const signature = req.headers['x-signature-sha256'];
  if (!signature || !req.rawBody) return false;

  const expected = crypto
    .createHmac('sha256', TRUCKY_WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch {
    return false;
  }
}

async function obterCanalLogTrucky() {
  if (!TRUCKY_LOG_CHANNEL_ID) return null;
  return client.channels.fetch(TRUCKY_LOG_CHANNEL_ID).catch(() => null);
}

async function processarEventoTrucky(eventName, data = {}) {
  const truckyUsername = obterNomeUsuarioTrucky(data);
  salvarEventoTrucky(eventName, truckyUsername, data);

  const vinculo = truckyUsername ? buscarVinculoPorTrucky(truckyUsername) : null;
  const canalLog = await obterCanalLogTrucky();
  const eventId = obterIdEventoTrucky(data);
  const distancia = Number(data?.distance || data?.job?.distance || 0);
  const estadoAtual = vinculo ? getEstado(vinculo.discord_user_id) : null;

  if (eventName === 'job.started') {
    if (vinculo && estadoAtual && estadoAtual.status === 'livre') {
      setEstado(vinculo.discord_user_id, {
        status: 'viagem',
        tipo: 'trucky',
        viagemId: `trucky:${eventId}`
      });
    }

    if (canalLog) {
      const texto = [
        '🚍 **TRUCKY | viagem iniciada**',
        `Motorista Trucky: **${truckyUsername || 'não identificado'}**`,
        vinculo ? `Motorista Discord: <@${vinculo.discord_user_id}>` : 'Motorista Discord: não vinculado',
        vinculo && estadoAtual && estadoAtual.status !== 'livre'
          ? `Aviso: motorista já estava em operação interna (${resumoEstado(vinculo.discord_user_id)})`
          : 'Status interno: viagem marcada pelo webhook'
      ];
      await canalLog.send(texto.join('\n')).catch(() => {});
    }
    return;
  }

  if (eventName === 'job.completed') {
    if (vinculo) {
      const estado = getEstado(vinculo.discord_user_id);
      if (estado.status === 'viagem' && String(estado.viagemId || '').startsWith('trucky:')) {
        setEstado(vinculo.discord_user_id, estadoLivre());
      }
    }

    if (canalLog) {
      const texto = [
        '✅ **TRUCKY | viagem finalizada**',
        `Motorista Trucky: **${truckyUsername || 'não identificado'}**`,
        vinculo ? `Motorista Discord: <@${vinculo.discord_user_id}>` : 'Motorista Discord: não vinculado',
        `Distância registrada: **${distancia || 0} km**`,
        vinculo ? 'Status interno: motorista liberado para nova operação Trucky.' : 'Status interno: sem vínculo, apenas registro em log.'
      ];
      await canalLog.send(texto.join('\n')).catch(() => {});
    }
    return;
  }

  if (eventName === 'job.cancelled') {
    if (vinculo) {
      const estado = getEstado(vinculo.discord_user_id);
      if (estado.status === 'viagem' && String(estado.viagemId || '').startsWith('trucky:')) {
        setEstado(vinculo.discord_user_id, estadoLivre());
      }
    }

    if (canalLog) {
      const texto = [
        '⚠️ **TRUCKY | viagem cancelada**',
        `Motorista Trucky: **${truckyUsername || 'não identificado'}**`,
        vinculo ? `Motorista Discord: <@${vinculo.discord_user_id}>` : 'Motorista Discord: não vinculado',
        'Status interno: operação Trucky encerrada.'
      ];
      await canalLog.send(texto.join('\n')).catch(() => {});
    }
  }
}

// =====================
// COMANDOS
// =====================
const commands = [
  new SlashCommandBuilder()
    .setName('publicar_index')
    .setDescription('Publica o painel principal'),

  new SlashCommandBuilder()
    .setName('publicar_base')
    .setDescription('Publica o painel de base'),

  new SlashCommandBuilder()
    .setName('publicar_abastecimento')
    .setDescription('Publica o painel de abastecimento'),

  new SlashCommandBuilder()
    .setName('publicar_limpeza')
    .setDescription('Publica o painel de limpeza/manutenção'),

  new SlashCommandBuilder()
    .setName('publicar_rh')
    .setDescription('Publica o painel do formulário do RH'),

  new SlashCommandBuilder()
    .setName('publicar_todas')
    .setDescription('Publica todas as viagens normais'),

  new SlashCommandBuilder()
    .setName('publicar_funcionarios')
    .setDescription('Publica todas as rotas automáticas de funcionários'),

  new SlashCommandBuilder()
    .setName('adicionar_viagem_manual')
    .setDescription('Adiciona uma viagem manual')
    .addStringOption(option =>
      option.setName('origem').setDescription('Cidade de origem').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('destino').setDescription('Cidade de destino').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('distancia')
        .setDescription('Tipo de distância')
        .setRequired(true)
        .addChoices(
          { name: 'curta', value: 'curta' },
          { name: 'media', value: 'media' },
          { name: 'longa', value: 'longa' }
        )
    )
    .addStringOption(option =>
      option.setName('servico')
        .setDescription('Tipo do serviço')
        .setRequired(true)
        .addChoices(
          { name: 'direto', value: 'direto' },
          { name: 'paradas', value: 'paradas' }
        )
    )
    .addStringOption(option =>
      option.setName('escalas').setDescription('Ex: Sem escalas ou cidades').setRequired(false)
    )
    .addStringOption(option =>
      option.setName('paradas_apoio').setDescription('Ex: Graal Aparecida').setRequired(false)
    )
    .addStringOption(option =>
      option.setName('prioridade')
        .setDescription('Prioridade')
        .setRequired(false)
        .addChoices(
          { name: 'Normal', value: 'Normal' },
          { name: 'VIP', value: 'VIP' }
        )
    ),

  new SlashCommandBuilder()
    .setName('funcionario')
    .setDescription('Cria manualmente uma rota de funcionários')
    .addStringOption(option =>
      option.setName('empresa').setDescription('Nome da empresa').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('origem').setDescription('Cidade de saída').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('destino').setDescription('Cidade destino/fábrica').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('rota').setDescription('Ex: BH > Itabirito > Ouro Branco').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('turno')
        .setDescription('Turno')
        .setRequired(true)
        .addChoices(
          { name: 'Manhã', value: 'Manhã' },
          { name: 'Tarde', value: 'Tarde' },
          { name: 'Noite', value: 'Noite' }
        )
    ),

  new SlashCommandBuilder()
    .setName('desbloquear_motorista')
    .setDescription('Desbloqueia manualmente um motorista preso no sistema')
    .addUserOption(option =>
      option.setName('motorista')
        .setDescription('Motorista que será desbloqueado')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('promover_motorista')
    .setDescription('Promove um membro de Em teste para Motorista')
    .addUserOption(option =>
      option.setName('membro')
        .setDescription('Membro que será promovido')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('vincular_trucky')
    .setDescription('Vincula seu usuário do Discord ao seu nome no Trucky')
    .addStringOption(option =>
      option.setName('usuario')
        .setDescription('Nome exato do seu perfil no Trucky')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('ver_vinculo_trucky')
    .setDescription('Mostra o vínculo atual com o Trucky'),

  new SlashCommandBuilder()
    .setName('desvincular_trucky')
    .setDescription('Remove o vínculo atual com o Trucky')
].map(c => c.toJSON());

// =====================
// STARTUP
// =====================
client.once(Events.ClientReady, async () => {
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    await rest.put(
      Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
      { body: [] }
    );

    await rest.put(
      Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
      { body: commands }
    );

    console.log('✅ SISTEMA COMPLETO CARREGADO');
  } catch (error) {
    console.error('Erro ao registrar comandos:', error);
  }
});

// =====================
// INTERAÇÕES
// =====================
client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {

      if (interaction.commandName === 'vincular_trucky') {
        const usuario = interaction.options.getString('usuario', true).trim();
        try {
          vincularUsuarioTrucky(interaction.user.id, usuario);
          await interaction.reply({
            content: `✅ Seu Discord foi vinculado ao usuário Trucky **${usuario}**.`,
            flags: MessageFlags.Ephemeral
          });
        } catch (error) {
          if (String(error.message || '').includes('UNIQUE')) {
            await interaction.reply({
              content: '❌ Esse usuário do Trucky já está vinculado a outra pessoa no sistema.',
              flags: MessageFlags.Ephemeral
            });
            return;
          }
          throw error;
        }
        return;
      }

      if (interaction.commandName === 'ver_vinculo_trucky') {
        const vinculo = buscarVinculoPorDiscord(interaction.user.id);
        await interaction.reply({
          content: vinculo
            ? `🔗 Seu vínculo atual no Trucky é: **${vinculo.trucky_username}**`
            : 'ℹ️ Você ainda não vinculou seu usuário do Trucky.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (interaction.commandName === 'desvincular_trucky') {
        const removido = removerVinculoTrucky(interaction.user.id);
        await interaction.reply({
          content: removido.changes > 0
            ? '✅ Vínculo com o Trucky removido com sucesso.'
            : 'ℹ️ Você não tinha nenhum vínculo ativo com o Trucky.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (interaction.commandName === 'publicar_index') {
        const canal = encontrarCanalIndex(interaction.guild);

        if (!canal) {
          await interaction.reply({
            content: '❌ Não encontrei o canal 📌・index-de-viagens',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await canal.send({
          embeds: [montarEmbedIndex()],
          components: criarBotoesIndex()
        });

        await interaction.reply({
          content: '✅ Painel principal publicado com sucesso.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (interaction.commandName === 'publicar_base') {
        await interaction.channel.send({
          embeds: [montarEmbedPainelBase()],
          components: criarBotoesPainelBase()
        });

        await interaction.reply({
          content: '✅ Painel de base publicado com sucesso.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (interaction.commandName === 'publicar_abastecimento') {
        await interaction.channel.send({
          embeds: [criarPainelAbastecimento()],
          components: criarBotoesPainelAbastecimento()
        });

        await interaction.reply({
          content: '✅ Painel de abastecimento publicado.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (interaction.commandName === 'publicar_limpeza') {
        await interaction.channel.send({
          embeds: [criarPainelLimpeza()],
          components: criarBotoesPainelLimpeza()
        });

        await interaction.reply({
          content: '✅ Painel de limpeza/manutenção publicado.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (interaction.commandName === 'publicar_rh') {
        await interaction.channel.send({
          embeds: [montarEmbedPainelRH()],
          components: criarBotaoPainelRH()
        });

        await interaction.reply({
          content: '✅ Painel do RH publicado com sucesso.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (interaction.commandName === 'publicar_todas') {
        await interaction.reply({
          content: '⏳ Publicando operações normais...',
          flags: MessageFlags.Ephemeral
        });

        let total = 0;
        for (const id of Object.keys(viagensFixas)) {
          const publicado = await publicarViagemNoCanal(interaction.guild, id, false);
          if (publicado) total++;
          if (total > 0 && total % 10 === 0) await esperar(1000);
        }

        await interaction.editReply(`✅ ${total} operações normais publicadas.`);
        return;
      }

      if (interaction.commandName === 'publicar_funcionarios') {
        await interaction.reply({
          content: '⏳ Publicando fretamentos corporativos...',
          flags: MessageFlags.Ephemeral
        });

        let total = 0;
        for (const id of Object.keys(viagensFuncionarios)) {
          const publicado = await publicarFuncionarioNoCanal(interaction.guild, id);
          if (publicado) total++;
          await esperar(300);
        }

        await interaction.editReply(`✅ ${total} transportes de funcionários publicados.`);
        return;
      }

      if (interaction.commandName === 'adicionar_viagem_manual') {
        const origem = interaction.options.getString('origem');
        const destino = interaction.options.getString('destino');
        const distancia = interaction.options.getString('distancia');
        const servico = interaction.options.getString('servico');
        const escalas = interaction.options.getString('escalas') || 'Sem escalas';
        const paradas = interaction.options.getString('paradas_apoio') || 'Sem parada de apoio';
        const prioridade = interaction.options.getString('prioridade') || 'Normal';

        const id = proximoIdManual++;
        viagensManuais[id] = {
          idInterno: id,
          empresa: BRAND.nome,
          origemNome: origem,
          destinoNome: destino,
          distancia,
          tipo: servico,
          prioridade,
          escalasTexto: escalas,
          lanchesTexto: paradas
        };

        const publicado = await publicarViagemNoCanal(interaction.guild, id, false);
        if (!publicado) {
          delete viagensManuais[id];
          await interaction.reply({
            content: `❌ Não encontrei o canal para ${distancia}s-${servico}`,
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await interaction.reply({
          content: '✅ Operação manual publicada.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (interaction.commandName === 'funcionario') {
        const empresa = interaction.options.getString('empresa');
        const origem = interaction.options.getString('origem');
        const destino = interaction.options.getString('destino');
        const rota = interaction.options.getString('rota');
        const turno = interaction.options.getString('turno');

        const id = proximoIdFuncionario++;
        viagensFuncionarios[id] = {
          idInterno: id,
          empresa,
          origem,
          destino,
          turno,
          rotaCompleta: montarRotaIdaVolta(rota, origem, destino)
        };

        const publicado = await publicarFuncionarioNoCanal(interaction.guild, id);
        if (!publicado) {
          delete viagensFuncionarios[id];
          await interaction.reply({
            content: '❌ Não encontrei o canal 🏭・funcionarios-operacao',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await interaction.reply({
          content: '✅ Transporte corporativo publicado.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (interaction.commandName === 'desbloquear_motorista') {
        const motorista = interaction.options.getUser('motorista');
        const userId = motorista.id;

        const antes = resumoEstado(userId);
        limparEstadoMotorista(userId);
        const depois = resumoEstado(userId);

        await interaction.reply({
          content:
            `✅ Motorista ${motorista} desbloqueado.\n\n` +
            `**Estado anterior:** ${antes}\n` +
            `**Estado atual:** ${depois}`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (interaction.commandName === 'promover_motorista') {
        const membroUser = interaction.options.getUser('membro');
        const membro = await interaction.guild.members.fetch(membroUser.id).catch(() => null);

        if (!membro) {
          await interaction.reply({
            content: '❌ Não encontrei esse membro no servidor.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await membro.roles.remove(CARGO_EM_TESTE_ID).catch(() => {});
        await membro.roles.add(CARGO_MOTORISTA_ID).catch(() => {});

        const canalAprovados = interaction.guild.channels.cache.get(APROVACAO_CHANNEL_ID);

        if (canalAprovados) {
          const embed = new EmbedBuilder()
            .setTitle('🚍 Membro promovido')
            .setColor(BRAND.cores.index)
            .setDescription(`<@${membro.id}> foi promovido de **Em teste** para **Motorista**.`)
            .setTimestamp();

          await canalAprovados.send({ embeds: [embed] });
        }

        await membro.send(
          '🚍 Parabéns! Você foi promovido para o cargo **Motorista** na Pimentel Turismo VTC.\n\n' +
          'Agora você faz parte oficialmente da operação da empresa.'
        ).catch(() => {});

        await interaction.reply({
          content: `✅ <@${membro.id}> promovido para Motorista.`,
          flags: MessageFlags.Ephemeral
        });

        return;
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'modal_rh_pimentel') {
        const nomeIdade = interaction.fields.getTextInputValue('nome_idade');
        const tempoEstilo = interaction.fields.getTextInputValue('tempo_estilo');
        const empresas = interaction.fields.getTextInputValue('empresas_anteriores');
        const disponibilidade = interaction.fields.getTextInputValue('disponibilidade');
        const estrutura = interaction.fields.getTextInputValue('estrutura_jogo');

        const canalRH = interaction.guild.channels.cache.get(RH_CHANNEL_ID);

        if (!canalRH) {
          await interaction.reply({
            content: '❌ Canal do RH não encontrado. Configure o RH_CHANNEL_ID.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setAuthor({ name: BRAND.nome })
          .setTitle('📋 Nova inscrição - RH')
          .setColor(BRAND.cores.rh)
          .addFields(
            { name: '👤 Candidato', value: `<@${interaction.user.id}>`, inline: false },
            { name: '📝 Nome / Idade', value: nomeIdade, inline: false },
            { name: '🎮 Tempo + Estilo', value: tempoEstilo, inline: false },
            { name: '🏢 Empresas anteriores', value: empresas, inline: false },
            { name: '📆 Disponibilidade', value: disponibilidade, inline: false },
            { name: '🗺️ Estrutura', value: estrutura, inline: false }
          )
          .setFooter({ text: `ID: ${interaction.user.id}` })
          .setTimestamp();

        const botoes = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`aprovar_${interaction.user.id}`)
            .setLabel('✅ Aprovar')
            .setStyle(ButtonStyle.Success),

          new ButtonBuilder()
            .setCustomId(`reprovar_${interaction.user.id}`)
            .setLabel('❌ Reprovar')
            .setStyle(ButtonStyle.Danger)
        );

        await canalRH.send({
          embeds: [embed],
          components: [botoes]
        });

        await interaction.reply({
          content: '✅ Sua inscrição foi enviada com sucesso para o RH da Pimentel Turismo.',
          flags: MessageFlags.Ephemeral
        });

        return;
      }
    }

    if (interaction.isButton()) {
      // =====================
      // RH
      // =====================
      if (interaction.customId === 'abrir_formulario_rh') {
        const modal = new ModalBuilder()
          .setCustomId('modal_rh_pimentel')
          .setTitle('Formulário RH - Pimentel');

        const nomeIdade = new TextInputBuilder()
          .setCustomId('nome_idade')
          .setLabel('Nome completo + idade')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('Ex: André Oliveira - 28');

        const tempoEstilo = new TextInputBuilder()
          .setCustomId('tempo_estilo')
          .setLabel('Tempo de ETS2 + estilo de rodagem')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setPlaceholder('Ex: Jogo há 2 anos / estilo simulador / gosto de comboio');

        const empresas = new TextInputBuilder()
          .setCustomId('empresas_anteriores')
          .setLabel('Já participou de outras empresas?')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setPlaceholder('Informe quais empresas e como foi sua experiência');

        const disponibilidade = new TextInputBuilder()
          .setCustomId('disponibilidade')
          .setLabel('Sua disponibilidade')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setPlaceholder('Dias e horários em que pode rodar');

       const estrutura = new TextInputBuilder()
  .setCustomId('estrutura_jogo')
  .setLabel('Mapa RBR, DLCs e mods pagos')
  .setStyle(TextInputStyle.Paragraph)
  .setRequired(true)
  .setPlaceholder('Ex: RBR sim | DLCs: Going East | ModShop: sim | Norman: não');

        modal.addComponents(
          new ActionRowBuilder().addComponents(nomeIdade),
          new ActionRowBuilder().addComponents(tempoEstilo),
          new ActionRowBuilder().addComponents(empresas),
          new ActionRowBuilder().addComponents(disponibilidade),
          new ActionRowBuilder().addComponents(estrutura)
        );

        await interaction.showModal(modal);
        return;
      }

      if (interaction.customId.startsWith('aprovar_')) {
        const userId = interaction.customId.split('_')[1];
        const membro = await interaction.guild.members.fetch(userId).catch(() => null);

        if (!membro) {
          await interaction.reply({
            content: '❌ Não encontrei o usuário.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await membro.roles.add(CARGO_EM_TESTE_ID).catch(() => {});

        const canalAprovados = interaction.guild.channels.cache.get(APROVACAO_CHANNEL_ID);

        if (canalAprovados) {
          const embed = new EmbedBuilder()
            .setTitle('✅ Candidato aprovado para fase de teste')
            .setColor(BRAND.cores.aprovacao)
            .setDescription(`O candidato <@${userId}> foi aprovado e recebeu o cargo **Em teste**.`)
            .setTimestamp();

          await canalAprovados.send({ embeds: [embed] });
        }

        await membro.send(
          '🎉 Parabéns! Você foi aprovado na **Pimentel Turismo VTC** para a fase inicial.\n\n' +
          'No momento você recebeu o cargo **Em teste**.\n' +
          'Siga as regras, utilize o sistema corretamente e aguarde sua evolução dentro da empresa.\n\n' +
          'Seja bem-vindo!'
        ).catch(() => {});

        await interaction.update({
          content: `✅ <@${userId}> aprovado e colocado em fase de teste.`,
          embeds: [],
          components: []
        });

        return;
      }

      if (interaction.customId.startsWith('reprovar_')) {
        const userId = interaction.customId.split('_')[1];
        const membro = await interaction.guild.members.fetch(userId).catch(() => null);

        if (membro) {
          await membro.send(
            '❌ Sua inscrição na **Pimentel Turismo VTC** não foi aprovada neste momento.\n\n' +
            'Você pode tentar novamente futuramente.'
          ).catch(() => {});
        }

        const canalAprovados = interaction.guild.channels.cache.get(APROVACAO_CHANNEL_ID);
        if (canalAprovados) {
          const embed = new EmbedBuilder()
            .setTitle('❌ Candidato reprovado')
            .setColor(BRAND.cores.reprovacao)
            .setDescription(`O candidato <@${userId}> não foi aprovado neste momento.`)
            .setTimestamp();

          await canalAprovados.send({ embeds: [embed] });
        }

        await interaction.update({
          content: `❌ <@${userId}> reprovado.`,
          embeds: [],
          components: []
        });

        return;
      }

      // =====================
      // ABRIR CANAIS
      // =====================
      if (interaction.customId === 'abrir_curtas') {
        await interaction.reply({
          content: `🟢 Canais de curtas:\n${textoCanaisPorGrupo(interaction.guild, 'curta')}`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (interaction.customId === 'abrir_medias') {
        await interaction.reply({
          content: `🟡 Canais de médias:\n${textoCanaisPorGrupo(interaction.guild, 'media')}`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (interaction.customId === 'abrir_longas') {
        await interaction.reply({
          content: `🔴 Canais de longas:\n${textoCanaisPorGrupo(interaction.guild, 'longa')}`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (interaction.customId === 'abrir_funcionarios') {
        const canal = encontrarCanalFuncionarios(interaction.guild);
        await interaction.reply({
          content: canal ? `🏭 Canal de funcionários:\n• <#${canal.id}>` : '❌ Canal de funcionários não encontrado.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      // =====================
      // BASE SEPARADA
      // =====================
      if (interaction.customId === 'abrir_entrada_base') {
        await interaction.reply({
          content: '🅿️ Escolha abaixo a base onde o ônibus será recolhido:',
          components: criarBotoesEscolhaEntradaBase(),
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (interaction.customId.startsWith('entrarbase_')) {
        const userId = interaction.user.id;
        const baseId = interaction.customId.replace('entrarbase_', '');
        const base = obterBase(baseId);

        if (!base) {
          await interaction.reply({
            content: '❌ Base não encontrada.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        estadoBaseMotoristas.set(userId, base);

        await interaction.update({
          embeds: [embedEntradaBase(userId, base)],
          components: []
        });
        return;
      }

      if (interaction.customId === 'sair_da_base') {
        const userId = interaction.user.id;
        const base = estadoBaseMotoristas.get(userId);

        if (!base) {
          await interaction.reply({
            content: '❌ Você não está em nenhuma base no momento.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        estadoBaseMotoristas.delete(userId);

        await interaction.reply({
          embeds: [embedSaidaBase(userId, base)],
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      // =====================
      // SERVIÇOS
      // =====================
      if (interaction.customId === 'solicitar_abastecimento_base') {
        const userId = interaction.user.id;

        const aberta = buscarSolicitacaoAbertaDoMotorista(userId, [
          'abastecimento_base',
          'abastecimento_rua'
        ]);

        if (aberta) {
          await interaction.reply({
            content: `❌ Você já possui uma solicitação de abastecimento aberta (#${aberta.id}).`,
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const id = gerarServicoId();

        const solicitacao = {
          id,
          tipo: 'abastecimento_base',
          motoristaId: userId,
          status: 'autorizado',
          canalId: interaction.channelId,
          criadoEm: Date.now()
        };

        solicitacoesServico.set(id, solicitacao);

        const mensagem = await interaction.channel.send({
          content: `📢 Solicitação de abastecimento na base de <@${userId}>`,
          embeds: [montarEmbedSolicitacaoServico(solicitacao)],
          components: criarBotoesSolicitacaoServico(id, false)
        });

        await interaction.reply({
          content: '⛽ Solicitação enviada. O sistema autorizou o abastecimento automaticamente.',
          flags: MessageFlags.Ephemeral
        });

        setTimeout(async () => {
          try {
            const atual = solicitacoesServico.get(id);
            if (!atual || atual.status !== 'autorizado') return;

            atual.status = 'pronto';
            solicitacoesServico.set(id, atual);

            await mensagem.edit({
              embeds: [montarEmbedSolicitacaoServico(atual)],
              components: criarBotoesSolicitacaoServico(id, true)
            }).catch(() => {});
          } catch (err) {
            console.error('Erro no abastecimento automático:', err);
          }
        }, TEMPO_ABASTECIMENTO_MS);

        return;
      }

      if (interaction.customId === 'solicitar_abastecimento_rua') {
        const userId = interaction.user.id;

        const aberta = buscarSolicitacaoAbertaDoMotorista(userId, [
          'abastecimento_base',
          'abastecimento_rua'
        ]);

        if (aberta) {
          await interaction.reply({
            content: `❌ Você já possui uma solicitação de abastecimento aberta (#${aberta.id}).`,
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const id = gerarServicoId();

        const solicitacao = {
          id,
          tipo: 'abastecimento_rua',
          motoristaId: userId,
          status: 'autorizado',
          canalId: interaction.channelId,
          criadoEm: Date.now()
        };

        solicitacoesServico.set(id, solicitacao);

        const mensagem = await interaction.channel.send({
          content: `📢 Solicitação de abastecimento na rua de <@${userId}>`,
          embeds: [montarEmbedSolicitacaoServico(solicitacao)],
          components: criarBotoesSolicitacaoServico(id, false)
        });

        await interaction.reply({
          content: '🛣️ Solicitação enviada. O sistema autorizou automaticamente o abastecimento fora da base.',
          flags: MessageFlags.Ephemeral
        });

        setTimeout(async () => {
          try {
            const atual = solicitacoesServico.get(id);
            if (!atual || atual.status !== 'autorizado') return;

            atual.status = 'pronto';
            solicitacoesServico.set(id, atual);

            await mensagem.edit({
              embeds: [montarEmbedSolicitacaoServico(atual)],
              components: criarBotoesSolicitacaoServico(id, true)
            }).catch(() => {});
          } catch (err) {
            console.error('Erro no abastecimento externo automático:', err);
          }
        }, TEMPO_ABASTECIMENTO_MS);

        return;
      }

      if (interaction.customId === 'solicitar_limpeza') {
        const userId = interaction.user.id;

        const aberta = buscarSolicitacaoAbertaDoMotorista(userId, ['limpeza']);

        if (aberta) {
          await interaction.reply({
            content: `❌ Você já possui uma solicitação de limpeza/manutenção aberta (#${aberta.id}).`,
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const id = gerarServicoId();

        const solicitacao = {
          id,
          tipo: 'limpeza',
          motoristaId: userId,
          status: 'autorizado',
          canalId: interaction.channelId,
          criadoEm: Date.now()
        };

        solicitacoesServico.set(id, solicitacao);

        const mensagem = await interaction.channel.send({
          content: `📢 Solicitação de limpeza/manutenção de <@${userId}>`,
          embeds: [montarEmbedSolicitacaoServico(solicitacao)],
          components: criarBotoesSolicitacaoServico(id, false)
        });

        await interaction.reply({
          content: '🧼 Solicitação enviada. O sistema acionou automaticamente a limpeza/manutenção.',
          flags: MessageFlags.Ephemeral
        });

        setTimeout(async () => {
          try {
            const atual = solicitacoesServico.get(id);
            if (!atual || atual.status !== 'autorizado') return;

            atual.status = 'pronto';
            solicitacoesServico.set(id, atual);

            await mensagem.edit({
              embeds: [montarEmbedSolicitacaoServico(atual)],
              components: criarBotoesSolicitacaoServico(id, true)
            }).catch(() => {});
          } catch (err) {
            console.error('Erro na limpeza automática:', err);
          }
        }, TEMPO_LIMPEZA_MS);

        return;
      }

      if (interaction.customId.startsWith('liberar_servico_')) {
        const id = interaction.customId.replace('liberar_servico_', '');
        const solicitacao = solicitacoesServico.get(id);

        if (!solicitacao) {
          await interaction.reply({
            content: '❌ Solicitação não encontrada.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (interaction.user.id !== solicitacao.motoristaId) {
          await interaction.reply({
            content: '❌ Apenas o motorista que abriu a solicitação pode confirmar a liberação.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (solicitacao.status === 'autorizado') {
          await interaction.reply({
            content: '⏳ O serviço ainda está em andamento. Aguarde a conclusão.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (solicitacao.status !== 'pronto') {
          await interaction.reply({
            content: '❌ Essa solicitação não está pronta para liberação.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        solicitacao.status = 'finalizado';
        solicitacoesServico.set(id, solicitacao);

        await interaction.update({
          embeds: [montarEmbedSolicitacaoServico(solicitacao)],
          components: []
        });

        solicitacoesServico.delete(id);
        return;
      }

      // =====================
      // VIAGENS NORMAIS
      // =====================
      if (interaction.customId.startsWith('assumir_')) {
        const id = interaction.customId.split('_')[1];
        const userId = interaction.user.id;
        const viagem = obterViagem(id);

        if (!viagem) {
          await interaction.reply({
            content: '❌ Operação não encontrada.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const estado = getEstado(userId);

        if (estado.status === 'viagem' || estado.status === 'funcionarios') {
          await interaction.reply({
            content: textoBloqueio(userId),
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        setEstado(userId, {
          status: 'viagem',
          tipo: 'normal',
          viagemId: id
        });

        const andamento = encontrarCanalAndamento(interaction.guild);

        await interaction.update({
          embeds: [embedConferindoPassagem(viagem, userId)],
          components: []
        });

        setTimeout(async () => {
          try {
            if (andamento) {
              await andamento.send({ embeds: [embedEmbarqueConcluido(viagem, userId)] });
            }

            await interaction.message.edit({
              embeds: [montarEmbedViagem(viagem, false, `<@${userId}>`)],
              components: [criarBotaoFinalizar(id)]
            }).catch(() => {});
          } catch (err) {
            console.error('Erro no embarque:', err);
          }
        }, TEMPO_EMBARQUE_MS);

        return;
      }

      if (interaction.customId.startsWith('finalizar_')) {
        const id = interaction.customId.split('_')[1];
        const userId = interaction.user.id;
        const viagem = obterViagem(id);
        const estado = getEstado(userId);

        if (!viagem) {
          await interaction.reply({
            content: '❌ Operação não encontrada.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (!(estado.status === 'viagem' && estado.viagemId == id)) {
          await interaction.reply({
            content: '❌ Essa operação não está vinculada a você.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await interaction.update({
          embeds: [embedDesembarqueIniciado(`${viagem.origemNome} → ${viagem.destinoNome}`, userId)],
          components: []
        });

        setTimeout(async () => {
          try {
            const historico = encontrarCanalHistorico(interaction.guild);
            if (historico) {
              await historico.send({ embeds: [embedHistoricoNormal(viagem, userId)] });
            }

            setEstado(userId, estadoLivre());

            await interaction.message.edit({
              content: '✅ Viagem finalizada com sucesso.\nVocê já pode pegar outra viagem normalmente.\nCaso queira recolher o ônibus, utilize o canal de base.',
              embeds: [],
              components: []
            }).catch(() => {});
          } catch (err) {
            console.error('Erro na finalização:', err);
          }
        }, TEMPO_DESEMBARQUE_MS);

        return;
      }

      // =====================
      // FUNCIONÁRIOS
      // =====================
      if (interaction.customId.startsWith('assumirfunc_')) {
        const id = interaction.customId.split('_')[1];
        const userId = interaction.user.id;
        const dados = obterFuncionario(id);
        const estado = getEstado(userId);

        if (!dados) {
          await interaction.reply({
            content: '❌ Transporte corporativo não encontrado.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (estado.status === 'viagem' || estado.status === 'funcionarios') {
          await interaction.reply({
            content: textoBloqueio(userId),
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        setEstado(userId, {
          status: 'funcionarios',
          tipo: 'funcionarios',
          viagemId: id
        });

        await interaction.update({
          embeds: [montarEmbedFuncionario(dados, `<@${userId}>`)],
          components: [criarBotaoFinalizarFuncionario(id)]
        });

        return;
      }

      if (interaction.customId.startsWith('finalizarfunc_')) {
        const id = interaction.customId.split('_')[1];
        const userId = interaction.user.id;
        const dados = obterFuncionario(id);
        const estado = getEstado(userId);

        if (!dados) {
          await interaction.reply({
            content: '❌ Transporte corporativo não encontrado.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (!(estado.status === 'funcionarios' && estado.viagemId == id)) {
          await interaction.reply({
            content: '❌ Esse transporte não está vinculado a você.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await interaction.update({
          embeds: [embedDesembarqueIniciado(`${dados.origem} → ${dados.destino}`, userId)],
          components: []
        });

        setTimeout(async () => {
          try {
            const historico = encontrarHistoricoFuncionarios(interaction.guild);
            if (historico) {
              await historico.send({ embeds: [embedHistoricoFuncionario(dados, userId)] });
            }

            setEstado(userId, estadoLivre());

            await interaction.message.edit({
              content: '✅ Transporte finalizado com sucesso.\nVocê já pode pegar outra operação normalmente.\nCaso queira recolher o ônibus, utilize o canal de base.',
              embeds: [],
              components: []
            }).catch(() => {});
          } catch (err) {
            console.error('Erro na finalização de funcionários:', err);
          }
        }, TEMPO_DESEMBARQUE_MS);

        return;
      }
    }
  } catch (error) {
    console.error('Erro na interação:', error);

    if (interaction.isRepliable()) {
      const payload = {
        content: '❌ Deu erro ao processar a ação.',
        flags: MessageFlags.Ephemeral
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  }
});

app.get('/', (_req, res) => {
  res.status(200).send('Bot Pimentel Turismo online.');
});

app.post('/webhook/trucky', async (req, res) => {
  try {
    if (!validarAssinaturaTrucky(req)) {
      console.log('❌ Assinatura inválida do Trucky');
      return res.status(401).send('Invalid signature');
    }

    const eventName = req.body?.event;
    const data = req.body?.data || {};

    if (!eventName) {
      return res.status(400).send('Missing event');
    }

    console.log(`📡 Evento Trucky recebido: ${eventName}`);
    await processarEventoTrucky(eventName, data);

    return res.sendStatus(200);
  } catch (error) {
    console.error('Erro no webhook Trucky:', error);
    return res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Webhook HTTP ativo na porta ${PORT}`);
});

client.login(process.env.TOKEN);
const axios = require('axios');

const VTLOG_TOKEN = process.env.VTLOG_TOKEN;

async function buscarVTLog(username) {
  try {
    const res = await axios.get(`https://api.vtlog.net/v3/users?search=${username}`, {
      headers: {
        Authorization: `Bearer ${VTLOG_TOKEN}`
      }
    });

    if (!res.data || res.data.length === 0) return null;

    return res.data[0];
  } catch (err) {
    console.log("Erro VTLOG:", err.message);
    return null;
  }
}
client.on('messageCreate', async (message) => {
  if (message.content.startsWith('!vtlog')) {

    const user = message.content.split(' ')[1];

    if (!user) {
      return message.reply("Use: !vtlog SEU_USUARIO");
    }

    const dados = await buscarVTLog(user);

    if (!dados) {
      return message.reply("Usuário não encontrado no VTLog");
    }

    message.reply(`
🚛 VTLOG

👤 Nome: ${dados.username}
📦 Entregas: ${dados.stats?.deliveries || 0}
📏 KM: ${dados.stats?.distance || 0}
⭐ Rating: ${dados.stats?.rating || 0}
    `);
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content.startsWith('!vtlog')) {
    const user = message.content.split(' ')[1];

    if (!user) {
      return message.reply("Use: !vtlog SEU_USUARIO");
    }

    const dados = await buscarVTLogSimples(user);

    if (!dados) {
      return message.reply("Usuário não encontrado no VTLog");
    }

    return message.reply(`
🚛 VTLOG

👤 Nome: ${dados.username}
📦 Entregas: ${dados.stats?.deliveries || 0}
📏 KM: ${dados.stats?.distance || 0}
⭐ Rating: ${dados.stats?.rating || 0}
    `);
  }
});
