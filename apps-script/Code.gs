/**
 * Rewind Awards · backend da votação (Google Apps Script vinculado ao FORMULÁRIO "Awards").
 *
 * Como funciona:
 *   GET  → lista as perguntas do formulário como categorias do site.
 *   POST → grava as indicações como uma resposta nova do próprio formulário
 *          (aparece em "Respostas" e na planilha vinculada, se houver).
 *
 * Regra: votação aberta, 1 resposta por e-mail. O formulário precisa de uma
 * pergunta de resposta curta chamada "E-mail" (e, opcional, uma chamada "Nome").
 * Essas duas não aparecem como categorias no site.
 *
 * Publicação: no editor do formulário, ⋮ > Editor de scripts, cole este arquivo.
 *   Implantar > Nova implantação > App da Web
 *   Executar como: Eu  ·  Quem pode acessar: Qualquer pessoa
 * Cole a URL /exec em config.js (SCRIPT_URL).
 */

const TITULO_EMAIL = 'E-mail';
const TITULO_NOME = 'Nome';
const TIPOS_ACEITOS = [
  FormApp.ItemType.TEXT,
  FormApp.ItemType.PARAGRAPH_TEXT,
  FormApp.ItemType.MULTIPLE_CHOICE,
  FormApp.ItemType.LIST,
];

function doGet() {
  try {
    return json_({ ok: true, categorias: lerCategorias_() });
  } catch (err) {
    return json_({ ok: false, erro: String(err.message || err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const nome = limpar_(body.nome, 80);
    const email = limpar_(body.email, 120).toLowerCase();
    const votos = Array.isArray(body.votos) ? body.votos : [];
    if (!nome) throw new Error('Nome obrigatório');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail inválido');
    if (!votos.length) throw new Error('Nenhuma indicação enviada');

    const form = FormApp.getActiveForm();
    const itemEmail = itemPorId_(form, body.idEmail) || acharItem_(form, ehEmail_);
    if (!itemEmail) throw new Error('O formulário precisa de uma pergunta "' + TITULO_EMAIL + '"');
    if (emailJaRespondeu_(form, itemEmail, email)) throw new Error('Este e-mail já enviou uma resposta');

    const resp = form.createResponse();
    resp.withItemResponse(responder_(itemEmail, email));
    const itemNome = itemPorId_(form, body.idNome) || acharItem_(form, ehNome_);
    if (itemNome) resp.withItemResponse(responder_(itemNome, nome));

    let gravados = 0;
    votos.forEach(v => {
      const item = form.getItemById(Number(v.id));
      if (item && (item.getId() === itemEmail.getId() || (itemNome && item.getId() === itemNome.getId()))) return;
      const valor = limpar_(v.resposta, 300);
      if (!item || !valor || TIPOS_ACEITOS.indexOf(item.getType()) === -1) return;
      resp.withItemResponse(responder_(item, valor));
      gravados++;
    });
    if (!gravados) throw new Error('Nenhuma categoria válida');
    resp.submit();
    return json_({ ok: true, gravados: gravados });
  } catch (err) {
    return json_({ ok: false, erro: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function lerCategorias_() {
  return FormApp.getActiveForm().getItems()
    .filter(it => TIPOS_ACEITOS.indexOf(it.getType()) !== -1)
    .filter(it => !ehEmail_(it.getTitle()) && !ehNome_(it.getTitle()))
    .map(it => ({
      id: String(it.getId()),
      categoria: it.getTitle(),
      descricao: it.getHelpText(),
      opcoes: opcoes_(it),
    }));
}

function opcoes_(item) {
  const t = item.getType();
  if (t === FormApp.ItemType.MULTIPLE_CHOICE) return item.asMultipleChoiceItem().getChoices().map(c => c.getValue());
  if (t === FormApp.ItemType.LIST) return item.asListItem().getChoices().map(c => c.getValue());
  return [];
}

function responder_(item, valor) {
  switch (item.getType()) {
    case FormApp.ItemType.PARAGRAPH_TEXT: return item.asParagraphTextItem().createResponse(valor);
    case FormApp.ItemType.MULTIPLE_CHOICE: return item.asMultipleChoiceItem().createResponse(valor);
    case FormApp.ItemType.LIST: return item.asListItem().createResponse(valor);
    default: return item.asTextItem().createResponse(valor);
  }
}

// Aceita variações do título: "E-mail", "Email", "Seu e-mail", "Nome", "Nome completo", "Qual seu nome?"…
function tituloLimpo_(t) {
  return normalizar_(t).replace(/[^a-z0-9 -]/g, ' ').replace(/\s+/g, ' ').trim();
}
function ehEmail_(t) { return /^(qual )?(e )?(o )?(seu )?(endereco de )?e-? ?mail( \w+)?$/.test(tituloLimpo_(t)); }
function ehNome_(t) { return /^(qual )?(e )?(o )?(seu )?nome( completo| e sobrenome)?$/.test(tituloLimpo_(t)); }

function acharItem_(form, teste) {
  return form.getItems()
    .filter(it => [FormApp.ItemType.TEXT, FormApp.ItemType.PARAGRAPH_TEXT].indexOf(it.getType()) !== -1)
    .filter(it => teste(it.getTitle()))[0] || null;
}

function itemPorId_(form, id) {
  if (!id) return null;
  try {
    const it = form.getItemById(Number(id));
    return it && [FormApp.ItemType.TEXT, FormApp.ItemType.PARAGRAPH_TEXT].indexOf(it.getType()) !== -1 ? it : null;
  } catch (e) { return null; }
}

function emailJaRespondeu_(form, itemEmail, email) {
  return form.getResponses().some(r => {
    const ir = r.getResponseForItem(itemEmail);
    return ir && String(ir.getResponse()).trim().toLowerCase() === email;
  });
}

function normalizar_(s) {
  return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function limpar_(v, max) {
  // tira fórmulas injetadas (=, +, -, @ no início) e corta o tamanho
  return String(v == null ? '' : v).trim().replace(/^[=+\-@]+/, '').slice(0, max);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
