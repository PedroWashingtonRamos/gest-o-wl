const SUPABASE_URL = 'https://xdwgafznajylkpxutkub.supabase.co';
const SUPABASE_KEY = 'COLE_SUA_SUPABASE_KEY_AQUI';
const APPS_SCRIPT_URL = 'COLE_AQUI_A_URL_DO_SEU_APPS_SCRIPT';

const banco = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const VALOR_PRODUTO = 7.50;
const VALOR_HORA = 35.00;

let chartInstance = null;
let editandoId = null;

const cacheDados = {
  historico: [],
  solicitacoesLocal: []
};

const loginView = document.getElementById('login-view');
const adminApp = document.getElementById('admin-app-view');
const clientApp = document.getElementById('client-app-view');

function numeroSeguro(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function textoSeguro(valor) {
  return String(valor || '').trim();
}

function formataMoeda(valor) {
  return numeroSeguro(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function dataBadgeAtual() {
  const hoje = new Date();
  const texto = hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function getDataAtual() {
  const hoje = new Date();
  return `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;
}

function montarLinhaVazia(colspan, texto = 'Vazio') {
  return `<tr><td colspan="${colspan}" class="center">${texto}</td></tr>`;
}

function getStatusClass(status) {
  const s = textoSeguro(status).toLowerCase();
  if (s === 'aprovado') return 'status-aprovado';
  if (s === 'rejeitado') return 'status-rejeitado';
  return 'status-pendente';
}

function getStatusLabel(status) {
  const s = textoSeguro(status).toLowerCase();
  if (s === 'aprovado') return 'Aprovado';
  if (s === 'rejeitado') return 'Rejeitado';
  return 'Pendente';
}

function renderStatusBadge(status) {
  const cls = getStatusClass(status);
  const label = getStatusLabel(status);
  return `<span class="status-pill ${cls}"><span class="status-dot"></span>${label}</span>`;
}

function classeStatusSolicitacao(status) {
  const valor = textoSeguro(status).toLowerCase();
  if (valor === 'concluido' || valor === 'concluído') return 'status-ok';
  if (valor === 'em andamento') return 'status-pendente';
  return 'status-pendente';
}

function calcularResumo() {
  let totalProdutos = 0;
  let totalHoras = 0;

  cacheDados.historico.forEach(item => {
    const tipo = textoSeguro(item.tipo);
    const qtd = numeroSeguro(item.quantidade);
    const status = textoSeguro(item.status).toLowerCase();

    if (status !== 'aprovado') return;

    if (tipo === 'produto') totalProdutos += qtd;
    if (tipo === 'hora') totalHoras += qtd;
  });

  const valorProdutos = totalProdutos * VALOR_PRODUTO;
  const valorHoras = totalHoras * VALOR_HORA;
  const faturamento = valorProdutos + valorHoras;

  return {
    totalProdutos,
    totalHoras,
    valorProdutos,
    valorHoras,
    faturamento
  };
}

function criarBridgePlanilha() {
  if (!document.getElementById('sheet-bridge-frame')) {
    const iframe = document.createElement('iframe');
    iframe.name = 'sheet-bridge-frame';
    iframe.id = 'sheet-bridge-frame';
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
  }
}

function enviarAcaoParaPlanilha(action, payload = {}) {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('COLE_AQUI')) {
    alert('Configure a URL do Apps Script.');
    return false;
  }

  criarBridgePlanilha();

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = APPS_SCRIPT_URL;
  form.target = 'sheet-bridge-frame';
  form.style.display = 'none';

  const dados = { action, ...payload };

  Object.keys(dados).forEach((key) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = String(dados[key]);
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();

  setTimeout(() => form.remove(), 1000);
  return true;
}

async function carregarDadosDoBanco() {
  try {
    const { data, error } = await banco
      .from('historico_wl')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error(error);
      alert('Erro ao carregar dados do banco.');
      return;
    }

    cacheDados.historico = Array.isArray(data) ? data.map(item => ({
      id: item.id,
      data: textoSeguro(item.data),
      tipo: textoSeguro(item.tipo),
      descricao: textoSeguro(item.descricao),
      quantidade: numeroSeguro(item.quantidade),
      status: textoSeguro(item.status) || 'pendente',
      aprovado_por: textoSeguro(item.aprovado_por),
      data_aprovacao: textoSeguro(item.data_aprovacao)
    })) : [];

    atualizarTelas();
  } catch (err) {
    console.error(err);
    alert('Erro crítico ao carregar dados.');
  }
}

function renderGrafico(valorProdutos, valorHoras) {
  const canvas = document.getElementById('chartComposicao');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const semDados = valorProdutos === 0 && valorHoras === 0;

  const grad = ctx.createLinearGradient(0, 0, 0, 400);
  grad.addColorStop(0, '#18C4D8');
  grad.addColorStop(1, '#123C9C');

  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: semDados ? ['Sem dados'] : ['Produtos', 'Horas'],
      datasets: [{
        data: semDados ? [1] : [valorProdutos, valorHoras],
        backgroundColor: semDados ? ['#E5E7EB'] : [grad, '#0F1B6D'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '78%',
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}

function atualizarTabelaSolicitacoesLocal() {
  const tbody = document.getElementById('tabela-solicitacoes-cliente');
  if (!tbody) return;

  if (!cacheDados.solicitacoesLocal.length) {
    tbody.innerHTML = montarLinhaVazia(4, 'Sem solicitações locais exibidas.');
    return;
  }

  tbody.innerHTML = [...cacheDados.solicitacoesLocal].reverse().map(item => `
    <tr>
      <td>${item.data}</td>
      <td>${item.titulo}</td>
      <td><span class="status-badge ${classeStatusSolicitacao(item.status)}">${item.status}</span></td>
      <td>${item.prioridade || '-'}</td>
    </tr>
  `).join('');
}

function atualizarTabelaAprovacoesCliente() {
  const tbody = document.getElementById('tabela-aprovacoes-cliente');
  if (!tbody) return;

  if (!cacheDados.historico.length) {
    tbody.innerHTML = montarLinhaVazia(6, 'Nenhuma entrega encontrada.');
    return;
  }

  tbody.innerHTML = [...cacheDados.historico].reverse().map(item => {
    const statusBadge = renderStatusBadge(item.status);
    const qtdLabel = item.tipo === 'produto'
      ? `${item.quantidade} un.`
      : `${item.quantidade}h`;

    const acoes = item.status === 'pendente'
      ? `
        <div class="action-row">
          <button class="btn-mini btn-aprovar" onclick="atualizarStatusItem(${item.id}, 'aprovado')">Aprovar</button>
          <button class="btn-mini btn-rejeitar" onclick="atualizarStatusItem(${item.id}, 'rejeitado')">Rejeitar</button>
        </div>
      `
      : `<span class="muted">${item.aprovado_por || '-'} ${item.data_aprovacao ? '• ' + item.data_aprovacao : ''}</span>`;

    return `
      <tr>
        <td>${item.data}</td>
        <td>${item.tipo}</td>
        <td>${item.descricao}</td>
        <td>${qtdLabel}</td>
        <td>${statusBadge}</td>
        <td>${acoes}</td>
      </tr>
    `;
  }).join('');
}

function atualizarTelas() {
  const resumo = calcularResumo();

  let htmlProdutos = '';
  let htmlHoras = '';
  let htmlRecentes = '';

  [...cacheDados.historico].reverse().forEach(item => {
    const id = item.id;
    const tipo = textoSeguro(item.tipo);
    const data = textoSeguro(item.data);
    const descricao = textoSeguro(item.descricao) || '-';
    const quantidade = numeroSeguro(item.quantidade);
    const statusBadge = renderStatusBadge(item.status);

    const badge = tipo === 'produto'
      ? `<span class="status-badge" style="background:rgba(24,196,216,.14);color:#0B7A8C;">PRODUTO</span>`
      : `<span class="status-badge" style="background:#EEF4FF;color:#123C9C;">HORA</span>`;

    const acoes = `
      <td class="align-right">
        <button class="btn-action" type="button" onclick="prepararEdicao(${id})">✏️</button>
        <button class="btn-action" type="button" onclick="deletarItem(${id})">🗑️</button>
      </td>
    `;

    if (tipo === 'produto') {
      htmlProdutos += `
        <tr>
          <td>${data}</td>
          <td>${descricao}</td>
          <td>${quantidade} un.</td>
          <td>R$ ${formataMoeda(quantidade * VALOR_PRODUTO)}</td>
          <td>${statusBadge}</td>
          ${acoes}
        </tr>
      `;
    }

    if (tipo === 'hora') {
      htmlHoras += `
        <tr>
          <td>${data}</td>
          <td>${descricao}</td>
          <td>${quantidade}h</td>
          <td>R$ ${formataMoeda(quantidade * VALOR_HORA)}</td>
          <td>${statusBadge}</td>
          ${acoes}
        </tr>
      `;
    }

    htmlRecentes += `
      <tr>
        <td>${data}</td>
        <td>${badge}</td>
        <td>${quantidade}${tipo === 'produto' ? ' un.' : 'h'} - ${descricao}</td>
      </tr>
    `;
  });

  document.querySelectorAll('.dash-faturamento').forEach(el => {
    el.textContent = 'R$ ' + formataMoeda(resumo.faturamento);
  });

  document.querySelectorAll('.dash-produtos').forEach(el => {
    el.textContent = resumo.totalProdutos;
  });

  document.querySelectorAll('.dash-horas').forEach(el => {
    el.textContent = resumo.totalHoras + 'h';
  });

  document.querySelectorAll('.dash-sub-produtos').forEach(el => {
    el.textContent = `Total: R$ ${formataMoeda(resumo.valorProdutos)}`;
  });

  document.querySelectorAll('.dash-sub-horas').forEach(el => {
    el.textContent = `Total: R$ ${formataMoeda(resumo.valorHoras)}`;
  });

  document.querySelectorAll('.relatorio-total').forEach(el => {
    el.textContent = 'R$ ' + formataMoeda(resumo.faturamento);
  });

  const finProd = document.getElementById('financeiro-produtos');
  const finHoras = document.getElementById('financeiro-horas');

  if (finProd) finProd.textContent = 'R$ ' + formataMoeda(resumo.valorProdutos);
  if (finHoras) finHoras.textContent = 'R$ ' + formataMoeda(resumo.valorHoras);

  document.querySelectorAll('.table-produtos tbody').forEach(el => {
    el.innerHTML = htmlProdutos || montarLinhaVazia(6);
  });

  document.querySelectorAll('.table-horas tbody').forEach(el => {
    el.innerHTML = htmlHoras || montarLinhaVazia(6);
  });

  document.querySelectorAll('.table-recentes tbody').forEach(el => {
    el.innerHTML = htmlRecentes || montarLinhaVazia(3);
  });

  if (localStorage.getItem('wl_role') === 'admin') {
    renderGrafico(resumo.valorProdutos, resumo.valorHoras);
  }

  atualizarTabelaSolicitacoesLocal();
  atualizarTabelaAprovacoesCliente();
}

async function registrarItem(tipo, descricao, quantidade) {
  const descricaoLimpa = textoSeguro(descricao);
  const qtd = parseInt(quantidade, 10);

  if (!descricaoLimpa) {
    alert('Preencha a descrição.');
    return;
  }

  if (!Number.isInteger(qtd) || qtd <= 0) {
    alert('Informe uma quantidade válida.');
    return;
  }

  const btnSubmit = tipo === 'hora'
    ? document.getElementById('btn-submit-hora')
    : document.getElementById('btn-submit-produto');

  const loader = tipo === 'hora'
    ? document.getElementById('loader-hora')
    : document.getElementById('loader-produto');

  btnSubmit.disabled = true;
  loader.style.display = 'block';

  try {
    if (editandoId) {
      const { error } = await banco
        .from('historico_wl')
        .update({
          descricao: descricaoLimpa,
          quantidade: qtd
        })
        .eq('id', editandoId);

      if (error) {
        console.error(error);
        alert('Erro ao atualizar.');
        return;
      }

      const index = cacheDados.historico.findIndex(i => i.id === editandoId);

      if (index !== -1) {
        cacheDados.historico[index].descricao = descricaoLimpa;
        cacheDados.historico[index].quantidade = qtd;

        const itemAtualizado = cacheDados.historico[index];

        if (tipo === 'hora') {
          enviarAcaoParaPlanilha('upsert_hora', {
            id: itemAtualizado.id,
            data: itemAtualizado.data,
            descricao: itemAtualizado.descricao,
            quantidade: itemAtualizado.quantidade,
            valor_hora: VALOR_HORA,
            status: itemAtualizado.status || 'pendente',
            aprovado_por: itemAtualizado.aprovado_por || '',
            data_aprovacao: itemAtualizado.data_aprovacao || ''
          });
        } else {
          enviarAcaoParaPlanilha('upsert_produto', {
            id: itemAtualizado.id,
            data: itemAtualizado.data,
            descricao: itemAtualizado.descricao,
            quantidade: itemAtualizado.quantidade,
            valor_unitario: VALOR_PRODUTO,
            status: itemAtualizado.status || 'pendente',
            aprovado_por: itemAtualizado.aprovado_por || '',
            data_aprovacao: itemAtualizado.data_aprovacao || ''
          });
        }
      }

      editandoId = null;
      document.getElementById('btn-submit-hora').textContent = 'Registrar Horas';
      document.getElementById('btn-submit-produto').textContent = 'Registrar Lote';
    } else {
      const novoItem = {
        id: Date.now(),
        data: getDataAtual(),
        tipo,
        descricao: descricaoLimpa,
        quantidade: qtd,
        status: 'pendente',
        aprovado_por: '',
        data_aprovacao: ''
      };

      const { error } = await banco
        .from('historico_wl')
        .insert([novoItem]);

      if (error) {
        console.error(error);
        alert('Erro ao salvar.');
        return;
      }

      cacheDados.historico.push(novoItem);

      if (tipo === 'hora') {
        enviarAcaoParaPlanilha('upsert_hora', {
          id: novoItem.id,
          data: novoItem.data,
          descricao: novoItem.descricao,
          quantidade: novoItem.quantidade,
          valor_hora: VALOR_HORA,
          status: novoItem.status,
          aprovado_por: novoItem.aprovado_por,
          data_aprovacao: novoItem.data_aprovacao
        });
      } else {
        enviarAcaoParaPlanilha('upsert_produto', {
          id: novoItem.id,
          data: novoItem.data,
          descricao: novoItem.descricao,
          quantidade: novoItem.quantidade,
          valor_unitario: VALOR_PRODUTO,
          status: novoItem.status,
          aprovado_por: novoItem.aprovado_por,
          data_aprovacao: novoItem.data_aprovacao
        });
      }
    }

    atualizarTelas();

    if (tipo === 'hora') {
      document.getElementById('form-horas').reset();
    } else {
      document.getElementById('form-produtos').reset();
    }
  } finally {
    btnSubmit.disabled = false;
    loader.style.display = 'none';
  }
}

function prepararEdicao(id) {
  const item = cacheDados.historico.find(i => i.id === id);
  if (!item) return;

  editandoId = id;

  if (item.tipo === 'hora') {
    ativarAba(document.getElementById('admin-app-view'), 'view-horas-admin', 'Lançar Horas');
    document.getElementById('desc-hora').value = item.descricao;
    document.getElementById('qtd-hora').value = item.quantidade;
    document.getElementById('btn-submit-hora').textContent = 'Salvar Alterações';
  } else {
    ativarAba(document.getElementById('admin-app-view'), 'view-produtos-admin', 'Lançar Produtos');
    document.getElementById('desc-produto').value = item.descricao;
    document.getElementById('qtd-produto').value = item.quantidade;
    document.getElementById('btn-submit-produto').textContent = 'Salvar Alterações';
  }
}

async function deletarItem(id) {
  if (!confirm('Tem certeza que deseja excluir este registro?')) return;

  const item = cacheDados.historico.find(i => i.id === id);

  try {
    const { error } = await banco
      .from('historico_wl')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(error);
      alert('Erro ao excluir.');
      return;
    }

    cacheDados.historico = cacheDados.historico.filter(i => i.id !== id);

    if (item?.tipo === 'hora') {
      enviarAcaoParaPlanilha('delete_hora', { id });
    }

    if (item?.tipo === 'produto') {
      enviarAcaoParaPlanilha('delete_produto', { id });
    }

    if (editandoId === id) {
      editandoId = null;
      document.getElementById('form-horas').reset();
      document.getElementById('form-produtos').reset();
      document.getElementById('btn-submit-hora').textContent = 'Registrar Horas';
      document.getElementById('btn-submit-produto').textContent = 'Registrar Lote';
    }

    atualizarTelas();
  } catch (err) {
    console.error(err);
    alert('Erro crítico ao excluir.');
  }
}

async function atualizarStatusItem(id, novoStatus) {
  const item = cacheDados.historico.find(i => i.id === id);
  if (!item) return;

  const aprovadoPor = localStorage.getItem('wl_role') === 'cliente' ? 'Cliente Haoday' : 'WL System';
  const dataAprovacao = getDataAtual();

  try {
    const { error } = await banco
      .from('historico_wl')
      .update({
        status: novoStatus,
        aprovado_por: aprovadoPor,
        data_aprovacao: dataAprovacao
      })
      .eq('id', id);

    if (error) {
      console.error(error);
      alert('Erro ao atualizar status.');
      return;
    }

    item.status = novoStatus;
    item.aprovado_por = aprovadoPor;
    item.data_aprovacao = dataAprovacao;

    if (item.tipo === 'hora') {
      enviarAcaoParaPlanilha('atualizar_status_hora', {
        id: item.id,
        status: item.status,
        aprovado_por: item.aprovado_por,
        data_aprovacao: item.data_aprovacao
      });
    } else if (item.tipo === 'produto') {
      enviarAcaoParaPlanilha('atualizar_status_produto', {
        id: item.id,
        status: item.status,
        aprovado_por: item.aprovado_por,
        data_aprovacao: item.data_aprovacao
      });
    }

    atualizarTelas();
  } catch (err) {
    console.error(err);
    alert('Erro crítico ao atualizar status.');
  }
}

function exportarPDF() {
  const resumo = calcularResumo();
  const itensAprovados = cacheDados.historico.filter(i => textoSeguro(i.status).toLowerCase() === 'aprovado');

  const tempDiv = document.createElement('div');
  tempDiv.style.padding = '30px';
  tempDiv.style.fontFamily = 'sans-serif';

  tempDiv.innerHTML = `
    <div style="text-align:center; margin-bottom:30px;">
      <img src="assets/wl-logo.png" alt="WL System" style="width:90px; margin-bottom:10px;">
      <h1 style="color:#123C9C; margin:0;">WL SYSTEM</h1>
      <h3 style="color:#5D6D7E; margin:5px 0 0 0;">Relatório de Medição e Faturamento</h3>
    </div>

    <div style="margin-bottom:30px; padding:15px; background:#F0F4F8; border-radius:8px;">
      <p style="margin:0; font-size:14px;"><strong>Data de Emissão:</strong> ${getDataAtual()}</p>
      <p style="margin:5px 0 0 0; font-size:18px;"><strong>Total Aprovado a Faturar:</strong> <span style="color:#123C9C;">R$ ${formataMoeda(resumo.faturamento)}</span></p>
    </div>

    <h4 style="border-bottom:2px solid #E5E7EB; padding-bottom:10px; margin-bottom:15px;">Detalhamento Aprovado</h4>

    <table style="width:100%; border-collapse:collapse; font-size:12px; text-align:left;">
      <thead style="background:#1C2833; color:#fff;">
        <tr>
          <th style="padding:10px;">Data</th>
          <th style="padding:10px;">Tipo</th>
          <th style="padding:10px;">Descrição</th>
          <th style="padding:10px;">Quantidade</th>
          <th style="padding:10px;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${itensAprovados.length
          ? itensAprovados.map(i => `
            <tr style="border-bottom:1px solid #E5E7EB;">
              <td style="padding:10px;">${i.data}</td>
              <td style="padding:10px; text-transform:uppercase;">${i.tipo}</td>
              <td style="padding:10px;">${i.descricao}</td>
              <td style="padding:10px;">${i.quantidade}</td>
              <td style="padding:10px;">${getStatusLabel(i.status)}</td>
            </tr>
          `).join('')
          : `<tr><td colspan="5" style="padding:10px; text-align:center;">Nenhum item aprovado encontrado.</td></tr>`
        }
      </tbody>
    </table>
  `;

  html2pdf().set({
    margin: 10,
    filename: 'WL_System_Medicao.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  }).from(tempDiv).save();
}

function enviarParaPlanilha() {
  const resumo = calcularResumo();
  const itensAprovados = cacheDados.historico.filter(i => textoSeguro(i.status).toLowerCase() === 'aprovado');

  if (!itensAprovados.length) {
    alert('Não há registros aprovados para enviar.');
    return;
  }

  const ok = enviarAcaoParaPlanilha('enviar_relatorio', {
    data_emissao: getDataAtual(),
    total_faturar: 'R$ ' + formataMoeda(resumo.faturamento),
    total_horas: resumo.totalHoras,
    total_produtos: resumo.totalProdutos,
    total_registros: itensAprovados.length,
    historico_json: JSON.stringify(itensAprovados)
  });

  if (ok) {
    alert('Medição enviada com sucesso!');
  }
}

function ativarAba(container, targetId, titulo) {
  if (!container) return;

  container.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.target === targetId);
  });

  container.querySelectorAll('.view-section').forEach(section => {
    section.classList.toggle('active', section.id === targetId);
  });

  const pageTitle = container.querySelector('.page-title');
  if (pageTitle && titulo) pageTitle.textContent = titulo;
}

function configurarNavegacao() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function () {
      const container = this.closest('.app-container');
      ativarAba(container, this.dataset.target, this.textContent.trim());
    });
  });
}

function configurarForms() {
  document.getElementById('form-horas')?.addEventListener('submit', function (e) {
    e.preventDefault();
    registrarItem(
      'hora',
      document.getElementById('desc-hora').value,
      document.getElementById('qtd-hora').value
    );
  });

  document.getElementById('form-produtos')?.addEventListener('submit', function (e) {
    e.preventDefault();
    registrarItem(
      'produto',
      document.getElementById('desc-produto').value,
      document.getElementById('qtd-produto').value
    );
  });

  document.getElementById('form-solicitacao')?.addEventListener('submit', function (e) {
    e.preventDefault();

    const titulo = textoSeguro(document.getElementById('titulo-solicitacao').value);
    const categoria = textoSeguro(document.getElementById('categoria-solicitacao').value);
    const prioridade = textoSeguro(document.getElementById('prioridade-solicitacao').value);
    const prazo = textoSeguro(document.getElementById('prazo-solicitacao').value);
    const detalhes = textoSeguro(document.getElementById('detalhes-solicitacao').value);

    if (!titulo || !detalhes) {
      alert('Preencha título e detalhes.');
      return;
    }

    cacheDados.solicitacoesLocal.push({
      data: getDataAtual(),
      titulo,
      categoria,
      prioridade,
      prazo,
      detalhes,
      status: 'pendente'
    });

    atualizarTabelaSolicitacoesLocal();

    const ok = enviarAcaoParaPlanilha('registrar_solicitacao', {
      data: getDataAtual(),
      titulo,
      categoria,
      prioridade,
      prazo,
      detalhes,
      status: 'pendente',
      origem: 'portal_cliente'
    });

    if (ok) {
      alert('Solicitação enviada com sucesso!');
      document.getElementById('form-solicitacao').reset();
    }
  });

  document.getElementById('form-login')?.addEventListener('submit', async function (e) {
    e.preventDefault();

    const emailInput = document.getElementById('email').value;
    const senhaInput = document.getElementById('senha').value;
    const btnSubmit = document.getElementById('btn-login-submit');

    btnSubmit.textContent = 'Autenticando...';
    btnSubmit.disabled = true;

    try {
      const { data, error } = await banco
        .from('usuarios_wl')
        .select('*')
        .eq('email', emailInput)
        .eq('senha', senhaInput);

      if (error) {
        alert('Erro ao conectar com o banco: ' + error.message);
        return;
      }

      if (data && data.length > 0) {
        const usuario = data[0];
        localStorage.setItem('wl_auth', 'true');
        localStorage.setItem('wl_role', usuario.perfil);
        await carregarPerfil();
      } else {
        alert('E-mail ou senha incorretos!');
      }
    } catch (err) {
      console.error(err);
      alert('Erro crítico no sistema.');
    } finally {
      btnSubmit.textContent = 'Acessar Sistema';
      btnSubmit.disabled = false;
    }
  });
}

async function carregarPerfil() {
  loginView.classList.add('hidden');

  if (localStorage.getItem('wl_role') === 'cliente') {
    adminApp.classList.add('hidden');
    clientApp.classList.remove('hidden');
  } else {
    clientApp.classList.add('hidden');
    adminApp.classList.remove('hidden');
  }

  await carregarDadosDoBanco();
}

function configurarLogout() {
  document.querySelectorAll('.btn-sair').forEach(btn => {
    btn.addEventListener('click', function () {
      localStorage.removeItem('wl_auth');
      localStorage.removeItem('wl_role');
      editandoId = null;

      adminApp.classList.add('hidden');
      clientApp.classList.add('hidden');
      loginView.classList.remove('hidden');

      document.getElementById('form-login')?.reset();
      document.getElementById('form-horas')?.reset();
      document.getElementById('form-produtos')?.reset();
      document.getElementById('form-solicitacao')?.reset();

      const btnHora = document.getElementById('btn-submit-hora');
      const btnProd = document.getElementById('btn-submit-produto');
      if (btnHora) btnHora.textContent = 'Registrar Horas';
      if (btnProd) btnProd.textContent = 'Registrar Lote';
    });
  });
}

function configurarBadgesData() {
  const adminBadge = document.getElementById('admin-date-badge');
  const clientBadge = document.getElementById('client-date-badge');

  if (adminBadge) adminBadge.textContent = dataBadgeAtual();
  if (clientBadge) clientBadge.textContent = dataBadgeAtual();
}

function init() {
  configurarBadgesData();
  configurarNavegacao();
  configurarForms();
  configurarLogout();
  atualizarTelas();

  if (localStorage.getItem('wl_auth') === 'true') {
    carregarPerfil();
  }
}

init();