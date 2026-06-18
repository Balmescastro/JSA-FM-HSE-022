/**
 * ═══════════════════════════════════════════════════════════════
 *  FM-HSE-022 · Análisis Continuo de Peligros por la Tarea
 *  app.js · v2.1 · Fase 2
 *
 *  Arquitectura: módulos como objetos literales con estado central
 *  compartido. Sin frameworks, sin transpilación, ES6+ vanilla.
 *
 *  Módulos implementados en esta fase:
 *    Config   → carga y acceso a los 4 JSON externos
 *    State    → AppState centralizado + persistencia localStorage
 *    Utils    → helpers reutilizables (uuid, fecha, DOM, toast)
 *    Modal    → modal de confirmación genérica
 *    Backup   → exportación e importación JSON
 *    UI.General      → SF-01 Información General
 *    UI.Responsables → SF-02 Responsables de la Tarea
 *    UI.Ubicacion    → SF-03 Punto de Encuentro / SF-04 Ducha
 *    UI.Senales      → SF-05 Señales para Detener la Tarea
 *    App      → orquestador principal, inicialización, autosave
 *
 *  Módulos diferidos (Fase 3+):
 *    UI.Pasos · UI.Peligros · UI.Controles · UI.Completitud
 *    UI.Resumen · UI.Aprobacion · UI.DocId · Matrix · Print · Admin
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

/* ───────────────────────────────────────────────────────────────
   UTILS — Helpers reutilizables sin dependencias
──────────────────────────────────────────────────────────────── */
const Utils = {

  /** Genera un UUID v4 simplificado */
  uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  },

  /**
   * Genera el consecutivo en formato DDMMAA-HHMM
   * Usa la hora local del dispositivo
   */
  generarConsecutivo() {
    const d  = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const aa = String(d.getFullYear()).slice(-2);
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}${mm}${aa}-${hh}${mi}`;
  },

  /** Formatea una fecha ISO para mostrar al usuario */
  formatearFechaHora(isoString) {
    try {
      const d = new Date(isoString);
      return d.toLocaleString('es-CO', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch {
      return isoString;
    }
  },

  /** Obtiene elemento del DOM; lanza error descriptivo si no existe */
  $el(id) {
    const el = document.getElementById(id);
    if (!el) console.warn(`[Utils.$el] Elemento no encontrado: #${id}`);
    return el;
  },

  /** Renderiza un badge de estado en un span de status */
  renderStatus(spanId, tipo, texto) {
    const el = Utils.$el(spanId);
    if (!el) return;
    const clases = {
      ok:      'badge badge--success',
      warning: 'badge badge--warning',
      error:   'badge badge--danger',
      info:    'badge badge--info',
      neutral: 'badge badge--neutral'
    };
    el.className = clases[tipo] || clases.neutral;
    el.textContent = texto;
  },

  /** Limpia el badge de status */
  clearStatus(spanId) {
    const el = Utils.$el(spanId);
    if (!el) return;
    el.className = 'section-card__status';
    el.textContent = '';
  },

  /**
   * Muestra un toast no bloqueante
   * @param {string} mensaje
   * @param {'success'|'warning'|'danger'|'info'} tipo
   * @param {number} duracion ms
   */
  toast(mensaje, tipo = 'info', duracion) {
    const cfg      = Config.get('ui') || {};
    const ms       = duracion || cfg.toastDuracionMs || 3000;
    const container = Utils.$el('toast-container');
    if (!container) return;

    const iconos = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
      warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      danger:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
    };

    const div = document.createElement('div');
    div.className = `toast toast--${tipo}`;
    div.innerHTML = `${iconos[tipo] || iconos.info}<span>${mensaje}</span>`;
    container.appendChild(div);

    setTimeout(() => {
      div.addEventListener('animationend', () => div.remove(), { once: true });
      // Si la animación CSS ya terminó, remover igualmente
      setTimeout(() => { if (div.parentNode) div.remove(); }, 400);
    }, ms);
  },

  /** Clona profundamente un objeto JSON-serializable */
  clonar(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  /** Escapa HTML para evitar XSS al insertar texto en innerHTML */
  escaparHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /** Detecta si el dispositivo es móvil */
  esMobil() {
    return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
  }
};


/* ───────────────────────────────────────────────────────────────
   CONFIG — Carga y acceso a los 4 JSON de configuración
   Estrategia: primero localStorage (override Admin), luego fetch
──────────────────────────────────────────────────────────────── */
const Config = (() => {

  const LS_KEY_PREFIX = 'fmhse022_config_';
  const BASE_PATH     = './config/';

  // Almacén interno una vez cargado
  let _data = {
    configuracion: null,
    peligros:      null,
    controles:     null,
    matriz:        null
  };

  /** Carga un JSON: primero override de localStorage, luego fetch */
  async function _cargarArchivo(nombre) {
    const lsKey = `${LS_KEY_PREFIX}${nombre}`;
    const override = localStorage.getItem(lsKey);
    if (override) {
      try {
        console.info(`[Config] Usando override Admin para: ${nombre}`);
        return JSON.parse(override);
      } catch (e) {
        console.warn(`[Config] Override inválido para ${nombre}, usando archivo base.`);
        localStorage.removeItem(lsKey);
      }
    }
    const resp = await fetch(`${BASE_PATH}${nombre}.json`);
    if (!resp.ok) throw new Error(`[Config] No se pudo cargar ${nombre}.json (${resp.status})`);
    return resp.json();
  }

  /** Carga todos los JSON en paralelo */
  async function cargarTodo() {
    const [configuracion, peligros, controles, matriz, tiposTrabajo] = await Promise.all([
      _cargarArchivo('configuracion'),
      _cargarArchivo('peligros'),
      _cargarArchivo('controles'),
      _cargarArchivo('matriz-peligro-control'),
      _cargarArchivo('tipos-trabajo')
    ]);
    _data.configuracion = configuracion;
    _data.peligros      = peligros;
    _data.controles     = controles;
    _data.matriz        = matriz;
    _data.tiposTrabajo  = tiposTrabajo;
    _validarCatalogoTiposTrabajo();
    console.info('[Config] Todos los archivos cargados correctamente.');
  }

  /**
   * Validación defensiva del catálogo de Tipos de Trabajo (Fase 1.2).
   * Genera advertencias de configuración SIN bloquear la aplicación:
   *   - IDs duplicados
   *   - peligroTT inexistente en peligros.json
   *   - campos obligatorios faltantes
   *   - órdenes duplicados
   */
  function _validarCatalogoTiposTrabajo() {
    try {
      const cat = _data.tiposTrabajo;
      if (!cat || !Array.isArray(cat.tiposTrabajo)) {
        console.warn('[Config] tipos-trabajo.json ausente o malformado: catálogo de Tipos de Trabajo no disponible.');
        return;
      }
      const lista = cat.tiposTrabajo;
      const OBLIGATORIOS = ['id', 'label', 'peligroTT', 'orden'];
      const idsVistos = new Set();
      const ordenesVistos = new Set();
      // Defensa adicional: si peligros.json está ausente o malformado, getPeligros()
      // podría no devolver un array; se degrada a conjunto vacío sin lanzar.
      const peligrosLista = getPeligros();
      const codigosPeligro = new Set(
        Array.isArray(peligrosLista) ? peligrosLista.map(p => p && p.codigo) : []
      );
      if (!Array.isArray(peligrosLista) || codigosPeligro.size === 0) {
        console.warn('[Config] peligros.json ausente o sin códigos: no se pudo verificar el mapeo peligroTT de los Tipos de Trabajo.');
      }

      lista.forEach((tt, i) => {
        if (!tt || typeof tt !== 'object') {
          console.warn(`[Config] Tipo de Trabajo en índice ${i}: entrada inválida (no es un objeto).`);
          return;
        }
        const ref = tt.id ? `'${tt.id}'` : `índice ${i}`;
        OBLIGATORIOS.forEach(campo => {
          if (tt[campo] === undefined || tt[campo] === null || tt[campo] === '') {
            console.warn(`[Config] Tipo de Trabajo ${ref}: falta el campo obligatorio '${campo}'.`);
          }
        });
        if (tt.id !== undefined) {
          if (idsVistos.has(tt.id)) {
            console.warn(`[Config] Tipo de Trabajo ${ref}: id duplicado '${tt.id}'.`);
          }
          idsVistos.add(tt.id);
        }
        // Solo se reporta peligroTT inexistente si hubo catálogo de peligros con el cual comparar.
        if (tt.peligroTT && codigosPeligro.size > 0 && !codigosPeligro.has(tt.peligroTT)) {
          console.warn(`[Config] Tipo de Trabajo ${ref}: peligroTT '${tt.peligroTT}' no existe en peligros.json.`);
        }
        if (tt.orden !== undefined && tt.orden !== null) {
          if (ordenesVistos.has(tt.orden)) {
            console.warn(`[Config] Tipo de Trabajo ${ref}: orden duplicado '${tt.orden}'.`);
          }
          ordenesVistos.add(tt.orden);
        }
      });
    } catch (e) {
      // La validación NUNCA debe interrumpir el arranque de la aplicación.
      console.warn('[Config] No se pudo validar el catálogo de Tipos de Trabajo:', e && e.message);
    }
  }

  /** Acceso a una clave de configuracion.json */
  function get(clave) {
    if (!_data.configuracion) return null;
    return _data.configuracion[clave] ?? null;
  }

  /** Listado plano de peligros {codigo, descripcion, categoria, criticidad} */
  function getPeligros() {
    if (!_data.peligros) return [];
    return _data.peligros.flatMap(cat =>
      (cat.peligros || []).map(p => ({ ...p }))
    );
  }

  /** Peligros agrupados por categoría tal como vienen del JSON */
  function getPeligrosPorCategoria() {
    return _data.peligros || [];
  }

  /** Lookup rápido de peligro por código */
  function getPeligro(codigo) {
    return getPeligros().find(p => p.codigo === codigo) || null;
  }

  /** Listado plano de controles */
  function getControles() {
    if (!_data.controles) return [];
    return _data.controles.flatMap(grp =>
      (grp.controles || []).map(c => ({ ...c }))
    );
  }

  /** Controles agrupados por grupo */
  function getControlesPorGrupo() {
    return _data.controles || [];
  }

  /** Lookup rápido de control por código */
  function getControl(codigo) {
    return getControles().find(c => c.codigo === codigo) || null;
  }

  /** Entrada de matriz para un peligro */
  function getMatriz(codigoPeligro) {
    if (!_data.matriz) return null;
    return _data.matriz[codigoPeligro] || null;
  }

  /** Guarda override en localStorage (usado por Admin en Fase 6) */
  function guardarOverride(nombre, datos) {
    localStorage.setItem(`${LS_KEY_PREFIX}${nombre}`, JSON.stringify(datos));
  }

  /** Elimina override y restaura archivo base */
  function eliminarOverride(nombre) {
    localStorage.removeItem(`${LS_KEY_PREFIX}${nombre}`);
  }

  /**
   * Catálogo de Tipos de Trabajo (Fase 1.2).
   * Devuelve la lista ordenada por 'orden'. Solo lectura.
   */
  function getTiposTrabajo() {
    if (!_data.tiposTrabajo || !Array.isArray(_data.tiposTrabajo.tiposTrabajo)) return [];
    return _data.tiposTrabajo.tiposTrabajo
      .slice()
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  }

  /**
   * Devuelve el Tipo de Trabajo cuyo peligroTT coincide con el código dado,
   * o null si ninguno mapea a ese peligro. (Fase 1.2)
   */
  function getTipoTrabajoPorPeligro(codigoPeligro) {
    if (!codigoPeligro) return null;
    return getTiposTrabajo().find(tt => tt.peligroTT === codigoPeligro) || null;
  }

  return {
    cargarTodo,
    get,
    getPeligros, getPeligrosPorCategoria, getPeligro,
    getControles, getControlesPorGrupo, getControl,
    getMatriz,
    getTiposTrabajo, getTipoTrabajoPorPeligro,
    guardarOverride, eliminarOverride
  };
})();


/* ───────────────────────────────────────────────────────────────
   STATE — AppState centralizado + persistencia localStorage
──────────────────────────────────────────────────────────────── */
const State = (() => {

  const LS_KEY_DRAFT = 'fmhse022_draft';
  const VERSION      = '2.1';

  /** Estructura canónica de un estado vacío */
  function _estadoVacio() {
    return {
      _meta: {
        version:       VERSION,
        app:           'FM-HSE-022',
        creadoEn:      new Date().toISOString(),
        modificadoEn:  new Date().toISOString()
      },
      general: {
        lugar: '',
        fecha: '',
        tarea: ''
      },
      responsables: [],
      puntoEncuentro: '',
      duchaLavaojos: '',
      tiposTrabajo: [],         // IDs de tipos-trabajo.json seleccionados globalmente (Fase 1.3)
      senalesParada: {
        seleccionadas: [],    // IDs de checkboxes marcados
        textos: {}            // { id: texto } para los "Otros"
      },
      pasos: [],
      aprobacion: {
        nombreSupervisor: '',
        observaciones:    '',
        estado:           null   // null | 'aprobado' | 'requiere_correccion'
      },
      identificacion: {
        areaEjecutora: '',
        consecutivo:   '',
        nombreArchivo: '',
        modoPDF:       'corporativo'
      }
    };
  }

  let _estado = _estadoVacio();
  let _listeners = {};   // { evento: [fn, ...] }

  /** Emite un evento interno al estado */
  function _emit(evento, payload) {
    (_listeners[evento] || []).forEach(fn => {
      try { fn(payload); } catch (e) { console.error(`[State] Error en listener '${evento}':`, e); }
    });
    // Siempre emitir 'change' para autosave
    if (evento !== 'change') {
      (_listeners['change'] || []).forEach(fn => {
        try { fn({ evento, payload }); } catch (e) { console.error('[State] Error en listener change:', e); }
      });
    }
  }

  /** Suscribe un listener a un evento del estado */
  function on(evento, fn) {
    if (!_listeners[evento]) _listeners[evento] = [];
    _listeners[evento].push(fn);
  }

  /** Lee una clave del estado (soporta dot-notation: 'general.lugar') */
  function get(clave) {
    if (!clave) return Utils.clonar(_estado);
    const partes = clave.split('.');
    let cur = _estado;
    for (const p of partes) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = cur[p];
    }
    return cur != null ? Utils.clonar(cur) : cur;
  }

  /** Actualiza una clave del estado y emite el evento correspondiente */
  function set(clave, valor, evento = 'update') {
    const partes = clave.split('.');
    let cur = _estado;
    for (let i = 0; i < partes.length - 1; i++) {
      if (cur[partes[i]] == null) cur[partes[i]] = {};
      cur = cur[partes[i]];
    }
    cur[partes[partes.length - 1]] = valor;
    _estado._meta.modificadoEn = new Date().toISOString();
    _emit(evento, { clave, valor });
  }

  /**
   * Normalización defensiva del estado (Fase 1.3).
   * Garantiza que todo estado que entre a la aplicación (borrador de localStorage,
   * importación de Backup o cualquier reemplazo) tenga la forma canónica mínima,
   * añadiendo campos nuevos ausentes SIN alterar los datos existentes.
   * Punto único de normalización: cualquier vía de carga debe pasar por aquí.
   * No muta el objeto recibido; devuelve una copia normalizada.
   */
  function _normalizarEstado(estado) {
    if (!estado || typeof estado !== 'object') return _estadoVacio();
    const norm = estado;
    // Campo nuevo de Fase 1.3: tiposTrabajo[] a nivel global.
    if (!Array.isArray(norm.tiposTrabajo)) {
      norm.tiposTrabajo = [];
    }
    // El esquema de pasos se mantiene intacto: no se toca norm.pasos.
    return norm;
  }

  /** Reemplaza el estado completo (usado en importación y restauración de borrador) */
  function reemplazar(nuevoEstado) {
    _estado = _normalizarEstado(nuevoEstado);
    _estado._meta.modificadoEn = new Date().toISOString();
    _emit('reset', null);
  }

  /** Resetea al estado vacío */
  function resetear() {
    _estado = _estadoVacio();
    _emit('reset', null);
  }

  // ── Persistencia localStorage ──────────────────────────────

  /** Guarda el estado actual en localStorage */
  function guardarBorrador() {
    try {
      localStorage.setItem(LS_KEY_DRAFT, JSON.stringify(_estado));
    } catch (e) {
      // Etapa 2A — Robustez defensiva de almacenamiento (aditiva, sin cambiar
      // el modelo de datos ni las claves). Distingue cuota excedida para avisar
      // al usuario en lugar de fallar silenciosamente; recomienda exportar.
      const esCuota = e && (e.name === 'QuotaExceededError' ||
                            e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
                            e.code === 22 || e.code === 1014);
      if (esCuota) {
        console.warn('[State] Cuota de almacenamiento excedida; el borrador no se guardó.');
        try {
          Utils.toast('No se pudo guardar el borrador (almacenamiento lleno). Exporta un respaldo JSON.', 'danger');
        } catch (_) { /* Utils/toast no disponible: degradación silenciosa segura */ }
      } else {
        console.warn('[State] No se pudo guardar en localStorage:', e.message);
      }
    }
  }

  /** Lee el borrador de localStorage; retorna null si no existe o es inválido */
  function leerBorrador() {
    try {
      const raw = localStorage.getItem(LS_KEY_DRAFT);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?._meta?.app !== 'FM-HSE-022') return null;
      return _normalizarEstado(parsed);
    } catch {
      return null;
    }
  }

  /** Elimina el borrador de localStorage */
  function descartarBorrador() {
    localStorage.removeItem(LS_KEY_DRAFT);
  }

  /** Indica si existe un borrador guardado */
  function tieneBorrador() {
    return leerBorrador() !== null;
  }

  return {
    get, set, reemplazar, resetear,
    guardarBorrador, leerBorrador, descartarBorrador, tieneBorrador,
    on,
    _estadoVacio   // expuesto para Backup
  };
})();


/* ───────────────────────────────────────────────────────────────
   MODAL — Diálogo de confirmación genérico reutilizable
──────────────────────────────────────────────────────────────── */
const Modal = (() => {

  let _resolverPromesa = null;

  function _bindOnce() {
    const overlay  = Utils.$el('modal-confirm');
    const btnOk    = Utils.$el('btn-confirm-ok');
    const btnCancel= Utils.$el('btn-confirm-cancel');

    const cerrar = (resultado) => {
      overlay.classList.add('hidden');
      if (_resolverPromesa) {
        _resolverPromesa(resultado);
        _resolverPromesa = null;
      }
    };

    btnOk.addEventListener('click',     () => cerrar(true));
    btnCancel.addEventListener('click', () => cerrar(false));
    overlay.addEventListener('click', e => {
      if (e.target === overlay) cerrar(false);
    });
  }

  /**
   * Muestra el modal de confirmación
   * @returns {Promise<boolean>} true si el usuario confirmó
   */
  function confirmar(titulo, mensaje, { labelOk = 'Confirmar', peligroso = true } = {}) {
    Utils.$el('modal-confirm-title').textContent   = titulo;
    Utils.$el('modal-confirm-message').textContent = mensaje;

    const btnOk = Utils.$el('btn-confirm-ok');
    btnOk.textContent = labelOk;
    btnOk.className   = peligroso
      ? 'btn-primary btn-primary--danger'
      : 'btn-primary';

    Utils.$el('modal-confirm').classList.remove('hidden');

    return new Promise(resolve => { _resolverPromesa = resolve; });
  }

  return { _bindOnce, confirmar };
})();


/* ───────────────────────────────────────────────────────────────
   BACKUP — Exportación e importación del formulario completo
──────────────────────────────────────────────────────────────── */
const Backup = (() => {

  /** Exporta el AppState como archivo JSON descargable */
  function exportar() {
    const estado    = State.get();
    const area      = estado.identificacion.areaEjecutora || 'FORM';
    const consec    = estado.identificacion.consecutivo   || Utils.generarConsecutivo();
    const nombreBase = `${area}-${consec}`;

    const payload = {
      _meta: {
        version:     '2.1',
        app:         'FM-HSE-022',
        exportadoEn: new Date().toISOString(),
        dispositivo: navigator.userAgent.substring(0, 120)
      },
      state: estado
    };

    const blob = new Blob(
      [JSON.stringify(payload, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `${nombreBase}-backup.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    Utils.toast('Borrador exportado correctamente.', 'success');
  }

  /**
   * Importa un archivo JSON y reconstruye el formulario
   * @param {File} archivo
   */
  async function importar(archivo) {
    if (!archivo) return;

    let payload;
    try {
      const texto = await archivo.text();
      payload = JSON.parse(texto);
    } catch {
      Utils.toast('El archivo no es un JSON válido.', 'danger');
      return;
    }

    // Validar firma del archivo
    if (payload?._meta?.app !== 'FM-HSE-022') {
      Utils.toast('El archivo no corresponde a un formulario FM-HSE-022.', 'danger');
      return;
    }

    // Validar que tenga estado
    if (!payload?.state?._meta) {
      Utils.toast('El archivo de respaldo está incompleto o corrupto.', 'danger');
      return;
    }

    // Confirmar si el formulario actual tiene datos
    const estadoActual = State.get();
    const tieneData    = estadoActual.general.tarea ||
                         estadoActual.responsables.length > 0 ||
                         estadoActual.pasos.length > 0;

    if (tieneData) {
      const ok = await Modal.confirmar(
        'Importar borrador',
        '¿Reemplazar el formulario actual con el borrador importado? Los datos no guardados se perderán.',
        { labelOk: 'Importar', peligroso: true }
      );
      if (!ok) return;
    }

    State.reemplazar(payload.state);
    State.guardarBorrador();

    const fecha = Utils.formatearFechaHora(payload._meta.exportadoEn);
    Utils.toast(`Formulario importado (exportado el ${fecha}).`, 'success');
  }

  return { exportar, importar };
})();


/* ───────────────────────────────────────────────────────────────
   UI.General — SF-01 Información General
──────────────────────────────────────────────────────────────── */
const UIGeneral = (() => {

  const BODY_ID   = 'body-general';
  const STATUS_ID = 'status-general';
  let _listenersBound = false;  // guard — SF C1

  function _html() {
    return `
      <div class="field-group">
        <div class="field">
          <label class="field__label field__label--required" for="inp-lugar">Lugar</label>
          <input
            type="text"
            id="inp-lugar"
            class="field__input"
            placeholder="Ej: Planta de Tratamiento — Área Sur"
            maxlength="200"
            autocomplete="off"
          >
        </div>
        <div class="field">
          <label class="field__label field__label--required" for="inp-fecha">Fecha</label>
          <input
            type="date"
            id="inp-fecha"
            class="field__input"
          >
        </div>
        <div class="field">
          <label class="field__label field__label--required" for="inp-tarea">Descripción de la Tarea</label>
          <textarea
            id="inp-tarea"
            class="field__textarea"
            placeholder="Describa la tarea a ejecutar de forma específica…"
            maxlength="500"
            rows="3"
          ></textarea>
          <p class="field__hint">
            Identificar continuamente los peligros generados por la tarea y tomar las medidas de control para prevenir accidentes.
          </p>
        </div>
      </div>`;
  }

  function _validar(datos) {
    const errores = [];
    if (!datos.lugar.trim())   errores.push('Lugar');
    if (!datos.fecha)           errores.push('Fecha');
    if (!datos.tarea.trim())   errores.push('Tarea');
    return errores;
  }

  function _actualizarStatus() {
    const datos  = State.get('general');
    const errores = _validar(datos);
    const subEl = document.getElementById('summary-general');
    if (errores.length === 0) {
      Utils.renderStatus(STATUS_ID, 'ok', '✓ Completo');
      if (subEl) {
        const lugarResumido = datos.lugar.length > 25 ? datos.lugar.substring(0, 22) + '…' : datos.lugar;
        subEl.textContent = `· ${lugarResumido} (${datos.fecha})`;
      }
    } else {
      Utils.renderStatus(STATUS_ID, 'warning', `⚠ ${errores.length} campo${errores.length > 1 ? 's' : ''} pendiente${errores.length > 1 ? 's' : ''}`);
      if (subEl) subEl.textContent = '';
    }
  }

  function _bindEventos() {
    if (_listenersBound) return;
    const body = Utils.$el(BODY_ID);
    if (!body) return;

    body.addEventListener('input', e => {
      const el = e.target;
      if (el.id === 'inp-lugar') {
        State.set('general.lugar', el.value);
        _actualizarStatus();
      } else if (el.id === 'inp-tarea') {
        State.set('general.tarea', el.value);
        _actualizarStatus();
      }
    });

    body.addEventListener('change', e => {
      const el = e.target;
      if (el.id === 'inp-fecha') {
        State.set('general.fecha', el.value);
        _actualizarStatus();
      }
    });

    _listenersBound = true;
  }



  function _poblarDesdeEstado() {
    const datos = State.get('general');
    const inpLugar = Utils.$el('inp-lugar');
    const inpFecha = Utils.$el('inp-fecha');
    const inpTarea = Utils.$el('inp-tarea');
    if (inpLugar) inpLugar.value = datos.lugar || '';
    if (inpFecha) inpFecha.value = datos.fecha || '';
    if (inpTarea) inpTarea.value = datos.tarea || '';
  }

  function render() {
    const body = Utils.$el(BODY_ID);
    if (!body) return;
    body.innerHTML = _html();
    _poblarDesdeEstado();
    _bindEventos();
    _actualizarStatus();
  }

  function validar() {
    return _validar(State.get('general'));
  }

  // Re-render al importar un borrador
  State.on('reset', render);

  return { render, validar };
})();


/* ───────────────────────────────────────────────────────────────
   UI.Responsables — SF-02 Responsables de la Tarea
──────────────────────────────────────────────────────────────── */
const UIResponsables = (() => {

  const BODY_ID   = 'body-responsables';
  const STATUS_ID = 'status-responsables';
  let _listenersBound = false;  // guard — SF C1

  function _htmlFila(resp) {
    const id = Utils.escaparHtml(resp.id);
    return `
      <tr data-resp-id="${id}">
        <td>
          <input
            type="text"
            class="table-input inp-resp-nombre"
            data-id="${id}"
            value="${Utils.escaparHtml(resp.nombre)}"
            placeholder="Nombre completo"
            maxlength="100"
            autocomplete="off"
            aria-label="Nombre del responsable"
          >
        </td>
        <td>
          <input
            type="text"
            class="table-input inp-resp-cedula"
            data-id="${id}"
            value="${Utils.escaparHtml(resp.cedula)}"
            placeholder="Número de cédula"
            maxlength="20"
            inputmode="numeric"
            autocomplete="off"
            aria-label="Cédula del responsable"
          >
        </td>
        <td class="td-action">
          <button
            type="button"
            class="btn-icon btn-icon--danger btn-eliminar-resp"
            data-id="${id}"
            title="Eliminar responsable"
            aria-label="Eliminar responsable"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </td>
      </tr>`;
  }

  function _htmlTabla(responsables) {
    const filas = responsables.length > 0
      ? responsables.map(_htmlFila).join('')
      : `<tr class="tr-empty">
           <td colspan="3">
             <p class="text-muted" style="text-align:center;padding:1rem 0;">
               Sin responsables. Agregue al menos uno.
             </p>
           </td>
         </tr>`;

    return `
      <table class="dynamic-table" id="tabla-responsables">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Cédula</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="tbody-responsables">
          ${filas}
        </tbody>
      </table>
      <button type="button" class="btn-add" id="btn-agregar-resp" style="margin-top:0.75rem;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Agregar Responsable
      </button>`;
  }

  function _actualizarStatus() {
    const cfg      = Config.get('validaciones') || {};
    const minimo   = cfg.minimoResponsables || 1;
    const lista    = State.get('responsables') || [];
    const completos = lista.filter(r => r.nombre.trim() && r.cedula.trim()).length;
    const subEl = document.getElementById('summary-responsables');

    if (completos >= minimo) {
      Utils.renderStatus(STATUS_ID, 'ok', `✓ ${lista.length} responsable${lista.length > 1 ? 's' : ''}`);
      if (subEl) {
        subEl.textContent = `· ${lista.length} operario${lista.length > 1 ? 's' : ''}`;
      }
    } else {
      const falta = minimo - completos;
      Utils.renderStatus(STATUS_ID, 'warning', `⚠ Mínimo ${minimo} requerido${minimo > 1 ? 's' : ''}`);
      if (subEl) subEl.textContent = '';
    }
  }

  function _agregarResponsable() {
    const lista = State.get('responsables') || [];
    lista.push({ id: Utils.uuid(), nombre: '', cedula: '' });
    State.set('responsables', lista, 'responsables:update');
    _renderTabla();
    // Enfocar el primer campo de la nueva fila
    const inputs = document.querySelectorAll('.inp-resp-nombre');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }

  async function _eliminarResponsable(id) {
    const lista = State.get('responsables') || [];
    const resp  = lista.find(r => r.id === id);
    if (!resp) return;

    if (resp.nombre.trim() || resp.cedula.trim()) {
      const ok = await Modal.confirmar(
        'Eliminar responsable',
        `¿Eliminar a "${resp.nombre || 'sin nombre'}"?`,
        { labelOk: 'Eliminar', peligroso: true }
      );
      if (!ok) return;
    }

    const nueva = lista.filter(r => r.id !== id);
    State.set('responsables', nueva, 'responsables:update');
    _renderTabla();
  }

  function _actualizarCampo(id, campo, valor) {
    const lista = State.get('responsables') || [];
    const idx   = lista.findIndex(r => r.id === id);
    if (idx === -1) return;
    lista[idx][campo] = valor;
    State.set('responsables', lista, 'responsables:update');
    _actualizarStatus();
  }

  function _bindEventosTabla() {
    if (_listenersBound) return;
    const body = Utils.$el(BODY_ID);
    if (!body) return;

    // Botón agregar — generado en innerHTML, se recrea; listener va sobre body (fijo)
    body.addEventListener('click', e => {
      const btn = e.target.closest('#btn-agregar-resp');
      if (btn) _agregarResponsable();
    });

    // Delegación para inputs y botones eliminar
    body.addEventListener('input', e => {
      const el = e.target;
      if (el.classList.contains('inp-resp-nombre')) {
        _actualizarCampo(el.dataset.id, 'nombre', el.value);
      }
      if (el.classList.contains('inp-resp-cedula')) {
        _actualizarCampo(el.dataset.id, 'cedula', el.value);
      }
    });

    body.addEventListener('click', e => {
      const btn = e.target.closest('.btn-eliminar-resp');
      if (btn) _eliminarResponsable(btn.dataset.id);
    });

    _listenersBound = true;
  }

  function _renderTabla() {
    const body = Utils.$el(BODY_ID);
    if (!body) return;
    const responsables = State.get('responsables') || [];
    body.innerHTML = _htmlTabla(responsables);
    _bindEventosTabla();
    _actualizarStatus();
  }

  function render() {
    _renderTabla();
  }

  function validar() {
    const cfg    = Config.get('validaciones') || {};
    const minimo = cfg.minimoResponsables || 1;
    const lista  = State.get('responsables') || [];
    return lista.filter(r => r.nombre.trim() && r.cedula.trim()).length >= minimo;
  }

  State.on('reset', render);

  return { render, validar };
})();


/* ───────────────────────────────────────────────────────────────
   UI.Ubicacion — SF-03 Punto de Encuentro + SF-04 Ducha y Lavaojos
──────────────────────────────────────────────────────────────── */
const UIUbicacion = (() => {

  function _htmlSelect(id, opciones, valorActual, labelVacio) {
    const opts = opciones.map(op =>
      `<option value="${Utils.escaparHtml(op)}" ${op === valorActual ? 'selected' : ''}>${Utils.escaparHtml(op)}</option>`
    ).join('');
    return `
      <select id="${id}" class="field__select" aria-required="true">
        <option value="">${Utils.escaparHtml(labelVacio)}</option>
        ${opts}
      </select>`;
  }

  function _renderSeccion(bodyId, selectId, statusId, stateKey, labelTexto, opciones, valorActual) {
    const body = Utils.$el(bodyId);
    if (!body) return;

    body.innerHTML = `
      <div class="field">
        <label class="field__label field__label--required" for="${selectId}">${Utils.escaparHtml(labelTexto)}</label>
        ${_htmlSelect(selectId, opciones, valorActual, `Seleccione ${labelTexto.toLowerCase()}…`)}
      </div>`;

    const select = Utils.$el(selectId);
    if (select) {
      select.addEventListener('change', () => {
        State.set(stateKey, select.value);
        _actualizarStatus(statusId, select.value, labelTexto);
      });
    }
    _actualizarStatus(statusId, valorActual, labelTexto);
  }

  function _actualizarStatus(statusId, valor, label) {
    const sectionName = statusId.replace('status-', '');
    const subEl = document.getElementById(`summary-${sectionName}`);

    if (valor && valor.trim()) {
      Utils.renderStatus(statusId, 'ok', `✓ ${Utils.escaparHtml(valor)}`);
      if (subEl) {
        subEl.textContent = `· ${Utils.escaparHtml(valor)}`;
      }
    } else {
      Utils.renderStatus(statusId, 'warning', `⚠ Sin seleccionar`);
      if (subEl) subEl.textContent = '';
    }
  }

  function renderEncuentro() {
    const opciones = Config.get('puntosEncuentro') || [];
    const actual   = State.get('puntoEncuentro') || '';
    _renderSeccion(
      'body-encuentro', 'sel-encuentro', 'status-encuentro',
      'puntoEncuentro', 'Punto de Encuentro Cercano', opciones, actual
    );
  }

  function renderDucha() {
    const opciones = Config.get('duchasLavaojos') || [];
    const actual   = State.get('duchaLavaojos') || '';
    _renderSeccion(
      'body-ducha', 'sel-ducha', 'status-ducha',
      'duchaLavaojos', 'Ducha y Lavaojos Cercano', opciones, actual
    );
  }

  function render() {
    renderEncuentro();
    renderDucha();
  }

  function validar() {
    return !!(State.get('puntoEncuentro') && State.get('duchaLavaojos'));
  }

  State.on('reset', render);

  return { render, validar };
})();


/* ───────────────────────────────────────────────────────────────
   UI.Senales — SF-05 Señales para Detener la Tarea
──────────────────────────────────────────────────────────────── */
const UISenales = (() => {

  const BODY_ID   = 'body-senales';
  const STATUS_ID = 'status-senales';
  let _listenersBound = false;  // guard — SF C1

  function _htmlItem(senal, seleccionadas, textos) {
    const id   = Utils.escaparHtml(senal.id);
    const checked = seleccionadas.includes(senal.id);

    if (senal.tipo === 'checkbox') {
      return `
        <label class="checkbox-item ${checked ? '' : ''}" for="senal-${id}">
          <input
            type="checkbox"
            id="senal-${id}"
            class="senal-check"
            data-senal-id="${id}"
            ${checked ? 'checked' : ''}
          >
          <span class="checkbox-item__label">${Utils.escaparHtml(senal.texto)}</span>
        </label>`;
    }

    // tipo === 'texto' (Otros con campo libre)
    const textoActual = textos[senal.id] || '';
    return `
      <div class="senal-otros-item ${textoActual.trim() ? 'senal-activa' : ''}">
        <label class="checkbox-item" for="senal-${id}">
          <input
            type="checkbox"
            id="senal-${id}"
            class="senal-check"
            data-senal-id="${id}"
            ${checked ? 'checked' : ''}
          >
          <span class="checkbox-item__label">${Utils.escaparHtml(senal.texto)}:</span>
        </label>
        <input
          type="text"
          id="senal-texto-${id}"
          class="field__input senal-texto"
          data-senal-id="${id}"
          value="${Utils.escaparHtml(textoActual)}"
          placeholder="${Utils.escaparHtml(senal.placeholder || 'Especifique…')}"
          maxlength="100"
          autocomplete="off"
          style="margin-top:0.25rem;"
          ${!checked ? 'disabled' : ''}
          aria-label="${Utils.escaparHtml(senal.texto)}"
        >
      </div>`;
  }

  function _htmlSeccion(senales, seleccionadas, textos, minimoRequerido) {
    const items = senales.map(s => _htmlItem(s, seleccionadas, textos)).join('');
    return `
      <p class="field__hint" style="margin-bottom:0.75rem;">
        Escoja <strong>${minimoRequerido} o más</strong> situaciones que podrían ocurrir o que le hayan ocurrido.
      </p>
      <div class="checkbox-grid" id="grid-senales">
        ${items}
      </div>`;
  }

  function _actualizarStatus() {
    const cfg         = Config.get('validaciones') || {};
    const minimo      = cfg.minimoSenalesParada || 2;
    const estado      = State.get('senalesParada');
    const totalMarcadas = (estado.seleccionadas || []).length;

    if (totalMarcadas >= minimo) {
      Utils.renderStatus(STATUS_ID, 'ok', `✓ ${totalMarcadas} seleccionada${totalMarcadas > 1 ? 's' : ''}`);
    } else {
      const falta = minimo - totalMarcadas;
      Utils.renderStatus(STATUS_ID, 'warning', `⚠ Seleccione ${falta} más`);
    }
  }

  function _bindEventos() {
    if (_listenersBound) return;
    const body = Utils.$el(BODY_ID);
    if (!body) return;

    // Delegación: checkboxes de señales
    body.addEventListener('change', e => {
      const el = e.target;

      if (el.classList.contains('senal-check')) {
        const senalId = el.dataset.senalId;
        const estado  = State.get('senalesParada');
        let seleccionadas = [...(estado.seleccionadas || [])];

        if (el.checked) {
          if (!seleccionadas.includes(senalId)) seleccionadas.push(senalId);
          // Habilitar campo de texto si es tipo 'otros'
          const inputTexto = Utils.$el(`senal-texto-${senalId}`);
          if (inputTexto) {
            inputTexto.disabled = false;
            inputTexto.focus();
          }
        } else {
          seleccionadas = seleccionadas.filter(id => id !== senalId);
          // Deshabilitar y limpiar campo de texto
          const inputTexto = Utils.$el(`senal-texto-${senalId}`);
          if (inputTexto) {
            inputTexto.disabled = true;
            inputTexto.value    = '';
            // Limpiar texto del estado
            const textos = State.get('senalesParada.textos') || {};
            delete textos[senalId];
            State.set('senalesParada.textos', textos);
          }
        }

        State.set('senalesParada.seleccionadas', seleccionadas);
        _actualizarStatus();
      }
    });

    // Delegación: campos de texto "Otros"
    body.addEventListener('input', e => {
      const el = e.target;
      if (el.classList.contains('senal-texto')) {
        const senalId = el.dataset.senalId;
        const textos  = State.get('senalesParada.textos') || {};
        textos[senalId] = el.value;
        State.set('senalesParada.textos', textos);
      }
    });

    _listenersBound = true;
  }

  function render() {
    const body = Utils.$el(BODY_ID);
    if (!body) return;

    const senales       = Config.get('senalesParada') || [];
    const estado        = State.get('senalesParada');
    const seleccionadas = estado.seleccionadas || [];
    const textos        = estado.textos || {};
    const cfg           = Config.get('validaciones') || {};
    const minimo        = cfg.minimoSenalesParada || 2;

    body.innerHTML = _htmlSeccion(senales, seleccionadas, textos, minimo);
    _bindEventos();
    _actualizarStatus();
  }

  function validar() {
    const cfg    = Config.get('validaciones') || {};
    const minimo = cfg.minimoSenalesParada || 2;
    const estado = State.get('senalesParada');
    return (estado.seleccionadas || []).length >= minimo;
  }

  State.on('reset', render);

  return { render, validar };
})();


/* ───────────────────────────────────────────────────────────────
   UI.Completitud — SF-17 Indicador de estado por paso
   Evalúa en tiempo real y retorna { estado, texto, clase }
   Preparada para recibir validaciones de peligros y controles
   en Fase 3B sin modificar su interfaz pública.
──────────────────────────────────────────────────────────────── */
const UICompletitud = (() => {

  /**
   * Evalúa el estado de completitud de un paso.
   * Criterios activos desde Fase 3B:
   *   - Descripción: texto no vacío
   *   - Peligros:    al menos 1 código en paso.peligros
   *   - Controles:   al menos 1 código activo en paso.controles
   *                  (un control con eliminadoPorUsuario:true con justificación
   *                   cuenta como "atendido" — no bloquea la completitud)
   *
   * @param {Object} paso  Objeto paso del AppState
   * @returns {{ estado: string, texto: string, clase: string, icono: string }}
   */
  function evaluar(paso) {
    const tieneDescripcion = !!(paso.descripcion && paso.descripcion.trim());
    const tienePeligros    = Array.isArray(paso.peligros)  && paso.peligros.length > 0;

    const controlesActivos = Array.isArray(paso.controles) ? paso.controles : [];
    const justificaciones  = Array.isArray(paso.justificaciones) ? paso.justificaciones : [];

    // Fase 1.5 — Exigibilidad real basada en Matrix.
    // Un control obligatorio derivado de los peligros del paso se considera
    // "atendido" si está seleccionado (en paso.controles) o si tiene una
    // justificación de omisión registrada. Un obligatorio ni seleccionado ni
    // justificado es un FALTANTE que bloquea la completitud.
    const peligros = Array.isArray(paso.peligros) ? paso.peligros : [];
    const sugerencias = peligros.length > 0
      ? Matrix.calcular(peligros)
      : { obligatorios: new Set(), recomendados: new Set() };
    const obligatorios = Array.from(sugerencias.obligatorios || []);
    const estaSeleccionado = cod => controlesActivos.includes(cod);
    const estaJustificado  = cod => justificaciones.some(
      j => j.control === cod && j.eliminadoPorUsuario && j.justificacion
    );
    const obligatoriosFaltantes = obligatorios.filter(
      cod => !estaSeleccionado(cod) && !estaJustificado(cod)
    );
    // Si el paso tiene peligros con obligatorios, la cobertura de esos obligatorios
    // es el criterio. Si no hay obligatorios, se conserva el criterio previo
    // (al menos un control o una justificación) para no exigir de más.
    const tieneControles = obligatorios.length > 0
      ? obligatoriosFaltantes.length === 0
      : (controlesActivos.length > 0 || justificaciones.length > 0);

    const fallas = [];
    if (!tieneDescripcion) fallas.push('descripción');
    if (!tienePeligros)    fallas.push('peligros');
    if (!tieneControles)   fallas.push('controles');

    if (fallas.length === 0) {
      return { estado: 'completo',   texto: '✓ Completo',           clase: 'step-completitud--complete', icono: '✓' };
    }
    if (fallas.length === 1) {
      const mapa = {
        'descripción': '⚠ Sin descripción',
        'peligros':    '⚠ Sin peligros',
        'controles':   '⚠ Sin controles'
      };
      return { estado: 'pendiente',  texto: mapa[fallas[0]],        clase: 'step-completitud--pending',  icono: '⚠' };
    }
    return   { estado: 'incompleto', texto: `⚠ Pendiente (${fallas.length})`, clase: 'step-completitud--error', icono: '⚠' };
  }

  /** Resumen global para el encabezado de la sección */
  function resumenGlobal() {
    const pasos = State.get('pasos') || [];
    let completos = 0, pendientes = 0;
    pasos.forEach(p => { evaluar(p).estado === 'completo' ? completos++ : pendientes++; });
    return { completos, pendientes, total: pasos.length };
  }

  return { evaluar, resumenGlobal };
})();


/* ───────────────────────────────────────────────────────────────
   UITiposTrabajo — Fase 1.4
   Selección global múltiple de Tipos de Trabajo mediante chips.
   Fuente de datos: Config.getTiposTrabajo() (catálogo, ya ordenado)
                    State.get('tiposTrabajo') (selección persistida).
   Persiste exclusivamente en State.tiposTrabajo[] (IDs del catálogo).
   No crea estructuras de datos nuevas.
──────────────────────────────────────────────────────────────── */
/* ────────────────────────────────────────────────────────────────
   Coherencia — Fase 1.7 (RI-6: coherencia bidireccional TT global ↔ paso).
   Capa de CÁLCULO PURA (RI-8): sin DOM, sin efectos secundarios, sin
   mutación. Deriva D y U y devuelve un objeto de resultado. NO persiste
   nada (RI-7): D y U se recalculan en cada evaluación y NO se almacenan.

   D = conjunto de IDs declarados globalmente (State.tiposTrabajo[]).
   U = conjunto de IDs de Tipos de Trabajo realmente usados en los pasos,
       obtenidos EXCLUSIVAMENTE mediante Config.getTipoTrabajoPorPeligro()
       sobre cada código de paso.peligros[].

   IMPORTANTE (observación de auditoría): los peligros TT37 (Estática),
   TT38 (Herramientas eléctricas) y TT39 (Baja/media tensión) tienen
   prefijo "TT" pero NO pertenecen al catálogo de Tipos de Trabajo
   (solo TT32-TT36 lo hacen). La derivación de U usa el catálogo, nunca
   el prefijo: getTipoTrabajoPorPeligro devuelve null para TT37/38/39, que
   por tanto se ignoran correctamente. Prohibido identificar TT por prefijo.

   Coherencia: D = U  ⇔  (U ⊆ D) ∧ (D ⊆ U).
   ──────────────────────────────────────────────────────────────── */
const Coherencia = (() => {

  // Deriva D: IDs de TT declarados globalmente (lectura de State).
  function _declarados() {
    const ids = State.get('tiposTrabajo') || [];
    return new Set(Array.isArray(ids) ? ids : []);
  }

  // Deriva U: IDs de TT usados en los pasos, vía catálogo (nunca por prefijo).
  function _usados() {
    const usados = new Set();
    const pasos  = State.get('pasos') || [];
    pasos.forEach(paso => {
      const peligros = Array.isArray(paso.peligros) ? paso.peligros : [];
      peligros.forEach(codigo => {
        // getTipoTrabajoPorPeligro devuelve el TT del catálogo o null.
        // TT37/38/39 (no catalogados) devuelven null → se ignoran.
        const tt = Config.getTipoTrabajoPorPeligro(codigo);
        if (tt && tt.id) usados.add(tt.id);
      });
    });
    return usados;
  }

  // Evaluación pura de coherencia. Devuelve un objeto efímero (no persistido).
  function evaluar() {
    const D = _declarados();
    const U = _usados();
    const usadosSinDeclarar  = [...U].filter(id => !D.has(id)); // viola Regla 1 (U ⊆ D)
    const declaradosSinUsar  = [...D].filter(id => !U.has(id)); // viola Regla 2 (D ⊆ U)
    return {
      coherente:          usadosSinDeclarar.length === 0 && declaradosSinUsar.length === 0,
      usadosSinDeclarar,
      declaradosSinUsar
    };
  }

  return { evaluar };
})();

/* ────────────────────────────────────────────────────────────────
   AuditoriaConsolidada — Fase 1.8 (supervisión consolidada de Etapa 1).
   Capa de CÁLCULO PURA (RI-8): sin DOM, sin render, sin State.set, sin
   side effects. NO persiste su resultado (RI-7/RI-9): deriva en cada
   llamada de las fuentes existentes y NO almacena.

   NO reimplementa cálculos base (RI-10): consume
     - UICompletitud.resumenGlobal()  → dimensión global de completitud
     - Coherencia.evaluar()           → dimensión de coherencia D=U
     - UITiposTrabajo.validar()       → ≥1 TT declarado
     - Matrix / Config.getMatriz()    → obligatorios por unidad (fuente única)

   RA-1.8 (atribución): los obligatorios de una unidad TT se obtienen
   EXCLUSIVAMENTE de Config.getMatriz(peligroTT). Nunca por prefijo, ni
   por nombre, ni por criticidad.

   Caso de borde TT37/TT38/TT39: no pertenecen al catálogo de Tipos de
   Trabajo. La identificación de unidades parte del catálogo
   (Config.getTiposTrabajo), por lo que esos códigos nunca son unidades.
   En la detección de presencia se usa Config.getTipoTrabajoPorPeligro,
   que devuelve null para ellos → se ignoran (igual que en Fase 1.7).

   Criterio canónico de estado de control (deuda técnica aceptada,
   Addendum 1.8): aplicado idéntico al de UICompletitud y _htmlItem.
     seleccionado = paso.controles.includes(codigo)
     justificado  = ∃ j ∈ paso.justificaciones :
                      j.control === codigo ∧ j.eliminadoPorUsuario ∧ j.justificacion
     faltante     = obligatorio ∧ ¬seleccionado ∧ ¬justificado
   ──────────────────────────────────────────────────────────────── */
const AuditoriaConsolidada = (() => {

  // Criterio canónico — estado de un control en un paso (solo lectura).
  function _estaSeleccionado(paso, codigo) {
    return Array.isArray(paso.controles) && paso.controles.includes(codigo);
  }
  function _estaJustificado(paso, codigo) {
    return Array.isArray(paso.justificaciones) && paso.justificaciones.some(
      j => j && j.control === codigo && j.eliminadoPorUsuario && j.justificacion
    );
  }

  // auditarUnidad(peligroTT) — GENÉRICA, parametrizada por la unidad
  // (código de peligro TT del catálogo). No acoplada a ningún TT fijo.
  // Consolida el estado de los obligatorios de la unidad a través de los
  // pasos donde aparece, conservando la distribución por paso. RA-1.8: los
  // obligatorios salen de Config.getMatriz(peligroTT), no de agregación.
  function auditarUnidad(peligroTT) {
    if (!peligroTT) return null;
    const entrada      = Config.getMatriz(peligroTT);
    const obligatorios = (entrada && Array.isArray(entrada.obligatorios))
      ? entrada.obligatorios.slice()
      : [];
    const pasos = State.get('pasos') || [];
    const porPaso = []; // distribución observacional por paso
    pasos.forEach((paso, idx) => {
      const peligros = Array.isArray(paso.peligros) ? paso.peligros : [];
      if (!peligros.includes(peligroTT)) return; // la unidad no aparece en este paso
      const seleccionados = [];
      const justificados  = [];
      const faltantes     = [];
      obligatorios.forEach(cod => {
        if (_estaSeleccionado(paso, cod))      seleccionados.push(cod);
        else if (_estaJustificado(paso, cod))  justificados.push(cod);
        else                                   faltantes.push(cod); // obligatorio ∧ ¬sel ∧ ¬just
      });
      porPaso.push({ pasoIndex: idx, seleccionados, justificados, faltantes });
    });
    // Consolidación: un obligatorio está cubierto si en TODOS los pasos donde
    // la unidad aparece está seleccionado o justificado. Derivado, no autoritativo.
    const totalFaltantes = porPaso.reduce((n, p) => n + p.faltantes.length, 0);
    return {
      peligroTT,
      obligatorios,
      pasosConUnidad: porPaso.length,
      porPaso,
      completa: porPaso.length > 0 && totalFaltantes === 0,
      sinUso:   porPaso.length === 0
    };
  }

  // evaluarGlobal() — consolidación de supervisión. Combina las dimensiones
  // existentes SIN recalcularlas. Informativa: no bloquea, sin porcentajes
  // como criterio de aprobación, criterio humano final.
  function evaluarGlobal() {
    const completitud = UICompletitud.resumenGlobal();           // {completos, pendientes, total}
    const coherencia  = Coherencia.evaluar();                    // {coherente, ...}
    const ttValido    = UITiposTrabajo.validar();                // ≥1 TT declarado

    // Auditoría por unidad: solo TT declarados globalmente, mapeando id→peligroTT
    // vía catálogo (RA-1.8 / caso TT37-39: solo catalogados son unidades).
    const declarados  = State.get('tiposTrabajo') || [];
    const catalogo    = Config.getTiposTrabajo() || [];
    const porId       = new Map(catalogo.map(tt => [tt.id, tt.peligroTT]));
    const unidades    = declarados
      .map(id => porId.get(id))
      .filter(peligroTT => !!peligroTT)        // ignora ids sin mapeo
      .map(peligroTT => auditarUnidad(peligroTT));

    return {
      completitud,
      coherencia,
      ttValido,
      unidades   // detalle por TT declarado; informativo
    };
  }

  return { auditarUnidad, evaluarGlobal };
})();

const UITiposTrabajo = (() => {

  const BODY_ID   = 'body-tipos-trabajo';
  const STATUS_ID = 'status-tipos-trabajo';
  let _listenersBound = false;  // guard — patrón UISenales

  // ── HTML de un chip ──────────────────────────────────────
  function _htmlChip(tt, seleccionado) {
    const id    = Utils.escaparHtml(tt.id);
    const label = Utils.escaparHtml(tt.label);
    const desc  = Utils.escaparHtml(tt.descripcion || '');
    const idCheckbox = `tt-${id}`;

    return `
      <label class="checkbox-item checkbox-list__item" for="${idCheckbox}" title="${desc}">
        <input
          type="checkbox"
          id="${idCheckbox}"
          class="tt-check"
          data-tt-id="${id}"
          ${seleccionado ? 'checked' : ''}
          aria-label="${label} - ${desc}"
        >
        <div style="flex:1;min-width:0;">
          <span class="checkbox-item__label" style="font-weight:600;">${label}</span>
          <p class="field__hint" style="margin-top:2px;font-size:var(--text-xs);color:var(--color-text-secondary);">${desc}</p>
        </div>
      </label>`;
  }

  // ── HTML del contenedor de chips ─────────────────────────
  function _htmlChips(catalogo, seleccionados) {
    if (!catalogo.length) {
      return '<p class="tt-empty">No hay Tipos de Trabajo configurados.</p>';
    }
    const chips = catalogo
      .map(tt => _htmlChip(tt, seleccionados.includes(tt.id)))
      .join('');
    return `<div class="tt-chips checkbox-list" id="tt-chips" role="group" `
         + `aria-label="Tipos de Trabajo">${chips}</div>`;
  }

  // ── Estado visual (Completo / Pendiente) ─────────────────
  function _actualizarStatus() {
    const ok = validar();
    const subEl = document.getElementById('summary-tipos-trabajo');
    const seleccionados = State.get('tiposTrabajo') || [];

    if (!ok) {
      Utils.renderStatus(STATUS_ID, 'warning', 'Pendiente');
      if (subEl) subEl.textContent = '';
      return;
    }

    if (subEl) {
      const catalogo = Config.getTiposTrabajo() || [];
      const labels = seleccionados.map(id => {
        const item = catalogo.find(t => t.id === id);
        return item ? item.label : id;
      });
      subEl.textContent = `· ${labels.join(', ')}`;
    }

    // Fase 1.7 — Presentación de coherencia bidireccional (RI-6).
    // Consume el resultado de la capa de cálculo pura (Coherencia.evaluar);
    // NO calcula aquí ni muta datos (RI-8). Reutiliza Utils.renderStatus
    // (contrato existente, sin contrato nuevo). El resultado es informativo:
    // señala incoherencias, no bloquea (decisión de diseño 6A).
    const coh = Coherencia.evaluar();
    if (coh.coherente) {
      Utils.renderStatus(STATUS_ID, 'ok', 'Completo');
    } else {
      Utils.renderStatus(STATUS_ID, 'warning', 'Revisar coherencia TT');
    }
  }

  // ── Toggle de selección de un TT ─────────────────────────
  function _toggle(ttId) {
    const seleccionados = (State.get('tiposTrabajo') || []).slice();
    const idx = seleccionados.indexOf(ttId);
    if (idx === -1) {
      seleccionados.push(ttId);
    } else {
      seleccionados.splice(idx, 1);
    }
    State.set('tiposTrabajo', seleccionados, 'tiposTrabajo:update');
    _render();
  }

  // ── Binding por delegación de eventos (listener único sobre
  //    el contenedor estable BODY_ID, patrón UISenales) ───────
  function _bindEventos() {
    if (_listenersBound) return;
    const body = Utils.$el(BODY_ID);
    if (!body) return;
    body.addEventListener('change', (e) => {
      const el = e.target;
      if (!el.classList.contains('tt-check')) return;
      _toggle(el.getAttribute('data-tt-id'));
    });
    _listenersBound = true;
  }

  // ── Render ───────────────────────────────────────────────
  function _render() {
    const body = Utils.$el(BODY_ID);
    if (!body) return;
    const catalogo      = Config.getTiposTrabajo();            // ya ordenado por 'orden'
    const seleccionados = State.get('tiposTrabajo') || [];
    body.innerHTML = _htmlChips(catalogo, seleccionados);
    _bindEventos();
    _actualizarStatus();
  }

  function render() {
    _render();
  }

  // ── Validación: ≥1 Tipo de Trabajo seleccionado ──────────
  function validar() {
    const seleccionados = State.get('tiposTrabajo') || [];
    return seleccionados.length > 0;
  }

  State.on('reset', render);
  // Fase 1.7 — La coherencia depende de los peligros de los pasos. Al cambiar
  // los pasos (p.ej. agregar/quitar un peligro TT), se re-evalua SOLO el
  // indicador de estado (presentacion), sin re-renderizar los chips ni mutar
  // datos. Si el panel aun no esta montado, _actualizarStatus degrada sin error.
  State.on('pasos:update', _actualizarStatus);

  return { render, validar };
})();


/* ───────────────────────────────────────────────────────────────
   UI.Pasos — SF-06 Motor de pasos
   Operaciones: agregar, editar, duplicar, eliminar, reordenar,
   expandir/colapsar. Integra UICompletitud para badges visuales.
──────────────────────────────────────────────────────────────── */
const UIPasos = (() => {

  // ── Iconos SVG reutilizables ─────────────────────────────

  const ICONS = {
    up:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`,
    down:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
    duplicate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    trash:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
    expand:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
    collapse:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`
  };

  // ── Estado local de expansión (no persiste — UI only) ────
  // Set de IDs de pasos actualmente expandidos
  const _expandidos = new Set();

  // ── Guard contra acumulación de listeners en nodos fijos ─
  // #steps-list y #btn-add-step son nodos permanentes del HTML.
  // _bindEventos solo registra listeners sobre ellos UNA vez por sesión,
  // independientemente de cuántas veces render() sea invocado.
  let _listenersBound = false;

  // ── Estructura de un paso nuevo ──────────────────────────

  /**
   * Crea un objeto paso con la estructura canónica completa.
   * @param {number} numero  Número visible del paso (1-based)
   * @returns {Object}
   */
  function _nuevoPaso(numero) {
    return {
      id:             Utils.uuid(),
      numero:         numero,
      descripcion:    '',
      peligros:       [],   // ['M14', 'M17', …]
      controles:      [],   // ['18', '30', …]
      justificaciones: []   // [{ control, eliminadoPorUsuario, justificacion }]
    };
  }

  // ── HTML de una tarjeta de paso ──────────────────────────

  function _htmlAcciones(paso, idx, total) {
    const esPrimero = idx === 0;
    const esUltimo  = idx === total - 1;
    const idEsc     = Utils.escaparHtml(paso.id);

    return `
      <div class="step-card__actions">
        <button type="button"
          class="step-action-btn"
          data-action="up" data-id="${idEsc}"
          title="Mover arriba"
          aria-label="Mover paso arriba"
          ${esPrimero ? 'disabled' : ''}>
          ${ICONS.up}
        </button>
        <button type="button"
          class="step-action-btn"
          data-action="down" data-id="${idEsc}"
          title="Mover abajo"
          aria-label="Mover paso abajo"
          ${esUltimo ? 'disabled' : ''}>
          ${ICONS.down}
        </button>
        <button type="button"
          class="step-action-btn step-action-btn--duplicate"
          data-action="duplicate" data-id="${idEsc}"
          title="Duplicar paso"
          aria-label="Duplicar paso">
          ${ICONS.duplicate}
        </button>
        <button type="button"
          class="step-action-btn step-action-btn--danger"
          data-action="delete" data-id="${idEsc}"
          title="Eliminar paso"
          aria-label="Eliminar paso">
          ${ICONS.trash}
        </button>
      </div>`;
  }

  function _htmlContadores(paso) {
    const np = paso.peligros.length;
    const nc = paso.controles.length;
    const claseP = np > 0 ? 'step-counter--has-data' : '';
    const claseC = nc > 0 ? 'step-counter--has-data' : '';
    return `
      <div class="step-card__counters">
        <span class="step-counter ${claseP}">
          ${np} peligro${np !== 1 ? 's' : ''}
        </span>
        <span class="step-counter" style="color:var(--color-text-muted);">|</span>
        <span class="step-counter ${claseC}">
          ${nc} control${nc !== 1 ? 'es' : ''}
        </span>
      </div>`;
  }

  function _htmlSubpanel(paso, tipo) {
    const esPeligros = tipo === 'peligros';
    const titulo     = esPeligros ? 'Peligros' : 'Controles';
    const count      = esPeligros ? paso.peligros.length : paso.controles.length;
    const idEsc      = Utils.escaparHtml(paso.id);

    return `
      <div class="step-subpanel" id="subpanel-${tipo}-${idEsc}">
        <div class="step-subpanel__header"
          data-subpanel="${tipo}" data-id="${idEsc}"
          role="button" tabindex="0"
          aria-expanded="false">
          <span class="step-subpanel__icon"></span>
          <span class="step-subpanel__title">${titulo}</span>
          <span class="step-subpanel__count" id="subpanel-count-${tipo}-${idEsc}">${count}</span>
        </div>
        <div class="step-subpanel__body" id="subpanel-body-${tipo}-${idEsc}">
          <!-- Renderizado bajo demanda por UIPeligros / UIControles -->
        </div>
      </div>`;
  }

  function _htmlPaso(paso, idx, total) {
    const idEsc      = Utils.escaparHtml(paso.id);
    const estaAbierto = _expandidos.has(paso.id);
    const completitud = UICompletitud.evaluar(paso);

    // Título resumido para mostrar en header colapsado
    const tituloDesc  = paso.descripcion.trim()
      ? Utils.escaparHtml(paso.descripcion.substring(0, 60) + (paso.descripcion.length > 60 ? '…' : ''))
      : null;

    return `
      <article
        class="step-card ${completitud.estado === 'completo' ? 'step-card--complete' : 'step-card--pending'} ${estaAbierto ? 'step-card--open' : ''}"
        id="step-card-${idEsc}"
        data-step-id="${idEsc}"
        role="listitem">

        <!-- CABECERA -->
        <div class="step-card__header"
          data-action="toggle" data-id="${idEsc}"
          role="button"
          tabindex="0"
          aria-expanded="${estaAbierto}"
          aria-controls="step-body-${idEsc}">

          <div class="step-card__number">${paso.numero}</div>

          <div class="step-card__meta">
            <div class="step-card__title ${tituloDesc ? '' : 'step-card__title--empty'}">
              ${tituloDesc || 'Sin descripción…'}
            </div>
            ${_htmlContadores(paso)}
          </div>

          <span class="step-completitud ${completitud.clase}" aria-label="${Utils.escaparHtml(completitud.texto)}">
            ${Utils.escaparHtml(completitud.texto)}
          </span>

          ${_htmlAcciones(paso, idx, total)}
        </div>

        <!-- CUERPO (colapsable) -->
        <div class="step-card__body" id="step-body-${idEsc}">

          <!-- Descripción del paso -->
          <div class="step-description">
            <label class="field__label field__label--required"
              for="step-desc-${idEsc}"
              style="margin-bottom:0.5rem;display:block;">
              Descripción del Paso
            </label>
            <textarea
              id="step-desc-${idEsc}"
              class="field__textarea step-desc-input"
              data-id="${idEsc}"
              placeholder="Describa la actividad específica de este paso…"
              maxlength="300"
              rows="2"
              aria-required="true"
            >${Utils.escaparHtml(paso.descripcion)}</textarea>
          </div>

          <!-- Subpaneles Peligros y Controles -->
          ${_htmlSubpanel(paso, 'peligros')}
          ${_htmlSubpanel(paso, 'controles')}

        </div>
      </article>`;
  }

  // ── Render de la lista completa ──────────────────────────

  function _htmlListaVacia() {
    return `
      <div class="empty-state" id="steps-empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/>
          <line x1="9" y1="12" x2="15" y2="12"/>
          <line x1="9" y1="16" x2="13" y2="16"/>
        </svg>
        <p class="empty-state__title">Sin pasos definidos</p>
        <p class="empty-state__desc">Agregue los pasos de la tarea usando el botón de abajo.</p>
      </div>`;
  }

  function _renderLista() {
    const lista  = Utils.$el('steps-list');
    const pasos  = State.get('pasos') || [];
    if (!lista) return;

    if (pasos.length === 0) {
      lista.innerHTML = _htmlListaVacia();
    } else {
      lista.innerHTML = pasos
        .map((p, i) => _htmlPaso(p, i, pasos.length))
        .join('');
    }

    _actualizarOverview();
    _actualizarStatusSeccion();
  }

  // ── Contadores globales (overview) ───────────────────────

  function _actualizarOverview() {
    const overview = Utils.$el('steps-overview');
    const pasos    = State.get('pasos') || [];

    if (pasos.length === 0) {
      overview?.setAttribute('hidden', '');
      return;
    }

    overview?.removeAttribute('hidden');
    const resumen = UICompletitud.resumenGlobal();
    const elComp  = Utils.$el('steps-counter-complete');
    const elPend  = Utils.$el('steps-counter-pending');
    if (elComp) elComp.textContent = `${resumen.completos} completo${resumen.completos !== 1 ? 's' : ''}`;
    if (elPend) elPend.textContent = `${resumen.pendientes} pendiente${resumen.pendientes !== 1 ? 's' : ''}`;
  }

  function _actualizarStatusSeccion() {
    const pasos   = State.get('pasos') || [];
    const resumen = UICompletitud.resumenGlobal();

    if (pasos.length === 0) {
      Utils.renderStatus('status-pasos', 'warning', '⚠ Sin pasos');
      return;
    }
    if (resumen.pendientes === 0) {
      Utils.renderStatus('status-pasos', 'ok', `✓ ${pasos.length} paso${pasos.length !== 1 ? 's' : ''}`);
    } else {
      Utils.renderStatus('status-pasos', 'warning',
        `${resumen.completos}/${pasos.length} completo${resumen.completos !== 1 ? 's' : ''}`);
    }
  }

  // ── Actualización quirúrgica de una tarjeta ──────────────
  // Evita re-render completo al editar descripción (mejor UX)

  function _actualizarTarjeta(id) {
    const pasos = State.get('pasos') || [];
    const idx   = pasos.findIndex(p => p.id === id);
    if (idx === -1) return;

    const card = document.getElementById(`step-card-${id}`);
    if (!card) { _renderLista(); return; }

    const paso        = pasos[idx];
    const completitud = UICompletitud.evaluar(paso);

    // Actualizar clases de completitud en la tarjeta
    card.classList.toggle('step-card--complete', completitud.estado === 'completo');
    card.classList.toggle('step-card--pending',  completitud.estado !== 'completo');

    // Actualizar título en header
    const titleEl = card.querySelector('.step-card__title');
    if (titleEl) {
      const tituloDesc = paso.descripcion.trim()
        ? Utils.escaparHtml(paso.descripcion.substring(0, 60) + (paso.descripcion.length > 60 ? '…' : ''))
        : null;
      titleEl.textContent = tituloDesc || 'Sin descripción…';
      titleEl.classList.toggle('step-card__title--empty', !tituloDesc);
    }

    // Actualizar badge de completitud
    const compEl = card.querySelector('.step-completitud');
    if (compEl) {
      compEl.textContent  = completitud.texto;
      compEl.className    = `step-completitud ${completitud.clase}`;
      compEl.setAttribute('aria-label', completitud.texto);
    }

    _actualizarOverview();
    _actualizarStatusSeccion();
  }

  // ── Operaciones CRUD ─────────────────────────────────────

  function _agregar() {
    const pasos  = State.get('pasos') || [];
    // Fase 1.4 — Integración mínima: no permitir crear el PRIMER paso
    // si no hay al menos un Tipo de Trabajo seleccionado globalmente.
    if (pasos.length === 0 && (State.get('tiposTrabajo') || []).length === 0) {
      Utils.toast('Debe seleccionar al menos un Tipo de Trabajo antes de crear pasos.', 'warning');
      return;
    }
    const nuevo  = _nuevoPaso(pasos.length + 1);
    pasos.push(nuevo);
    State.set('pasos', pasos, 'pasos:update');
    _expandidos.add(nuevo.id);
    _renderLista();
    // Enfocar textarea de la nueva tarjeta
    setTimeout(() => {
      const ta = document.getElementById(`step-desc-${nuevo.id}`);
      if (ta) {
        ta.focus();
        ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 60);
  }

  function _editar(id, descripcion) {
    const pasos = State.get('pasos') || [];
    const idx   = pasos.findIndex(p => p.id === id);
    if (idx === -1) return;
    pasos[idx].descripcion = descripcion;
    State.set('pasos', pasos, 'pasos:update');
    _actualizarTarjeta(id);
  }

  function _duplicar(id) {
    const pasos = State.get('pasos') || [];
    const idx   = pasos.findIndex(p => p.id === id);
    if (idx === -1) return;

    const origen = pasos[idx];
    const copia  = {
      id:             Utils.uuid(),
      numero:         0,                         // se recalcula abajo
      descripcion:    origen.descripcion,
      peligros:       [...origen.peligros],
      controles:      [...origen.controles],
      justificaciones: Utils.clonar(origen.justificaciones || [])
    };

    // Insertar inmediatamente después del original
    pasos.splice(idx + 1, 0, copia);
    _renumerarPasos(pasos);
    State.set('pasos', pasos, 'pasos:update');

    // Abrir la copia para que el usuario la identifique
    _expandidos.add(copia.id);
    _renderLista();

    // Efecto visual: animar borde de la copia
    setTimeout(() => {
      const card = document.getElementById(`step-card-${copia.id}`);
      if (card) {
        card.classList.add('step-card--new');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => card.classList.remove('step-card--new'), 1600);
      }
    }, 50);

    Utils.toast(`Paso ${origen.numero} duplicado como Paso ${copia.numero}.`, 'info');
  }

  async function _eliminar(id) {
    const pasos = State.get('pasos') || [];
    const paso  = pasos.find(p => p.id === id);
    if (!paso) return;

    const tieneContenido = paso.descripcion.trim() ||
                           paso.peligros.length > 0 ||
                           paso.controles.length > 0;

    if (tieneContenido) {
      const label = paso.descripcion.trim()
        ? `"${paso.descripcion.substring(0, 40)}${paso.descripcion.length > 40 ? '…' : ''}"`
        : `Paso ${paso.numero}`;
      const ok = await Modal.confirmar(
        'Eliminar paso',
        `¿Eliminar ${label}? Esta acción no se puede deshacer.`,
        { labelOk: 'Eliminar', peligroso: true }
      );
      if (!ok) return;
    }

    const nuevos = pasos.filter(p => p.id !== id);
    _renumerarPasos(nuevos);
    _expandidos.delete(id);
    State.set('pasos', nuevos, 'pasos:update');
    _renderLista();
  }

  function _mover(id, direccion) {
    const pasos = State.get('pasos') || [];
    const idx   = pasos.findIndex(p => p.id === id);
    if (idx === -1) return;

    const idxDestino = direccion === 'up' ? idx - 1 : idx + 1;
    if (idxDestino < 0 || idxDestino >= pasos.length) return;

    // Intercambiar posiciones
    [pasos[idx], pasos[idxDestino]] = [pasos[idxDestino], pasos[idx]];
    _renumerarPasos(pasos);
    State.set('pasos', pasos, 'pasos:update');
    _renderLista();

    // Restaurar scroll al paso movido
    setTimeout(() => {
      document.getElementById(`step-card-${id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }

  function _toggleExpansion(id) {
    if (_expandidos.has(id)) {
      _expandidos.delete(id);
      const card = document.getElementById(`step-card-${id}`);
      if (card) {
        card.classList.remove('step-card--open');
        const header = card.querySelector('.step-card__header');
        if (header) header.setAttribute('aria-expanded', 'false');
      }
    } else {
      _expandidos.clear();
      _expandidos.add(id);
      _renderLista();
    }
  }

  function _toggleSubpanel(tipo, id) {
    const subpanel = document.getElementById(`subpanel-${tipo}-${id}`);
    if (!subpanel) return;
    const estaAbierto = subpanel.classList.toggle('step-subpanel--open');
    const headerEl    = subpanel.querySelector('.step-subpanel__header');
    if (headerEl) headerEl.setAttribute('aria-expanded', String(estaAbierto));

    // Render bajo demanda al primer apertura
    if (estaAbierto) {
      const bodyEl = document.getElementById(`subpanel-body-${tipo}-${id}`);
      if (bodyEl && bodyEl.innerHTML.includes('<!-- Renderizado')) {
        if (tipo === 'peligros') UIPeligros.renderEnPaso(id, bodyEl);
        else                     UIControles.renderEnPaso(id, bodyEl);
      }
    }
  }

  // ── Renumeración ─────────────────────────────────────────

  function _renumerarPasos(pasos) {
    pasos.forEach((p, i) => { p.numero = i + 1; });
  }

  // ── Delegación de eventos ────────────────────────────────

  function _bindEventos() {
    // Guard: registrar listeners sobre nodos fijos solo una vez por sesión.
    // _renderLista() puede llamarse libremente — solo los listeners se protegen.
    if (_listenersBound) return;

    const lista   = Utils.$el('steps-list');
    const btnAdd  = Utils.$el('btn-add-step');

    // Si los nodos aún no están en el DOM (carga inicial antes de render)
    // se reintentará automáticamente en la próxima llamada a render().
    if (!lista || !btnAdd) return;

    btnAdd.addEventListener('click', _agregar);

    // Click en cabecera (toggle) y botones de acción
    lista.addEventListener('click', async e => {
      // Botones de acción (up/down/duplicate/delete)
      const btnAccion = e.target.closest('[data-action]');
      if (!btnAccion) return;

      const action = btnAccion.dataset.action;
      const id     = btnAccion.dataset.id;

      e.stopPropagation();  // evitar que toggle también se dispare

      switch (action) {
        case 'toggle':    _toggleExpansion(id);          break;
        case 'up':        _mover(id, 'up');               break;
        case 'down':      _mover(id, 'down');             break;
        case 'duplicate': _duplicar(id);                  break;
        case 'delete':    await _eliminar(id);             break;
      }
    });

    // Keyboard: Enter/Space en header para toggle
    lista.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const header = e.target.closest('[data-action="toggle"]');
      if (header) {
        e.preventDefault();
        _toggleExpansion(header.dataset.id);
      }
    });

    // Subpaneles: click en header
    lista.addEventListener('click', e => {
      const subHeader = e.target.closest('[data-subpanel]');
      if (!subHeader) return;
      _toggleSubpanel(subHeader.dataset.subpanel, subHeader.dataset.id);
    });

    // Edición de descripción — debounce implícito por autosave
    lista.addEventListener('input', e => {
      const ta = e.target.closest('.step-desc-input');
      if (!ta) return;
      _editar(ta.dataset.id, ta.value);
    });

    // Marcar como registrado — no se vuelve a ejecutar esta función
    _listenersBound = true;
  }

  // ── API pública ──────────────────────────────────────────

  function render() {
    _renderLista();   // siempre — actualiza contenido de la lista
    _bindEventos();   // no-op tras la primera ejecución exitosa
  }

  function validar() {
    const pasos = State.get('pasos') || [];
    if (pasos.length === 0) return false;
    return pasos.every(p => {
      const r = UICompletitud.evaluar(p);
      return r.estado === 'completo';
    });
  }

  // Re-render completo al importar borrador
  State.on('reset', () => {
    _expandidos.clear();
    render();
  });

  return { render, validar, _actualizarTarjetaPublico: _actualizarTarjeta };
})();


/* ───────────────────────────────────────────────────────────────
   MATRIX — Motor de sugerencias peligro → control
   Fuente de verdad exclusiva: matriz-peligro-control.json
   Ninguna regla de obligatoriedad/recomendación está en JS.
   HSE puede modificar la clasificación editando solo el JSON.
──────────────────────────────────────────────────────────────── */
const Matrix = (() => {

  /**
   * Dado un array de códigos de peligros seleccionados,
   * calcula el conjunto de controles obligatorios y recomendados
   * leyendo exclusivamente desde matriz-peligro-control.json.
   *
   * Un control puede ser obligatorio para un peligro y recomendado
   * para otro — la unión se resuelve con precedencia: obligatorio > recomendado.
   *
   * @param {string[]} codigosPeligros  Ej: ['M14', 'TT32']
   * @returns {{ obligatorios: Set<string>, recomendados: Set<string> }}
   */
  function calcular(codigosPeligros) {
    const obligatorios = new Set();
    const recomendados = new Set();

    codigosPeligros.forEach(cod => {
      const entrada = Config.getMatriz(cod);
      if (!entrada) return;

      (entrada.obligatorios || []).forEach(c => {
        obligatorios.add(c);
        recomendados.delete(c);   // obligatorio tiene precedencia
      });

      (entrada.recomendados || []).forEach(c => {
        if (!obligatorios.has(c)) recomendados.add(c);
      });
    });

    return { obligatorios, recomendados };
  }

  /**
   * Criticidad máxima de un conjunto de peligros.
   * Orden: ALTA > MEDIA > BAJA
   * @param {string[]} codigosPeligros
   * @returns {'ALTA'|'MEDIA'|'BAJA'|null}
   */
  function criticidadMaxima(codigosPeligros) {
    const orden = { ALTA: 3, MEDIA: 2, BAJA: 1 };
    let max = 0;
    let resultado = null;
    codigosPeligros.forEach(cod => {
      const entrada = Config.getMatriz(cod);
      if (!entrada) return;
      const val = orden[entrada.criticidad] || 0;
      if (val > max) { max = val; resultado = entrada.criticidad; }
    });
    return resultado;
  }

  /**
   * Retorna la criticidad de un peligro individual desde la matriz.
   * Si no está en la matriz, la toma de peligros.json.
   * @param {string} codigoPeligro
   * @returns {'ALTA'|'MEDIA'|'BAJA'|null}
   */
  function criticidadPeligro(codigoPeligro) {
    const entrada = Config.getMatriz(codigoPeligro);
    if (entrada) return entrada.criticidad;
    const peligro = Config.getPeligro(codigoPeligro);
    return peligro ? peligro.criticidad : null;
  }

  return { calcular, criticidadMaxima, criticidadPeligro };
})();


/* ───────────────────────────────────────────────────────────────
   UI.Peligros — SF-07 Selección de peligros por paso
   Renderiza bajo demanda dentro del subpanel del paso.
   Flujo: usuario abre panel → categorías colapsables →
          checkbox con código+descripción → Matrix.calcular →
          UIControles recibe sugerencias.
──────────────────────────────────────────────────────────────── */
const UIPeligros = (() => {

  // ── HTML por ítem de peligro ─────────────────────────────

  function _htmlItem(peligro, seleccionados) {
    const cod     = Utils.escaparHtml(peligro.codigo);
    const desc    = Utils.escaparHtml(peligro.descripcion);
    const checked = seleccionados.includes(peligro.codigo);
    const crit    = Matrix.criticidadPeligro(peligro.codigo);
    const critHtml = crit
      ? `<span class="criticidad criticidad--${crit.toLowerCase()}">${crit}</span>`
      : '';

    return `
      <label class="checkbox-item checkbox-list__item" for="peligro-${cod}">
        <input
          type="checkbox"
          id="peligro-${cod}"
          class="peligro-check"
          data-codigo="${cod}"
          ${checked ? 'checked' : ''}
          aria-label="${cod} - ${desc}"
        >
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
            <span class="checkbox-item__code">${cod}</span>
            ${critHtml}
          </div>
          <span class="checkbox-item__label">${desc}</span>
        </div>
      </label>`;
  }

  // ── HTML por categoría ───────────────────────────────────

  function _htmlCategoria(cat, seleccionados, catIdx) {
    const nombreEsc  = Utils.escaparHtml(cat.categoria);
    const peligros   = cat.peligros || [];
    const selEnCat   = peligros.filter(p => seleccionados.includes(p.codigo)).length;
    const counter    = selEnCat > 0
      ? `<span class="checkbox-group__counter">${selEnCat}</span>`
      : '';
    const items      = peligros.map(p => _htmlItem(p, seleccionados)).join('');

    return `
      <div class="checkbox-group" id="catpel-${catIdx}">
        <button type="button"
          class="checkbox-group__toggle"
          data-cat-toggle="catpel-items-${catIdx}"
          aria-expanded="false"
          aria-controls="catpel-items-${catIdx}">
          ${nombreEsc}${counter}
          <span class="checkbox-group__toggle-arrow"></span>
        </button>
        <div class="checkbox-group__items checkbox-list" id="catpel-items-${catIdx}" hidden>
          ${items}
        </div>
      </div>`;
  }

  // ── Render completo del panel de peligros en un paso ────

  function renderEnPaso(pasoId, container) {
    const paso        = (State.get('pasos') || []).find(p => p.id === pasoId);
    if (!paso) return;
    const seleccionados = paso.peligros || [];
    const categorias    = Config.getPeligrosPorCategoria();

    const html = `
      <div class="peligros-panel" data-paso-id="${Utils.escaparHtml(pasoId)}">
        <p class="field__hint" style="margin-bottom:0.75rem;">
          Seleccione todos los peligros asociados a este paso.
        </p>
        ${categorias.map((cat, i) => _htmlCategoria(cat, seleccionados, `${pasoId}-${i}`)).join('')}
      </div>`;

    container.innerHTML = html;
    _bindEventos(container, pasoId);
  }

  // ── Eventos del panel ────────────────────────────────────

  function _bindEventos(container, pasoId) {

    // Corrección de acumulación de listeners (RFC aprobada — Alternativa A).
    // Mismo patrón ya validado en UIControles. Los listeners de abajo usan
    // DELEGACIÓN sobre el nodo container, que persiste entre re-renderizados
    // (renderEnPaso hace innerHTML, que reemplaza hijos pero NO el nodo ni sus
    // listeners). Sin guard, cada render re-vincularía los handlers, acumulándolos.
    // Este guard garantiza que un mismo nodo container vincule sus listeners UNA
    // sola vez. La marca es metadato efímero de DOM (NO estado de dominio, NO
    // persistido): si el container se destruye y recrea (cierre/reapertura del
    // panel), el nodo nuevo no tiene la marca y se vincula correctamente de nuevo.
    if (container._peligrosListenersBound) return;
    container._peligrosListenersBound = true;

    // Toggle de categoría
    container.addEventListener('click', e => {
      const btn = e.target.closest('[data-cat-toggle]');
      if (!btn) return;
      const targetId = btn.dataset.catToggle;
      const items    = document.getElementById(targetId);
      if (!items) return;
      
      const estaOculto = items.hasAttribute('hidden');
      
      if (estaOculto) {
        // Cerramos las otras categorías de peligros de este paso
        container.querySelectorAll('[data-cat-toggle]').forEach(otherBtn => {
          if (otherBtn !== btn) {
            const otherTargetId = otherBtn.dataset.catToggle;
            const otherItems = document.getElementById(otherTargetId);
            if (otherItems) {
              otherItems.setAttribute('hidden', '');
              otherBtn.setAttribute('aria-expanded', 'false');
              otherBtn.classList.remove('checkbox-group--open');
              const otherArrow = otherBtn.querySelector('.checkbox-group__toggle-arrow');
              if (otherArrow) otherArrow.style.transform = 'rotate(-45deg)';
            }
          }
        });
        
        // Abrimos la actual
        items.removeAttribute('hidden');
        btn.setAttribute('aria-expanded', 'true');
        btn.classList.add('checkbox-group--open');
        const arrow = btn.querySelector('.checkbox-group__toggle-arrow');
        if (arrow) arrow.style.transform = 'rotate(45deg)';
      } else {
        // Cerramos la actual
        items.setAttribute('hidden', '');
        btn.setAttribute('aria-expanded', 'false');
        btn.classList.remove('checkbox-group--open');
        const arrow = btn.querySelector('.checkbox-group__toggle-arrow');
        if (arrow) arrow.style.transform = 'rotate(-45deg)';
      }
    });

    // Selección/deselección de peligro
    container.addEventListener('change', e => {
      const el = e.target;
      if (!el.classList.contains('peligro-check')) return;

      const codigo      = el.dataset.codigo;
      const pasos       = State.get('pasos') || [];
      const idx         = pasos.findIndex(p => p.id === pasoId);
      if (idx === -1) return;

      const peligrosAnteriores = [...(pasos[idx].peligros || [])];
      let   peligros           = [...peligrosAnteriores];

      if (el.checked) {
        if (!peligros.includes(codigo)) peligros.push(codigo);
      } else {
        peligros = peligros.filter(c => c !== codigo);
      }

      pasos[idx].peligros = peligros;

      // Limpiar controles huérfanos al eliminar un peligro:
      // conserva manuales, elimina los que solo venían del peligro removido
      if (!el.checked && peligrosAnteriores.length > 0) {
        const { obligatorios: obAnt, recomendados: recAnt } = Matrix.calcular(peligrosAnteriores);
        const { obligatorios: obNew, recomendados: recNew } = Matrix.calcular(peligros);
        const eraDeMAtrix   = cod => obAnt.has(cod) || recAnt.has(cod);
        const sigueEnMatrix = cod => obNew.has(cod) || recNew.has(cod);
        pasos[idx].controles = (pasos[idx].controles || []).filter(cod =>
          !eraDeMAtrix(cod) || sigueEnMatrix(cod)
        );
      }

      State.set('pasos', pasos, 'pasos:update');

      // Actualizar contador del subpanel de peligros
      const countEl = document.getElementById(`subpanel-count-peligros-${pasoId}`);
      if (countEl) countEl.textContent = peligros.length;

      // Actualizar contador de la categoría
      _actualizarContadorCategoria(el);

      // Notificar a UIControles para refrescar (re-render completo con Matrix actualizada)
      _notificarControles(pasoId, peligros);

      // Refrescar completitud de la tarjeta
      UIPasos._actualizarTarjetaPublico(pasoId);
    });
  }

  function _actualizarContadorCategoria(checkboxEl) {
    const grupo  = checkboxEl.closest('.checkbox-group');
    if (!grupo) return;
    const total  = grupo.querySelectorAll('.peligro-check:checked').length;
    let counter  = grupo.querySelector('.checkbox-group__counter');
    const toggle = grupo.querySelector('.checkbox-group__toggle');
    if (!toggle) return;
    if (total > 0) {
      if (!counter) {
        counter = document.createElement('span');
        counter.className = 'checkbox-group__counter';
        toggle.insertBefore(counter, toggle.querySelector('.checkbox-group__toggle-arrow'));
      }
      counter.textContent = total;
    } else if (counter) {
      counter.remove();
    }
  }

  function _notificarControles(pasoId, peligros) {
    // Refrescar el panel de controles si ya está abierto
    const bodyControles = document.getElementById(`subpanel-body-controles-${pasoId}`);
    if (bodyControles && !bodyControles.innerHTML.includes('<!-- Renderizado')) {
      UIControles.renderEnPaso(pasoId, bodyControles);
    }
  }

  /** Re-renderiza el panel si ya estaba visible (tras importar JSON) */
  function refrescarSiAbierto(pasoId) {
    const body = document.getElementById(`subpanel-body-peligros-${pasoId}`);
    if (body && !body.innerHTML.includes('<!-- Renderizado')) {
      renderEnPaso(pasoId, body);
    }
  }

  return { renderEnPaso, refrescarSiAbierto };
})();


/* ───────────────────────────────────────────────────────────────
   UI.Controles — SF-08 Selección de controles por paso
   Integra Matrix para mostrar obligatorios (🔒) y recomendados (⚠).
   Toda clasificación proviene exclusivamente del JSON.
──────────────────────────────────────────────────────────────── */
const UIControles = (() => {

  // ── HTML por ítem de control ─────────────────────────────

  /**
   * @param {Object} control       { codigo, descripcion, grupo }
   * @param {string[]} seleccionados  códigos activos del paso
   * @param {'obligatorio'|'recomendado'|null} rolMatrix  desde Matrix
   * @param {Object[]} justificaciones  array de justificaciones del paso
   */
  function _htmlItem(control, seleccionados, rolMatrix, justificaciones) {
    const cod         = Utils.escaparHtml(control.codigo);
    const desc        = Utils.escaparHtml(control.descripcion);
    const checked     = seleccionados.includes(control.codigo);
    const esObligat   = rolMatrix === 'obligatorio';
    const esRecomend  = rolMatrix === 'recomendado';
    const justif      = (justificaciones || []).find(j => j.control === control.codigo);
    const fueEliminadoConJustif = justif && justif.eliminadoPorUsuario && justif.justificacion;

    // Clases CSS del ítem
    let itemClass = 'checkbox-item checkbox-list__item';
    if (esObligat  && !fueEliminadoConJustif) itemClass += ' checkbox-item--obligatorio';
    if (esRecomend && !checked)               itemClass += ' checkbox-item--suggested';

    // Prefijo visual según rol
    let prefijo = '';
    if (esObligat)  prefijo = `<span class="control-badge control-badge--obligatorio" title="Obligatorio por matriz">🔒</span>`;
    if (esRecomend) prefijo = `<span class="control-badge control-badge--recomendado"  title="Recomendado por matriz">⚠</span>`;

    // Badge de eliminado con justificación
    const eliminadoHtml = fueEliminadoConJustif
      ? `<span class="control-badge control-badge--eliminado" title="Eliminado: ${Utils.escaparHtml(justif.justificacion)}">✗ Justificado</span>`
      : '';

    // NC-01 — Acción de justificación directa por omisión.
    // Se muestra SOLO cuando el control obligatorio está en estado FALTANTE
    // (no seleccionado y sin justificación previa). Permite la transición
    // directa FALTANTE → JUSTIFICADO (T2) sin requerir marcar/desmarcar.
    const estaFaltante  = esObligat && !checked && !fueEliminadoConJustif;
    const justifOmisionHtml = estaFaltante
      ? `<button type="button" class="control-justificar-omision"
            data-codigo="${cod}"
            title="Justificar por qué se omite este control obligatorio">
            Justificar omisión
         </button>`
      : '';

    return `
      <label class="${itemClass}" for="control-${cod}">
        <input
          type="checkbox"
          id="control-${cod}"
          class="control-check"
          data-codigo="${cod}"
          data-rol="${rolMatrix || 'manual'}"
          ${checked ? 'checked' : ''}
          aria-label="${cod} - ${desc}"
        >
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
            <span class="checkbox-item__code">${cod}</span>
            ${prefijo}
            ${eliminadoHtml}
          </div>
          <span class="checkbox-item__label">${desc}</span>
          ${justifOmisionHtml}
        </div>
      </label>`;
  }

  // ── HTML por grupo funcional ─────────────────────────────

  function _htmlGrupo(grp, seleccionados, sugerencias, justificaciones, grpIdx) {
    const { obligatorios, recomendados } = sugerencias;
    const nombreEsc = Utils.escaparHtml(grp.grupo);
    const controles = grp.controles || [];

    // Ordenar: obligatorios primero, recomendados segundo, resto al final
    const ordenados = [...controles].sort((a, b) => {
      const rankA = obligatorios.has(a.codigo) ? 0 : recomendados.has(a.codigo) ? 1 : 2;
      const rankB = obligatorios.has(b.codigo) ? 0 : recomendados.has(b.codigo) ? 1 : 2;
      return rankA - rankB;
    });

    const selEnGrupo = controles.filter(c => seleccionados.includes(c.codigo)).length;
    const counter    = selEnGrupo > 0
      ? `<span class="checkbox-group__counter">${selEnGrupo}</span>`
      : '';

    const items = ordenados.map(c => {
      const rol = obligatorios.has(c.codigo) ? 'obligatorio'
                : recomendados.has(c.codigo)  ? 'recomendado'
                : null;
      return _htmlItem(c, seleccionados, rol, justificaciones);
    }).join('');

    // ¿El grupo tiene algún obligatorio o recomendado? Abrirlo por defecto.
    const tieneDestacados = controles.some(c => obligatorios.has(c.codigo) || recomendados.has(c.codigo));
    const abierto         = tieneDestacados;

    return `
      <div class="checkbox-group" id="ctrlgrp-${grpIdx}">
        <button type="button"
          class="checkbox-group__toggle ${abierto ? 'checkbox-group--open' : ''}"
          data-grp-toggle="ctrlgrp-items-${grpIdx}"
          aria-expanded="${abierto}"
          aria-controls="ctrlgrp-items-${grpIdx}">
          ${nombreEsc}${counter}
          <span class="checkbox-group__toggle-arrow" style="transform:${abierto ? 'rotate(45deg)' : 'rotate(-45deg)'}"></span>
        </button>
        <div class="checkbox-group__items checkbox-list" id="ctrlgrp-items-${grpIdx}"
          ${abierto ? '' : 'hidden'}>
          ${items}
        </div>
      </div>`;
  }

  // ── Fase 1.6 — Vista alternativa: agrupación por Tipo de Trabajo ──
  // Estado EFÍMERO de UI (no persistido, no en State): qué vista está activa
  // por paso. Si se pierde (recarga), se reconstruye en 'funcional' por defecto.
  // No es fuente de verdad de datos — solo organización visual (RI-8).
  const _vistaActiva = new Map(); // pasoId -> 'funcional' | 'tt'

  // B2 — Construcción de la agrupación TT, derivada en tiempo de ejecución.
  // Deriva los peligros TT presentes en el paso desde el catálogo (RI-6),
  // y sus obligatorios desde Matrix (RI-7). No persiste nada.
  function _agruparPorTipoTrabajo(peligros) {
    const grupos = [];
    const tiposTrabajo = Config.getTiposTrabajo(); // catálogo, fuente única
    tiposTrabajo.forEach(tt => {
      // RI-6: el TT solo se agrupa si su peligro equivalente está en el paso.
      // Se identifica por el mapeo del catálogo (peligroTT), nunca por prefijo.
      if (!peligros.includes(tt.peligroTT)) return;
      // RI-7: obligatorios derivados de Matrix para ESE peligro TT, no almacenados.
      const sug = Matrix.calcular([tt.peligroTT]);
      const obligatoriosTT = Array.from(sug.obligatorios || []);
      grupos.push({ tt, codigosObligatorios: obligatoriosTT });
    });
    return grupos;
  }

  // B3 — Render de un grupo TT, reutilizando _htmlItem (estados, botón NC-01).
  function _htmlGrupoTT(grupoTT, seleccionados, justificaciones, grpIdx) {
    const { tt, codigosObligatorios } = grupoTT;
    const nombreEsc = Utils.escaparHtml(tt.label);
    // Resolver cada código a su objeto de control del catálogo (solo lectura).
    // El rol es 'obligatorio' (provienen de los obligatorios del TT). El estado
    // (sel/just/falt) lo resuelve _htmlItem leyendo las colecciones existentes.
    const items = codigosObligatorios.map(cod => {
      const ctrl = Config.getControl(cod) || { codigo: cod, descripcion: cod };
      return _htmlItem(ctrl, seleccionados, 'obligatorio', justificaciones);
    }).join('');
    const selEnGrupo = codigosObligatorios.filter(c => seleccionados.includes(c)).length;
    const counter = `<span class="checkbox-group__counter">${selEnGrupo}/${codigosObligatorios.length}</span>`;
    return `
      <div class="checkbox-group" id="ttgrp-${grpIdx}">
        <button type="button"
          class="checkbox-group__toggle checkbox-group--open"
          data-grp-toggle="ttgrp-items-${grpIdx}"
          aria-expanded="true"
          aria-controls="ttgrp-items-${grpIdx}">
          ${nombreEsc}${counter}
          <span class="checkbox-group__toggle-arrow" style="transform:rotate(45deg);"></span>
        </button>
        <div class="checkbox-group__items checkbox-list" id="ttgrp-items-${grpIdx}">
          ${items}
        </div>
      </div>`;
  }

  // ── Render completo del panel de controles en un paso ────

  function renderEnPaso(pasoId, container) {
    const pasos = State.get('pasos') || [];
    const paso  = pasos.find(p => p.id === pasoId);
    if (!paso) return;

    const seleccionados  = paso.controles    || [];
    const justificaciones = paso.justificaciones || [];
    const peligros       = paso.peligros     || [];
    const grupos         = Config.getControlesPorGrupo();

    // Calcular sugerencias desde la matriz (solo JSON, sin lógica hardcoded)
    const sugerencias = peligros.length > 0
      ? Matrix.calcular(peligros)
      : { obligatorios: new Set(), recomendados: new Set() };

    // Fase 1.5 — Auto-selección ELIMINADA.
    // Los controles obligatorios derivados de la matriz (sugerencias.obligatorios)
    // ya NO se marcan automáticamente. Se exponen como sugerencia visual (ver
    // render más abajo) y el usuario debe seleccionarlos conscientemente.
    // La exigibilidad real se evalúa en UICompletitud (selección o justificación).

    // Leyenda de sugerencias (solo si hay peligros seleccionados)
    const leyenda = peligros.length > 0 ? `
      <div class="controles-leyenda">
        <span><span class="control-badge control-badge--obligatorio">🔒</span> Obligatorio por matriz</span>
        <span><span class="control-badge control-badge--recomendado">⚠</span> Recomendado</span>
      </div>` : `
      <p class="field__hint" style="margin-bottom:0.75rem;">
        Seleccione primero peligros para ver sugerencias de controles.
      </p>`;

    // Fase 1.6 — Conmutador de vista (B1). La vista activa es estado EFÍMERO
    // de UI; solo cambia la ORGANIZACIÓN visual, nunca los datos. Ambas vistas
    // consumen las mismas fuentes (Matrix, controles[], justificaciones[]).
    const vista = _vistaActiva.get(pasoId) || 'funcional';
    // La vista TT solo tiene sentido si hay peligros TT en el paso (RI-6).
    const gruposTT = peligros.length > 0 ? _agruparPorTipoTrabajo(peligros) : [];
    const hayTT    = gruposTT.length > 0;

    // Selector de vista (solo se ofrece la opción TT si hay peligros TT).
    const selectorVista = (peligros.length > 0 && hayTT) ? `
      <div class="controles-vista-selector" role="group" aria-label="Vista de controles">
        <button type="button" class="vista-btn ${vista === 'funcional' ? 'vista-btn--activa' : ''}"
          data-vista="funcional" data-paso-id="${Utils.escaparHtml(pasoId)}">Por grupo funcional</button>
        <button type="button" class="vista-btn ${vista === 'tt' ? 'vista-btn--activa' : ''}"
          data-vista="tt" data-paso-id="${Utils.escaparHtml(pasoId)}">Por Tipo de Trabajo</button>
      </div>` : '';

    // Cuerpo según la vista activa. Si no hay TT, siempre vista funcional.
    const cuerpo = (vista === 'tt' && hayTT)
      ? gruposTT.map((g, i) => _htmlGrupoTT(g, seleccionados, justificaciones, `${pasoId}-tt-${i}`)).join('')
      : grupos.map((grp, i) =>
          _htmlGrupo(grp, seleccionados, sugerencias, justificaciones, `${pasoId}-${i}`)
        ).join('');

    const html = `
      <div class="controles-panel" data-paso-id="${Utils.escaparHtml(pasoId)}">
        ${leyenda}
        ${selectorVista}
        ${cuerpo}
      </div>`;

    container.innerHTML = html;
    _bindEventos(container, pasoId);
  }

  // ── Eventos del panel ────────────────────────────────────

  function _bindEventos(container, pasoId) {

    // Corrección de acumulación de listeners (RFC aprobada — Alternativa A).
    // Los 4 listeners de abajo usan DELEGACIÓN sobre el nodo container, que
    // permanece vivo entre re-renderizados (renderEnPaso hace innerHTML, que
    // reemplaza hijos pero NO el nodo ni sus listeners). Sin guard, cada render
    // re-vincularía los 4 handlers, acumulándolos. Este guard garantiza que un
    // mismo nodo container vincule sus listeners UNA sola vez.
    // La marca es metadato efímero de DOM (NO estado de dominio, NO persistido):
    // si el container se destruye y recrea (cierre/reapertura del panel), el
    // nodo nuevo no tiene la marca y se vincula correctamente de nuevo.
    if (container._controlesListenersBound) return;
    container._controlesListenersBound = true;

    // Toggle de grupo funcional
    container.addEventListener('click', e => {
      const btn = e.target.closest('[data-grp-toggle]');
      if (!btn) return;
      const targetId = btn.dataset.grpToggle;
      const items    = document.getElementById(targetId);
      if (!items) return;
      
      const estaOculto = items.hasAttribute('hidden');
      
      if (estaOculto) {
        // Cerramos los otros grupos de controles de este paso
        container.querySelectorAll('[data-grp-toggle]').forEach(otherBtn => {
          if (otherBtn !== btn) {
            const otherTargetId = otherBtn.dataset.catToggle || otherBtn.dataset.grpToggle;
            const otherItems = document.getElementById(otherTargetId);
            if (otherItems) {
              otherItems.setAttribute('hidden', '');
              otherBtn.setAttribute('aria-expanded', 'false');
              otherBtn.classList.remove('checkbox-group--open');
              const otherArrow = otherBtn.querySelector('.checkbox-group__toggle-arrow');
              if (otherArrow) otherArrow.style.transform = 'rotate(-45deg)';
            }
          }
        });
        
        // Abrimos la actual
        items.removeAttribute('hidden');
        btn.setAttribute('aria-expanded', 'true');
        btn.classList.add('checkbox-group--open');
        const arrow = btn.querySelector('.checkbox-group__toggle-arrow');
        if (arrow) arrow.style.transform = 'rotate(45deg)';
      } else {
        // Cerramos la actual
        items.setAttribute('hidden', '');
        btn.setAttribute('aria-expanded', 'false');
        btn.classList.remove('checkbox-group--open');
        const arrow = btn.querySelector('.checkbox-group__toggle-arrow');
        if (arrow) arrow.style.transform = 'rotate(-45deg)';
      }
    });

    // Fase 1.6 — Conmutador de vista (B1). Solo cambia la organización visual
    // (estado efímero _vistaActiva) y re-renderiza. NO altera datos ni es vía
    // de mutación de controles/justificaciones (RI-8).
    container.addEventListener('click', e => {
      const btn = e.target.closest('.vista-btn');
      if (!btn) return;
      const nuevaVista = btn.dataset.vista;
      if (nuevaVista !== 'funcional' && nuevaVista !== 'tt') return;
      _vistaActiva.set(pasoId, nuevaVista);
      renderEnPaso(pasoId, container);
    });

    // NC-01 — Justificación directa por omisión (FALTANTE → JUSTIFICADO).
    // El botón solo existe para obligatorios en estado FALTANTE. Reutiliza el
    // mismo mecanismo de justificación, sin requerir selección previa.
    container.addEventListener('click', async e => {
      const btn = e.target;
      if (!btn.classList.contains('control-justificar-omision')) return;
      e.preventDefault();
      const codigo = btn.dataset.codigo;
      await _gestionarEliminacionObligatorio(pasoId, codigo, null);
    });

    // Selección/deselección de control
    container.addEventListener('change', async e => {
      const el = e.target;
      if (!el.classList.contains('control-check')) return;

      const codigo = el.dataset.codigo;
      const rol    = el.dataset.rol;    // 'obligatorio' | 'recomendado' | 'manual'

      if (!el.checked && rol === 'obligatorio') {
        // Restaurar visualmente — esperamos la respuesta del modal
        el.checked = true;
        await _gestionarEliminacionObligatorio(pasoId, codigo, el);
      } else {
        _toggleControl(pasoId, codigo, el.checked);
        _actualizarContadorGrupo(el);
        UIPasos._actualizarTarjetaPublico(pasoId);
      }
    });
  }

  function _toggleControl(pasoId, codigo, agregar) {
    const pasos = State.get('pasos') || [];
    const idx   = pasos.findIndex(p => p.id === pasoId);
    if (idx === -1) return;

    let controles = [...(pasos[idx].controles || [])];
    if (agregar) {
      if (!controles.includes(codigo)) controles.push(codigo);
      // NC-02 — Exclusión mutua (RI-1). Al SELECCIONAR un control, se retira
      // cualquier justificación previa del mismo control en este paso. Garantiza
      // que la transición JUSTIFICADO → SELECCIONADO (T5) no deje estado dual:
      // un control nunca puede estar simultáneamente en controles[] y
      // justificaciones[] dentro del mismo paso.
      const justificacionesPrev = pasos[idx].justificaciones || [];
      const justificacionesDepuradas = justificacionesPrev.filter(j => j.control !== codigo);
      if (justificacionesDepuradas.length !== justificacionesPrev.length) {
        pasos[idx].justificaciones = justificacionesDepuradas;
      }
    } else {
      controles = controles.filter(c => c !== codigo);
    }
    pasos[idx].controles = controles;
    State.set('pasos', pasos, 'pasos:update');

    const countEl = document.getElementById(`subpanel-count-controles-${pasoId}`);
    if (countEl) countEl.textContent = controles.length;
  }

  /** Flujo de eliminación de un control obligatorio con justificación */
  async function _gestionarEliminacionObligatorio(pasoId, codigo, checkboxEl) {
    const control = Config.getControl(codigo);
    const desc    = control ? control.descripcion : codigo;

    // Modal de justificación
    const titulo  = `Eliminar control obligatorio`;
    const mensaje = `El control "${codigo} - ${desc}" es obligatorio según la matriz HSE.
Para eliminarlo debe registrar una justificación que quedará almacenada para auditoría.`;

    // Usamos Modal genérico con campo de texto inyectado dinámicamente
    const overlay     = Utils.$el('modal-confirm');
    const titleEl     = Utils.$el('modal-confirm-title');
    const messageEl   = Utils.$el('modal-confirm-message');
    const btnOk       = Utils.$el('btn-confirm-ok');
    const btnCancel   = Utils.$el('btn-confirm-cancel');

    titleEl.textContent   = titulo;
    messageEl.innerHTML   = `<p style="margin-bottom:0.75rem;">${Utils.escaparHtml(mensaje)}</p>
      <label class="field__label field__label--required" style="display:block;margin-bottom:0.25rem;">
        Justificación
      </label>
      <textarea id="justif-textarea" class="field__textarea" rows="3"
        placeholder="Explique por qué este control no aplica a esta tarea…"
        maxlength="300" style="font-size:0.875rem;"></textarea>`;
    btnOk.textContent   = 'Confirmar eliminación';
    btnOk.className     = 'btn-primary btn-primary--danger';
    overlay.classList.remove('hidden');

    // Esperar respuesta
    const confirmado = await new Promise(resolve => {
      const onOk     = () => { cleanup(); resolve(true);  };
      const onCancel = () => { cleanup(); resolve(false); };
      const onOverlay = e => { if (e.target === overlay) { cleanup(); resolve(false); } };

      btnOk.addEventListener('click',     onOk,     { once: true });
      btnCancel.addEventListener('click', onCancel, { once: true });
      overlay.addEventListener('click',   onOverlay, { once: true });

      function cleanup() {
        overlay.classList.add('hidden');
        btnOk.removeEventListener('click', onOk);
        btnCancel.removeEventListener('click', onCancel);
        overlay.removeEventListener('click', onOverlay);
      }
    });

    if (!confirmado) return;

    const justifEl = document.getElementById('justif-textarea');
    const texto    = justifEl ? justifEl.value.trim() : '';
    if (!texto) {
      Utils.toast('La justificación es obligatoria para eliminar un control obligatorio.', 'warning');
      return;
    }

    // Registrar justificación y eliminar del array controles
    const pasos = State.get('pasos') || [];
    const idx   = pasos.findIndex(p => p.id === pasoId);
    if (idx === -1) return;

    pasos[idx].controles = (pasos[idx].controles || []).filter(c => c !== codigo);
    const justificaciones = pasos[idx].justificaciones || [];

    // Reemplazar si ya existe una justificación previa para este control
    const idxJustif = justificaciones.findIndex(j => j.control === codigo);
    const entrada   = {
      control:              codigo,
      eliminadoPorUsuario:  true,
      justificacion:        texto,
      registradoEn:         new Date().toISOString()
    };
    if (idxJustif >= 0) justificaciones[idxJustif] = entrada;
    else justificaciones.push(entrada);

    pasos[idx].justificaciones = justificaciones;
    State.set('pasos', pasos, 'pasos:update');

    // Actualizar UI
    // NC-01: cuando la justificación llega por el botón de omisión directa,
    // checkboxEl es null (no hay checkbox que desmarcar). El re-render posterior
    // del ítem refleja el nuevo estado JUSTIFICADO.
    if (checkboxEl) {
      checkboxEl.checked = false;
      _actualizarContadorGrupo(checkboxEl);
    }
    const countEl = document.getElementById(`subpanel-count-controles-${pasoId}`);
    if (countEl) countEl.textContent = pasos[idx].controles.length;

    // Refrescar el item para mostrar badge "✗ Justificado"
    const bodyEl = document.getElementById(`subpanel-body-controles-${pasoId}`);
    if (bodyEl) renderEnPaso(pasoId, bodyEl);

    UIPasos._actualizarTarjetaPublico(pasoId);
    Utils.toast(`Control ${codigo} eliminado. Justificación registrada.`, 'warning');
  }

  function _actualizarContadorGrupo(checkboxEl) {
    const grupo  = checkboxEl.closest('.checkbox-group');
    if (!grupo) return;
    const total  = grupo.querySelectorAll('.control-check:checked').length;
    let counter  = grupo.querySelector('.checkbox-group__counter');
    const toggle = grupo.querySelector('.checkbox-group__toggle');
    if (!toggle) return;
    if (total > 0) {
      if (!counter) {
        counter = document.createElement('span');
        counter.className = 'checkbox-group__counter';
        toggle.insertBefore(counter, toggle.querySelector('.checkbox-group__toggle-arrow'));
      }
      counter.textContent = total;
    } else if (counter) {
      counter.remove();
    }
  }

  /** Re-renderiza si ya estaba visible */
  function refrescarSiAbierto(pasoId) {
    const body = document.getElementById(`subpanel-body-controles-${pasoId}`);
    if (body && !body.innerHTML.includes('<!-- Renderizado')) {
      renderEnPaso(pasoId, body);
    }
  }

  return { renderEnPaso, refrescarSiAbierto };
})();


/* ───────────────────────────────────────────────────────────────
   UI.Resumen — SF-09 Resumen técnico (solo lectura)
   Vista de revisión para el Supervisor HSE.
   Lee State y Config, nunca escribe.
   Re-renderiza completo en cada apertura.
──────────────────────────────────────────────────────────────── */
const UIResumen = (() => {

  const BODY_ID = 'body-resumen';
  let _listenersBound = false;  // guard — SF C1

  // ── Helpers de formato ───────────────────────────────────

  function _fila(etiqueta, valor, alerta = false) {
    const valorHtml = valor
      ? `<span class="summary-row__value">${Utils.escaparHtml(valor)}</span>`
      : `<span class="summary-row__value" style="color:var(--color-danger);">⚠ Sin completar</span>`;
    return `
      <div class="summary-row">
        <span class="summary-row__label">${Utils.escaparHtml(etiqueta)}</span>
        ${valorHtml}
      </div>`;
  }

  function _badge(texto, tipo) {
    return `<span class="badge badge--${tipo}">${Utils.escaparHtml(texto)}</span>`;
  }

  // ── Bloque 1: Información General ────────────────────────
  function _htmlGeneral() {
    const g = State.get('general') || {};
    let fechaDisplay = '';
    if (g.fecha) {
      try {
        const [y, m, d] = g.fecha.split('-');
        fechaDisplay = `${d}/${m}/${y}`;
      } catch { fechaDisplay = g.fecha; }
    }
    return `
      <div class="resumen-bloque">
        <h3 class="resumen-bloque__titulo">Información General</h3>
        ${_fila('Lugar', g.lugar)}
        ${_fila('Fecha', fechaDisplay)}
        ${_fila('Tarea', g.tarea)}
      </div>`;
  }

  // ── Bloque 2: Responsables ────────────────────────────────
  function _htmlResponsables() {
    const lista = State.get('responsables') || [];
    const filas = lista.length > 0
      ? lista.map(r => `
          <div class="summary-row">
            <span class="summary-row__value">${Utils.escaparHtml(r.nombre || '—')}</span>
            <span class="summary-row__label" style="text-align:right;">${Utils.escaparHtml(r.cedula || '—')}</span>
          </div>`).join('')
      : `<p style="color:var(--color-danger);font-size:var(--text-sm);padding:var(--space-2) 0;">
           ⚠ Sin responsables registrados
         </p>`;
    return `
      <div class="resumen-bloque">
        <h3 class="resumen-bloque__titulo">Responsables de la Tarea</h3>
        <div class="summary-row" style="font-weight:700;font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em;padding-bottom:var(--space-1);">
          <span class="summary-row__label">Nombre</span>
          <span style="text-align:right;">Cédula</span>
        </div>
        ${filas}
      </div>`;
  }

  // ── Bloque 3: Ubicación ───────────────────────────────────
  function _htmlUbicacion() {
    return `
      <div class="resumen-bloque">
        <h3 class="resumen-bloque__titulo">Puntos de Referencia</h3>
        ${_fila('Punto de Encuentro', State.get('puntoEncuentro'))}
        ${_fila('Ducha y Lavaojos',  State.get('duchaLavaojos'))}
      </div>`;
  }

  // ── Bloque 4: Señales de Parada ───────────────────────────
  function _htmlSenales() {
    const cfg         = Config.get('validaciones') || {};
    const minimo      = cfg.minimoSenalesParada || 2;
    const estado      = State.get('senalesParada') || {};
    const selIds      = estado.seleccionadas || [];
    const textos      = estado.textos || {};
    const catalogoMap = {};
    (Config.get('senalesParada') || []).forEach(s => { catalogoMap[s.id] = s; });

    const items = selIds.map(id => {
      const senal = catalogoMap[id];
      if (!senal) return '';
      const textoLibre = textos[id] ? `: "${Utils.escaparHtml(textos[id])}"` : '';
      return `<div class="resumen-senal">✓ ${Utils.escaparHtml(senal.texto)}${textoLibre}</div>`;
    }).join('');

    const alertaMin = selIds.length < minimo
      ? `<p style="color:var(--color-danger);font-size:var(--text-sm);margin-top:var(--space-2);">
           ⚠ Se requieren mínimo ${minimo} señales (${selIds.length} seleccionada${selIds.length !== 1 ? 's' : ''})
         </p>` : '';

    return `
      <div class="resumen-bloque">
        <h3 class="resumen-bloque__titulo">Señales para Detener la Tarea
          <span style="font-weight:400;color:var(--color-text-muted);">(${selIds.length})</span>
        </h3>
        ${items || '<p style="color:var(--color-text-muted);font-size:var(--text-sm);">Sin señales seleccionadas</p>'}
        ${alertaMin}
      </div>`;
  }

  // ── Bloque 5: Pasos ───────────────────────────────────────
  function _htmlControlItem(codControl, paso) {
    const ctrl          = Config.getControl(codControl);
    const desc          = ctrl ? ctrl.descripcion : codControl;
    const { obligatorios, recomendados } = Matrix.calcular(paso.peligros || []);
    const rol = obligatorios.has(codControl) ? 'obligatorio'
              : recomendados.has(codControl)  ? 'recomendado'
              : 'manual';
    const prefijos = {
      obligatorio: `<span class="control-badge control-badge--obligatorio">🔒</span>`,
      recomendado: `<span class="control-badge control-badge--recomendado">⚠</span>`,
      manual:      `<span class="control-badge" style="background:var(--color-info-bg);color:var(--color-info);border:1px solid var(--color-info-border);">➕</span>`
    };
    return `
      <div class="resumen-item-control">
        <span class="checkbox-item__code">${Utils.escaparHtml(codControl)}</span>
        ${prefijos[rol]}
        <span class="checkbox-item__label">${Utils.escaparHtml(desc)}</span>
      </div>`;
  }

  function _htmlJustificacionItem(justif) {
    const ctrl = Config.getControl(justif.control);
    const desc = ctrl ? ctrl.descripcion : justif.control;
    let fechaStr = '';
    if (justif.registradoEn) {
      try {
        const d = new Date(justif.registradoEn);
        fechaStr = d.toLocaleString('es-CO', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });
      } catch { fechaStr = justif.registradoEn; }
    }
    return `
      <div class="resumen-item-justif">
        <div class="resumen-item-justif__header">
          <span class="checkbox-item__code">${Utils.escaparHtml(justif.control)}</span>
          <span class="control-badge control-badge--eliminado">✗ Justificado</span>
          <span class="checkbox-item__label" style="text-decoration:line-through;opacity:.7;">${Utils.escaparHtml(desc)}</span>
        </div>
        <div class="resumen-item-justif__texto">
          "${Utils.escaparHtml(justif.justificacion)}"
          ${fechaStr ? `<span class="resumen-justif-fecha">${fechaStr}</span>` : ''}
        </div>
      </div>`;
  }

  function _htmlPasoResumen(paso, idx) {
    const idEsc       = Utils.escaparHtml(paso.id);
    const completitud = UICompletitud.evaluar(paso);
    const badgeComp   = completitud.estado === 'completo'
      ? `<span class="badge badge--success">✓ Completo</span>`
      : `<span class="badge badge--warning">${Utils.escaparHtml(completitud.texto)}</span>`;

    const tituloDesc = paso.descripcion.trim()
      ? Utils.escaparHtml(paso.descripcion.substring(0, 60) + (paso.descripcion.length > 60 ? '…' : ''))
      : '<em style="color:var(--color-text-muted)">Sin descripción</em>';

    // Peligros
    const peligrosHtml = (paso.peligros || []).length > 0
      ? (paso.peligros.map(cod => {
          const p    = Config.getPeligro(cod);
          const desc = p ? p.descripcion : cod;
          const crit = Matrix.criticidadPeligro(cod);
          return `
            <div class="resumen-item-peligro">
              <span class="checkbox-item__code">${Utils.escaparHtml(cod)}</span>
              ${crit ? `<span class="criticidad criticidad--${crit.toLowerCase()}">${crit}</span>` : ''}
              <span class="checkbox-item__label">${Utils.escaparHtml(desc)}</span>
            </div>`;
        }).join(''))
      : '<p class="resumen-vacio">Sin peligros seleccionados</p>';

    // Controles activos
    const controlesHtml = (paso.controles || []).length > 0
      ? paso.controles.map(cod => _htmlControlItem(cod, paso)).join('')
      : '<p class="resumen-vacio">Sin controles seleccionados</p>';

    // Justificaciones (controles eliminados)
    const justifs      = paso.justificaciones || [];
    const justifHtml   = justifs.length > 0
      ? `<div class="resumen-subbloque resumen-subbloque--justif">
           <h5 class="resumen-subbloque__titulo">Controles Eliminados con Justificación</h5>
           ${justifs.map(_htmlJustificacionItem).join('')}
         </div>` : '';

    return `
      <div class="resumen-paso" id="resumen-paso-${idEsc}">
        <div class="resumen-paso__header"
          data-resumen-toggle="${idEsc}"
          role="button" tabindex="0"
          aria-expanded="false">
          <div class="resumen-paso__num">${paso.numero}</div>
          <div class="resumen-paso__meta">
            <div class="resumen-paso__titulo">${tituloDesc}</div>
            <div class="resumen-paso__counters">
              <span class="step-counter">${(paso.peligros||[]).length} peligros</span>
              <span class="step-counter" style="color:var(--color-text-muted);">|</span>
              <span class="step-counter">${(paso.controles||[]).length} controles</span>
              ${justifs.length > 0 ? `<span class="step-counter" style="color:var(--color-warning);">| ${justifs.length} justif.</span>` : ''}
            </div>
          </div>
          ${badgeComp}
          <span class="resumen-paso__arrow"></span>
        </div>
        <div class="resumen-paso__body" id="resumen-cuerpo-${idEsc}" hidden>
          <div class="resumen-subbloque">
            <h5 class="resumen-subbloque__titulo">Peligros Identificados</h5>
            ${peligrosHtml}
          </div>
          <div class="resumen-subbloque">
            <h5 class="resumen-subbloque__titulo">Medidas Preventivas y de Control</h5>
            ${controlesHtml}
          </div>
          ${justifHtml}
        </div>
      </div>`;
  }

  function _htmlPasos() {
    const pasos   = State.get('pasos') || [];
    const resumen = UICompletitud.resumenGlobal();
    if (pasos.length === 0) {
      return `<div class="empty-state" style="padding:var(--space-6) 0;">
        <p class="empty-state__title">Sin pasos definidos</p>
      </div>`;
    }

    const leyenda = `
      <div class="controles-leyenda" style="margin-bottom:var(--space-3);">
        <span><span class="control-badge control-badge--obligatorio">🔒</span> Obligatorio</span>
        <span><span class="control-badge" style="background:var(--color-info-bg);color:var(--color-info);border:1px solid var(--color-info-border);">➕</span> Manual</span>
        <span><span class="control-badge control-badge--eliminado">✗</span> Justificado</span>
      </div>`;

    const btnExpandir = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:var(--space-3);gap:var(--space-2);">
        <button type="button" class="btn-secondary" id="btn-resumen-expandir-todo" style="font-size:var(--text-xs);min-height:36px;padding:var(--space-2) var(--space-3);">
          Expandir todos
        </button>
        <button type="button" class="btn-secondary" id="btn-resumen-colapsar-todo" style="font-size:var(--text-xs);min-height:36px;padding:var(--space-2) var(--space-3);">
          Colapsar todos
        </button>
      </div>`;

    return `
      <div class="resumen-bloque">
        <h3 class="resumen-bloque__titulo">Pasos de la Tarea
          <span style="font-weight:400;color:var(--color-text-muted);">
            (${resumen.completos} completo${resumen.completos !== 1 ? 's' : ''} · ${resumen.pendientes} pendiente${resumen.pendientes !== 1 ? 's' : ''})
          </span>
        </h3>
        ${leyenda}
        ${btnExpandir}
        <div id="resumen-pasos-lista">
          ${pasos.map((p, i) => _htmlPasoResumen(p, i)).join('')}
        </div>
      </div>`;
  }

  // ── Eventos del resumen ───────────────────────────────────
  function _bindEventos() {
    if (_listenersBound) return;
    const body = Utils.$el(BODY_ID);
    if (!body) return;

    body.addEventListener('click', e => {
      const header = e.target.closest('[data-resumen-toggle]');
      if (header) {
        const id    = header.dataset.resumenToggle;
        const cuerpo = document.getElementById(`resumen-cuerpo-${id}`);
        if (!cuerpo) return;
        const abierto = cuerpo.hasAttribute('hidden');
        cuerpo.toggleAttribute('hidden');
        header.setAttribute('aria-expanded', String(abierto));
        header.classList.toggle('resumen-paso__header--open', abierto);
        return;
      }

      const btnExpandir = e.target.closest('#btn-resumen-expandir-todo');
      if (btnExpandir) {
        body.querySelectorAll('.resumen-paso__body').forEach(el => {
          el.removeAttribute('hidden');
        });
        body.querySelectorAll('[data-resumen-toggle]').forEach(el => {
          el.setAttribute('aria-expanded', 'true');
          el.classList.add('resumen-paso__header--open');
        });
        return;
      }

      const btnColapsar = e.target.closest('#btn-resumen-colapsar-todo');
      if (btnColapsar) {
        body.querySelectorAll('.resumen-paso__body').forEach(el => {
          el.setAttribute('hidden', '');
        });
        body.querySelectorAll('[data-resumen-toggle]').forEach(el => {
          el.setAttribute('aria-expanded', 'false');
          el.classList.remove('resumen-paso__header--open');
        });
        return;
      }
    });

    body.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const header = e.target.closest('[data-resumen-toggle]');
      if (header) { e.preventDefault(); header.click(); }
    });

    _listenersBound = true;
  }

  /* Fase 1.8A — Bloque de supervisión consolidada (presentación pura).
     Consume EXCLUSIVAMENTE el resultado de AuditoriaConsolidada.evaluarGlobal()
     que se recibe como argumento (CA-1.8A.9: una sola invocación por render,
     hecha en render() y reutilizada aquí). NO recalcula completitud, coherencia
     ni obligatorios; NO llama a Matrix, Coherencia ni UICompletitud. Reutiliza
     _badge y _fila (sin componentes nuevos). Informativo: no bloquea, sin %. */
  function _htmlSupervision(auditoria) {
    if (!auditoria) return '';
    const { completitud, coherencia, ttValido, unidades } = auditoria;

    // Sección: resumen global (reutiliza _fila)
    const c = completitud || { completos: 0, pendientes: 0, total: 0 };
    const filasGlobal =
      _fila('Pasos completos',  `${c.completos} de ${c.total}`) +
      _fila('Pasos pendientes', String(c.pendientes), c.pendientes > 0) +
      _fila('Tipo de Trabajo declarado', ttValido ? 'Sí' : 'No', !ttValido);

    // Sección: coherencia (reutiliza _badge)
    const badgeCoh = coherencia && coherencia.coherente
      ? _badge('Coherente', 'success')
      : _badge('Revisar coherencia', 'warning');
    const detalleCoh = (coherencia && !coherencia.coherente)
      ? _fila('TT usados sin declarar', (coherencia.usadosSinDeclarar || []).join(', ') || '—',
              (coherencia.usadosSinDeclarar || []).length > 0) +
        _fila('TT declarados sin usar', (coherencia.declaradosSinUsar || []).join(', ') || '—',
              (coherencia.declaradosSinUsar || []).length > 0)
      : '';

    // Sección: unidades auditadas + hallazgos (CA-1.8A.10: vacío explícito)
    let htmlUnidades;
    if (!unidades || unidades.length === 0) {
      htmlUnidades = `<p class="resumen-vacio">Sin unidades auditadas</p>`;
    } else {
      htmlUnidades = unidades.map(u => {
        let estadoBadge;
        if (u.sinUso)        estadoBadge = _badge('Sin uso en pasos', 'warning');
        else if (u.completa) estadoBadge = _badge('Completa', 'success');
        else                 estadoBadge = _badge('Con faltantes', 'warning');
        // Hallazgos por paso (faltantes) — solo si los hay
        const hallazgos = (u.porPaso || [])
          .filter(p => p.faltantes && p.faltantes.length > 0)
          .map(p => _fila(`Paso ${p.pasoIndex + 1} — faltantes`,
                          p.faltantes.join(', '), true))
          .join('');
        return `
          <div class="resumen-unidad">
            <div class="resumen-unidad__cab">
              <span class="resumen-unidad__cod">${Utils.escaparHtml(u.peligroTT)}</span>
              ${estadoBadge}
              <span class="resumen-unidad__pasos">${u.pasosConUnidad} paso(s)</span>
            </div>
            ${hallazgos}
          </div>`;
      }).join('');
    }

    return `
      <div class="resumen-bloque">
        <h3 class="resumen-bloque__titulo">Supervisión consolidada</h3>
        ${filasGlobal}
        <div class="resumen-row" style="margin-top:var(--space-2);">
          <span class="summary-row__label">Coherencia TT</span> ${badgeCoh}
        </div>
        ${detalleCoh}
        <h4 style="margin-top:var(--space-3);">Unidades auditadas</h4>
        ${htmlUnidades}
      </div>`;
  }

  function render() {
    const body = Utils.$el(BODY_ID);
    if (!body) return;
    // CA-1.8A.9 — UNA sola invocación a evaluarGlobal() por render; resultado
    // reutilizado localmente por el helper de supervisión.
    const auditoria = AuditoriaConsolidada.evaluarGlobal();
    body.innerHTML = `
      <div class="resumen-contenedor">
        ${_htmlGeneral()}
        ${_htmlResponsables()}
        ${_htmlUbicacion()}
        ${_htmlSenales()}
        ${_htmlPasos()}
        ${_htmlSupervision(auditoria)}
      </div>`;
    _bindEventos();
  }

  State.on('reset', render);
  // DEFECTO 2 — El Resumen Técnico debe recalcularse al agregar, editar o
  // eliminar pasos. Antes solo escuchaba 'reset', por lo que quedaba
  // desincronizado tras mutaciones de pasos (que emiten 'pasos:update').
  State.on('pasos:update', render);

  return { render };
})();


/* ───────────────────────────────────────────────────────────────
   UI.Aprobacion — SF-10 Aprobación HSE
   El supervisor HSE registra nombre, observaciones y decisión.
   Controla habilitación del botón PDF en App.
   Si el formulario cambia tras aprobar, se resetea la aprobación.
──────────────────────────────────────────────────────────────── */
const UIAprobacion = (() => {

  const BODY_ID   = 'body-aprobacion';
  const STATUS_ID = 'status-aprobacion';
  let _listenersBound = false;  // guard — SF C1

  // ── HTML ──────────────────────────────────────────────────
  function _html(datos) {
    const { nombreSupervisor, observaciones, estado } = datos;
    const aprobado    = estado === 'aprobado';
    const correccion  = estado === 'requiere_correccion';

    return `
      <div class="field-group">

        <div class="field">
          <label class="field__label field__label--required" for="inp-supervisor">
            Nombre Supervisor HSE
          </label>
          <input
            type="text"
            id="inp-supervisor"
            class="field__input"
            value="${Utils.escaparHtml(nombreSupervisor || '')}"
            placeholder="Nombre completo del supervisor"
            maxlength="100"
            autocomplete="off"
            inputmode="text"
          >
        </div>

        <div class="field">
          <label class="field__label" for="inp-observaciones">
            Observaciones
            <span style="font-weight:400;color:var(--color-text-muted);">(opcional)</span>
          </label>
          <textarea
            id="inp-observaciones"
            class="field__textarea"
            placeholder="Condiciones, restricciones o notas para el registro…"
            maxlength="500"
            rows="3"
          >${Utils.escaparHtml(observaciones || '')}</textarea>
          <p class="field__hint">Máximo 500 caracteres</p>
        </div>

        <div class="field">
          <p class="field__label field__label--required" style="margin-bottom:var(--space-3);">
            Decisión del Supervisor HSE
          </p>
          <div class="approval-options">

            <div class="radio-option">
              <input type="radio" name="decision-hse" id="radio-aprobado"
                value="aprobado" ${aprobado ? 'checked' : ''}>
              <label class="radio-option__label radio-option__label--approve"
                for="radio-aprobado">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                  stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Aprobar
              </label>
            </div>

            <div class="radio-option">
              <input type="radio" name="decision-hse" id="radio-correccion"
                value="requiere_correccion" ${correccion ? 'checked' : ''}>
              <label class="radio-option__label radio-option__label--reject"
                for="radio-correccion">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Requiere Corrección
              </label>
            </div>

          </div>
        </div>

        <div class="approval-status ${aprobado ? 'approval-status--approved' : correccion ? 'approval-status--rejected' : 'approval-status--pending'}"
          id="aprobacion-status-banner">
          ${_htmlBanner(datos)}
        </div>

      </div>`;
  }

  function _htmlBanner(datos) {
    const { nombreSupervisor, estado } = datos;
    if (estado === 'aprobado') {
      const nombre = nombreSupervisor.trim() || 'Supervisor';
      return `✅ Aprobado por: ${Utils.escaparHtml(nombre)} — Formulario listo para generar PDF.`;
    }
    if (estado === 'requiere_correccion') {
      return `⚠ Requiere corrección — La generación de PDF está bloqueada hasta nueva aprobación.`;
    }
    return `⬤ Pendiente de decisión del Supervisor HSE.`;
  }

  // ── Sincronización de campos ──────────────────────────────
  function _actualizarStatus() {
    const datos = State.get('aprobacion') || {};
    const { nombreSupervisor, estado } = datos;

    if (estado === 'aprobado' && nombreSupervisor.trim().length >= 3) {
      Utils.renderStatus(STATUS_ID, 'ok', '✓ Aprobado');
    } else if (estado === 'requiere_correccion') {
      Utils.renderStatus(STATUS_ID, 'warning', '⚠ Requiere corrección');
    } else {
      Utils.renderStatus(STATUS_ID, 'neutral', 'Pendiente');
    }
  }

  function _actualizarBanner() {
    const el = Utils.$el('aprobacion-status-banner');
    if (!el) return;
    const datos = State.get('aprobacion') || {};
    el.textContent = _htmlBanner(datos);
    el.className = `approval-status ${
      datos.estado === 'aprobado'             ? 'approval-status--approved'
      : datos.estado === 'requiere_correccion' ? 'approval-status--rejected'
      : 'approval-status--pending'
    }`;
  }

  // ── Eventos ───────────────────────────────────────────────
  function _bindEventos() {
    if (_listenersBound) return;
    const body = Utils.$el(BODY_ID);
    if (!body) return;

    body.addEventListener('input', e => {
      if (e.target.id === 'inp-supervisor') {
        State.set('aprobacion.nombreSupervisor', e.target.value);
        _actualizarStatus();
        App.actualizarBtnPDF();
      }
      if (e.target.id === 'inp-observaciones') {
        State.set('aprobacion.observaciones', e.target.value);
      }
    });

    body.addEventListener('change', e => {
      const radio = e.target.closest('input[name="decision-hse"]');
      if (!radio) return;
      State.set('aprobacion.estado', radio.value);
      _actualizarBanner();
      _actualizarStatus();
      App.actualizarBtnPDF();
    });

    _listenersBound = true;
  }

  function render() {
    const body = Utils.$el(BODY_ID);
    if (!body) return;
    const datos = State.get('aprobacion') || {};
    body.innerHTML = _html(datos);
    _bindEventos();
    _actualizarStatus();
  }

  function validar() {
    const datos = State.get('aprobacion') || {};
    return datos.estado === 'aprobado' &&
           (datos.nombreSupervisor || '').trim().length >= 3;
  }

  /**
   * Resetea la aprobación si el formulario cambia después de aprobar.
   * Llamado desde App cuando detecta State.on('change') con estado = 'aprobado'.
   * Solo resetea si el cambio no provino de la propia sección de aprobación.
   */
  function resetearSiAprobado(claveModificada) {
    const aprobacionClaves = [
      'aprobacion.nombreSupervisor',
      'aprobacion.observaciones',
      'aprobacion.estado'
    ];
    if (aprobacionClaves.includes(claveModificada)) return;
    if ((State.get('aprobacion.estado')) !== 'aprobado') return;

    State.set('aprobacion.estado', null, 'aprobacion:reset');
    Utils.toast(
      'Formulario modificado. El supervisor HSE debe aprobar nuevamente.',
      'warning', 4000
    );
    render();
    App.actualizarBtnPDF();
  }

  State.on('reset', render);

  return { render, validar, resetearSiAprobado };
})();


/* ───────────────────────────────────────────────────────────────
   UI.DocId — SF-11 Identificación del Documento
   Genera el nombre único del archivo (área + consecutivo).
   El consecutivo se genera al abrir la sección por primera vez.
   El nombre del archivo se persiste en State inmediatamente.
──────────────────────────────────────────────────────────────── */
const UIDocId = (() => {

  const BODY_ID   = 'body-docid';
  const STATUS_ID = 'status-docid';
  let _listenersBound = false;  // guard — SF C1

  // ── HTML ──────────────────────────────────────────────────
  function _html(datos) {
    const { areaEjecutora, consecutivo, nombreArchivo, modoPDF } = datos;
    const areas = Config.get('areasEjecutoras') || [];
    const optsAreas = areas.map(a =>
      `<option value="${Utils.escaparHtml(a.codigo)}"
        ${a.codigo === areaEjecutora ? 'selected' : ''}>
        ${Utils.escaparHtml(a.codigo)} — ${Utils.escaparHtml(a.descripcion)}
       </option>`
    ).join('');

    const prevNombre = nombreArchivo && nombreArchivo.trim()
      ? Utils.escaparHtml(nombreArchivo)
      : `<span style="color:var(--color-text-muted)">---</span>`;

    return `
      <div class="field-group">

        <div class="field">
          <label class="field__label field__label--required" for="sel-area-ejecutora">
            Área Ejecutora
          </label>
          <select id="sel-area-ejecutora" class="field__select" aria-required="true">
            <option value="">Seleccione área…</option>
            ${optsAreas}
          </select>
        </div>

        <div class="field">
          <label class="field__label field__label--required" for="inp-consecutivo">
            Consecutivo
          </label>
          <div style="display:flex;gap:var(--space-2);align-items:center;">
            <input
              type="text"
              id="inp-consecutivo"
              class="field__input"
              value="${Utils.escaparHtml(consecutivo || '')}"
              placeholder="DDMMAA-HHMM"
              maxlength="20"
              autocomplete="off"
              style="flex:1;"
            >
            <button type="button" class="btn-secondary" id="btn-regenerar-consec"
              title="Regenerar con hora actual"
              style="min-height:var(--touch-min);padding:var(--space-3);flex-shrink:0;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
              </svg>
            </button>
          </div>
          <p class="field__hint">
            Generado automáticamente (DDMMAA-HHMM). Editable si requiere ajuste manual.
          </p>
        </div>

        <div class="field">
          <p class="field__label" style="margin-bottom:var(--space-3);">
            Modo de Generación PDF
          </p>
          <div class="pdf-mode-selector">
            <div class="pdf-mode-option">
              <input type="radio" name="modo-pdf" id="radio-corp"
                value="corporativo" ${modoPDF !== 'operativo' ? 'checked' : ''}>
              <label class="pdf-mode-option__label" for="radio-corp">
                Corporativo
                <span class="pdf-mode-option__hint">Solo códigos — formato FM-HSE-022</span>
              </label>
            </div>
            <div class="pdf-mode-option">
              <input type="radio" name="modo-pdf" id="radio-oper"
                value="operativo" disabled>
              <label class="pdf-mode-option__label" for="radio-oper">
                Operativo
                <span class="pdf-mode-option__hint">[Próximamente]</span>
              </label>
            </div>
          </div>
        </div>

        <div class="doc-id-preview" id="docid-preview">
          <div style="flex:1;">
            <p class="doc-id-preview__label">Vista previa del nombre</p>
            <p class="doc-id-preview__filename" id="docid-nombre-preview">
              ${prevNombre}
            </p>
            <p class="field__hint" style="margin-top:var(--space-2);">
              Archivo: <span id="docid-archivo-hint">${Utils.escaparHtml(nombreArchivo || '---')}.pdf</span>
            </p>
          </div>
        </div>

      </div>`;
  }

  // ── Recalculo de nombreArchivo ────────────────────────────
  function _recalcularNombre() {
    const area   = State.get('identificacion.areaEjecutora') || '';
    const consec = (State.get('identificacion.consecutivo') || '').trim();

    let nombre = '';
    if (area && consec)       nombre = `${area}-${consec}`;
    else if (area)            nombre = `${area}-`;
    else if (consec)          nombre = `---${consec}`;

    State.set('identificacion.nombreArchivo', nombre);

    // Actualizar vista previa sin re-renderizar
    const prevEl   = Utils.$el('docid-nombre-preview');
    const hintEl   = Utils.$el('docid-archivo-hint');
    if (prevEl) prevEl.innerHTML = nombre || '<span style="color:var(--color-text-muted)">---</span>';
    if (hintEl) hintEl.textContent = (nombre || '---') + '.pdf';

    _actualizarStatus(area, consec);
    App.actualizarBtnPDF();
  }

  function _actualizarStatus(area, consec) {
    if (area && consec) {
      Utils.renderStatus(STATUS_ID, 'ok', `✓ ${Utils.escaparHtml(area)}-${Utils.escaparHtml(consec)}`);
    } else {
      Utils.renderStatus(STATUS_ID, 'warning', '⚠ Incompleto');
    }
  }

  // ── Eventos ───────────────────────────────────────────────
  function _bindEventos() {
    if (_listenersBound) return;
    const body = Utils.$el(BODY_ID);
    if (!body) return;

    body.addEventListener('change', e => {
      const el = e.target;
      if (el.id === 'sel-area-ejecutora') {
        State.set('identificacion.areaEjecutora', el.value);
        _recalcularNombre();
      }
      const radio = el.closest('input[name="modo-pdf"]');
      if (radio && !radio.disabled) {
        State.set('identificacion.modoPDF', radio.value);
      }
    });

    body.addEventListener('input', e => {
      const el = e.target;
      if (el.id === 'inp-consecutivo') {
        const limpio = el.value.replace(/\s/g, '');
        el.value = limpio;
        State.set('identificacion.consecutivo', limpio);
        _recalcularNombre();
      }
    });

    body.addEventListener('click', async e => {
      const btn = e.target.closest('#btn-regenerar-consec');
      if (btn) {
        const actual = State.get('identificacion.consecutivo') || '';
        if (actual.trim()) {
          const ok = await Modal.confirmar(
            'Regenerar consecutivo',
            `El consecutivo actual "${actual}" se reemplazará con la hora actual. ¿Continuar?`,
            { labelOk: 'Regenerar', peligroso: false }
          );
          if (!ok) return;
        }
        const nuevo = Utils.generarConsecutivo();
        State.set('identificacion.consecutivo', nuevo);
        const inp = Utils.$el('inp-consecutivo');
        if (inp) inp.value = nuevo;
        _recalcularNombre();
      }
    });

    _listenersBound = true;
  }



  // ── Inicialización del consecutivo ────────────────────────
  function _inicializarConsecutivo() {
    const actual = State.get('identificacion.consecutivo') || '';
    if (!actual.trim()) {
      const generado = Utils.generarConsecutivo();
      State.set('identificacion.consecutivo', generado);
      return generado;
    }
    return actual;
  }

  function render() {
    const body = Utils.$el(BODY_ID);
    if (!body) return;

    // Generar consecutivo si no existe (primera vez que se abre la sección)
    _inicializarConsecutivo();

    const datos = {
      areaEjecutora: State.get('identificacion.areaEjecutora') || '',
      consecutivo:   State.get('identificacion.consecutivo')   || '',
      nombreArchivo: State.get('identificacion.nombreArchivo') || '',
      modoPDF:       State.get('identificacion.modoPDF')       || 'corporativo'
    };

    body.innerHTML = _html(datos);
    _bindEventos();
    _recalcularNombre();
  }

  function validar() {
    const area   = State.get('identificacion.areaEjecutora') || '';
    const consec = State.get('identificacion.consecutivo')   || '';
    return !!(area.trim() && consec.trim());
  }

  State.on('reset', render);

  return { render, validar };
})();


/* ───────────────────────────────────────────────────────────────
   PRINT — SF-12/SF-18/SF-19 Generación PDF con jsPDF
   Arquitectura: DD-01 a DD-07 + AJ-01 a AJ-04 (aprobadas)

   Decisiones fijas:
   · Catálogo peligros → desde Config (peligros.json)   [AJ-01]
   · Guía controles   → desde Config (controles.json)   [AJ-02]
   · Fuente única de datos JSON → Config → PDF           [AJ-03]
   · Logo con aspect-ratio preservado                    [AJ-04]
   · Máximo 8 responsables                               [DD-02]
   · Catálogo y guía son contenido fijo en Pág. 1       [DD-03/04]
   · Página 2+ solo Ítem|Paso|Ítem|Peligros|Ítem|Ctrl   [DD-05]
   · Solo códigos en Pág. 2                              [DD-06]
   · ITEM = paso.numero (único origen)
──────────────────────────────────────────────────────────────── */
const Print = (() => {

  // ── Layout — Fase 5C.6: medidas exactas DOCX maestro (FINAL) ───
  // Fuente: FORMATO_FM_HSE_022_DIMENSIONES.md + TYPOGRAPHY.md
  // Sin estimaciones. Sin aproximaciones visuales.
  const L = {
    // Página — Letter Landscape
    pw: 279.4, ph: 215.9,
    ml: 12.7,  mr: 12.7, mt: 12.7, mb: 12.7,
    footerH: 7.0,
    get aw()      { return this.pw - this.ml - this.mr; },
    get contentH(){ return this.ph - this.mt - this.mb; },

    // Columnas Pág 1 — DOCX exacto
    p1ColW: 76.3411,
    tblW:   79.00,
    tblGap: 3.53,
    ctlNumColW: 4.0,
    ctlNumGap:  0.8,
    ctlHang:    6.297,
    ctlLeft:    12.594,
    szCtlNum:   8,
    ctlEmptyPara: 1.94,
    p1Gap:  12.4883,
    get p1C2X(){ return this.ml + this.p1ColW + this.p1Gap; },
    get p1C3X(){ return this.ml + this.p1ColW*2 + this.p1Gap*2; },

    // Encabezado (Tabla 0) — DOCX exacto
    hdrH:       15.52,
    hdrRowH:     3.8806,
    logoCol:    15.6104,
    titleCol:   34.1313,
    metaLblCol: 12.4354,
    metaValCol: 14.5521,

    // CF-09: logo dimensiones exactas
    logoW: 13.0969,
    logoH:  8.9958,

    // Responsables (Tabla 1) — DOCX exacto
    rNomW: 31.9969, rCedW: 23.0011, rFirW: 24.0065,
    rRowH:  4.9918,
    rRow8:  4.2333,
    rRow9:  3.9688,
    rRows:  8,

    // Punto encuentro / Ducha (Tabla 2) — DOCX exacto
    ptLblH: 2.9986,
    ptValH: 4.992,
    dlValH: 4.992,

    // Señales (Tabla 3) — CF-04 DOCX exacto
    spColL:  39.5288,
    spColR:  39.4758,
    spHdrH:   2.9986,
    spInstrH: 8.9958,
    spRowH:   4.9918,
    spLastH:  3.3514,

    // CF-08: Padding real Word (default tblCellMar)
    padL: 1.9, padR: 1.9, padT: 0.0, padB: 0.0,

    // Catálogo peligros (Tabla 4) — CF-03 DOCX exacto
    pelSubL: 39.4935,
    pelSubR: 39.5111,
    pelHdrH:  7.0026,
    pelRowH:  3.792,
    pelItemH: 3.493,

    // Guía controles (Tabla 5) — CF-05 DOCX exacto
    ctlNumW:  9.9131,
    ctlDescW: 69.0915,
    ctlHdrH:  3.4396,
    ctlRowH:  2.9986,

    // Página 2 — alineada con columnas DOCX
    get p2B1X(){ return this.ml; },
    get p2B2X(){ return this.p1C2X; },
    get p2B3X(){ return this.p1C3X; },
    p2BW:   76.3411,
    p2ItmW:  9.5,
    get p2ContW(){ return this.p2BW - this.p2ItmW; },
    p2HdrH:  5.997,
    p2RowH: 19.403,
    p2Rows:  9,

    // Tipografías — valores AN (generador_html.py / ESPECIFICACION AN / Word AN)
    szEncHdr:    10,
    szMetaLbl:    7,
    szMetaVal:    6.5,
    szCampo:      10,
    szComp:       9,
    szResp:       10,
    szPtEnc:      10,
    szSenHdr:     10,
    szSenInstr:   9,
    szSenTxt:     8.5,
    szPelTitulo:  8.5,
    szPelCat:     7.5,
    szPelItem:    7,
    szPelDesc:    7,
    szCtlHdr:     8,
    szCtlDesc:    7.5,
    szFooter:     8,
    szFooterPag:  7,
    szTblHdr:     10,
    szTblItem:    8,
    szTblCont:    9,

    // CF-07: Leading exacto DOCX (font_pt × 1.2 × 0.352778mm)
    lh7:   2.963,
    lh75:  3.175,
    lh8:   3.387,
    lh9:   3.810,
    lh10:  4.233,

    // Bordes — DOCX single/0.5pt
    lwExt: 0.5,
    lwInt: 0.3,
    // Casilla vectorial AN (.cbox: 2x2mm, borde 0.2mm) — R2 reconstrucción AN
    cbSize: 2.0, cbLine: 0.2, cbCheck: 0.35, cbRise: 0.55,
    // Factor de cap-height (Arial Narrow) para centrado vertical de celdas (vAlign=center AN)
    capFactor: 0.72,
    cellPadV: 0.5,

    // Colores
    cHdrBg:  [0, 48, 87],
    cHdrFg:  [255, 255, 255],
    cSecBg:  [173, 198, 222],
    cBorder: [0, 0, 0],
    cText:   [0, 0, 0],
    cFooter: [80, 80, 80],
    cLine:   [170, 170, 170],
    cWhite:  [255, 255, 255],

    get footerY(){ return this.ph - this.mb + 1.5; }
  };

    // ── Variables de sesión de renderizado ───────────────────
  let _doc = null;
  let _blobURL = null;
  let _genTimestamp = '';

  // ── Helpers de dibujo ────────────────────────────────────

  // Fuentes disponibles en el documento (se actualizan al cargar)
  let _arialNarrowLoaded = false;

  function _setFont(style, size, color, useNarrow = false) {
    // useNarrow: usar Arial Narrow (fuente oficial del DOCX maestro)
    //            si no está cargada, fallback a Helvetica
    if (useNarrow && _arialNarrowLoaded) {
      _doc.setFont('ArialNarrow', style || 'normal');
    } else {
      _doc.setFont('helvetica', style || 'normal');
    }
    if (size)  _doc.setFontSize(size);
    if (color) _doc.setTextColor(...color);
  }

  function _setFontNarrow(style, size, color) {
    _setFont(style, size, color, true);
  }

  function _rect(x, y, w, h, fillColor, strokeColor) {
    if (fillColor) {
      _doc.setFillColor(...fillColor);
      _doc.rect(x, y, w, h, strokeColor ? 'FD' : 'F');
    } else {
      _doc.setDrawColor(...(strokeColor || L.cBorder));
      _doc.rect(x, y, w, h, 'S');
    }
    _doc.setDrawColor(...L.cBorder);
  }

  function _text(txt, x, y, opts) {
    _doc.text(String(txt || ''), x, y, opts || {});
  }

  /**
   * Baseline para CENTRAR verticalmente texto en una celda (replica el
   * vAlign=center del Word AN, presente en las 174 celdas del documento).
   * @param topCelda  borde superior de la celda (mm)
   * @param altoCelda altura de la celda (mm)
   * @param fontPt    tamaño de fuente del texto (pt)
   * @returns coordenada Y del baseline (mm)
   */
  function _vbase(topCelda, altoCelda, fontPt) {
    const capH = fontPt * 0.352778 * L.capFactor; // cap-height aprox. Arial Narrow
    return topCelda + altoCelda / 2 + capH / 2;
  }

  /** Escribe texto con wrap dentro de una celda y retorna el alto real usado */
  function _cellText(txt, x, y, w, size, style, color) {
    _setFont(style || 'normal', size || L.szNorm, color || L.cText);
    const lines = _doc.splitTextToSize(String(txt || ''), w - L.tPadL * 2);
    const lineH = (size || L.szNorm) * 0.352778 * 1.35; // pt → mm × leading
    lines.forEach((line, i) => {
      _text(line, x + L.tPadL, y + L.tPadH + lineH * (i + 0.75));
    });
    return Math.max(L.tMinH, L.tPadH * 2 + lines.length * lineH);
  }

  /** Dibuja una línea horizontal */
  function _hline(x, y, w, color) {
    _doc.setDrawColor(...(color || L.cBorder));
    _doc.line(x, y, x + w, y);
    _doc.setDrawColor(...L.cBorder);
  }

  /**
   * Casilla de verificación vectorial (reemplaza glifos Unicode ☐/☑ que
   * Helvetica/Arial Narrow no contienen). Réplica de la casilla AN
   * (.cbox del generador_html: cuadro 2x2mm + palomita cuando está marcada).
   * @param x  coordenada X (mm) del borde izquierdo del cuadro
   * @param yBaseline  baseline del texto adyacente (mm); el cuadro se centra sobre ella
   * @param sel  true si está marcada (dibuja la palomita)
   */
  function _checkbox(x, yBaseline, sel) {
    const s = L.cbSize;                 // lado del cuadro (mm)
    const top = yBaseline - s + L.cbRise; // alinear el cuadro con el texto
    _doc.setLineWidth(L.cbLine);
    _doc.setDrawColor(...L.cBorder);
    _doc.rect(x, top, s, s, 'S');       // contorno del cuadro
    if (sel) {                          // palomita vectorial (dos trazos)
      _doc.setLineWidth(L.cbCheck);
      const x1 = x + s * 0.18, y1 = top + s * 0.52;
      const x2 = x + s * 0.42, y2 = top + s * 0.78;
      const x3 = x + s * 0.84, y3 = top + s * 0.20;
      _doc.line(x1, y1, x2, y2);
      _doc.line(x2, y2, x3, y3);
    }
    _doc.setLineWidth(L.lwInt);
  }

  /** Posición X de inicio del área útil */
  function _x0() { return L.ml; }

  // ── Encabezado — CF-01/CF-02/CF-09 ─────────────────────────────

  function _dibujarEncabezado(logoData) {
    const x = L.ml, y = L.mt, w = L.p1ColW, h = L.hdrH;
    _doc.setLineWidth(L.lwExt); _doc.setDrawColor(...L.cBorder);
    _doc.rect(x, y, w, h, 'S');

    // CF-09: logo dimensiones exactas del DOCX (13.0969×8.9958mm)
    if (logoData && logoData.uri) {
      try {
        const fmt = logoData.mime || 'PNG';
        const offX = x + (L.logoCol - L.logoW) / 2;
        const offY = y + (h - L.logoH) / 2;
        _doc.addImage(logoData.uri, fmt, offX, offY, L.logoW, L.logoH, undefined, 'FAST');
      } catch(e) {}
    }
    _doc.setLineWidth(L.lwInt); _doc.setDrawColor(...L.cBorder);
    _doc.line(x + L.logoCol, y, x + L.logoCol, y + h);

    // Título — Arial Narrow Bold 10pt, centrado H+V
    const titX = x + L.logoCol, titW = L.titleCol;
    _setFontNarrow('bold', L.szEncHdr, L.cText);
    const TITULO = ['ANÁLISIS CONTINUO', 'DE PELIGROS POR', 'LA TAREA'];
    const totalHT = TITULO.length * L.lh10;
    const y0 = y + (h - totalHT) / 2 + L.lh10 * 0.78;
    TITULO.forEach((ln, i) => _text(ln, titX + titW / 2, y0 + i * L.lh10, { align: 'center' }));

    // Línea vertical título|etiqueta
    const mx = x + L.logoCol + L.titleCol;
    _doc.setLineWidth(L.lwInt);
    _doc.line(mx, y, mx, y + h);

    // CF-01: valores metadatos con alineación CENTER
    const valX = mx + L.metaLblCol;
    _doc.line(valX, y, valX, y + h);

    const docCfg = Config.get('empresa') || {};
    const metas = [
      ['Código:',   docCfg.documentoCodigo   || 'FM-HSE-022'],
      ['Página:',   'Pie de pág.'],
      ['Revisión:', docCfg.documentoRevision || '1'],
      ['Fecha:',    docCfg.documentoFecha    || '11-mar-2026'],
    ];
    const capH7 = L.szMetaLbl * 0.352778 * 0.72;
    const vOff  = L.hdrRowH / 2 + capH7 / 2;

    metas.forEach(([lbl, val], i) => {
      const rowY = y + i * L.hdrRowH;
      if (i > 0) { _doc.setLineWidth(L.lwInt); _doc.line(mx, rowY, x + w, rowY); }
      _setFontNarrow('bold',   L.szMetaLbl, L.cText);
      _text(lbl, mx + L.padL, rowY + vOff);
      // CF-01: CENTER en la celda valor
      _setFontNarrow('normal', L.szMetaVal, L.cText);
      _text(val, valX + L.metaValCol / 2, rowY + vOff, { align: 'center' });
    });
  }

  // ── Información General — CF-06/CF-07 ────────────────────────

  function _dibujarInfoGeneral(general, yStart) {
    const x = L.ml; let y = yStart;
    [['Lugar', general.lugar], ['Fecha', general.fecha], ['Tarea', general.tarea]]
    .forEach(([lbl, val]) => {
      _setFontNarrow('bold',   L.szCampo, L.cText);
      _text(`${lbl}:`, x + L.padL, _vbase(y, L.lh9 + 1.5, L.szCampo));
      _setFontNarrow('normal', L.szCampo, L.cText);
      const lines = _doc.splitTextToSize(val || '', L.p1ColW - 16);
      _text(lines[0] || '', x + 16, _vbase(y, L.lh9 + 1.5, L.szCampo));
      _doc.setDrawColor(...L.cLine); _doc.setLineWidth(0.2);
      _doc.line(x + 16, y + L.lh9 + 0.5, x + L.p1ColW - L.padL, y + L.lh9 + 0.5);
      _doc.setDrawColor(...L.cBorder);
      y += L.lh9 + 1.5;
    });
    _setFontNarrow('italic', L.szComp, L.cText);
    const compL = _doc.splitTextToSize(
      'Identificar continuamente los peligros generados por la tarea y tomaré las medidas de control para prevenir accidentes',
      L.p1ColW - L.padL * 2);
    compL.slice(0, 4).forEach((ln, i) => _text(ln, x + L.padL, y + (i + 1) * L.lh9));
    return y + Math.min(compL.length, 4) * L.lh9 + 1.5;
  }

  // ── Responsables — CF-02/CF-07 ────────────────────────────────

  function _dibujarResponsables(responsables, yStart) {
    const x = L.ml; let y = yStart; const w = L.tblW;
    const NW = L.rNomW, CW = L.rCedW, FW = L.rFirW;

    _rect(x, y, w, L.lh9 + 2, L.cHdrBg);
    _setFontNarrow('bold', L.szResp, L.cHdrFg);
    _text('Responsables de la Tarea', x + w / 2, _vbase(y, L.lh9 + 2, L.szResp), { align: 'center' });
    y += L.lh9 + 2;

    _rect(x, y, w, L.lh9 + 1.5, L.cSecBg);
    _doc.setLineWidth(L.lwInt); _doc.setDrawColor(...L.cBorder);
    _doc.rect(x, y, w, L.lh9 + 1.5, 'S');
    _setFontNarrow('bold', L.szResp, L.cText);
    _text('Nombre', x + NW / 2, _vbase(y, L.lh9 + 1.5, L.szResp), { align: 'center' });
    _doc.line(x + NW, y, x + NW, y + L.lh9 + 1.5);
    _text('Cédula', x + NW + CW / 2, _vbase(y, L.lh9 + 1.5, L.szResp), { align: 'center' });
    _doc.line(x + NW + CW, y, x + NW + CW, y + L.lh9 + 1.5);
    _text('Firma', x + NW + CW + FW / 2, _vbase(y, L.lh9 + 1.5, L.szResp), { align: 'center' });
    y += L.lh9 + 1.5;

    const lista = (responsables || []).slice(0, L.rRows);
    for (let i = 0; i < L.rRows; i++) {
      const rh = i < 6 ? L.rRowH : (i === 6 ? L.rRow8 : L.rRow9);
      const r  = lista[i] || { nombre: '', cedula: '' };
      _doc.setLineWidth(L.lwInt); _doc.setDrawColor(...L.cBorder);
      _doc.rect(x, y, w, rh, 'S');
      _doc.line(x + NW, y, x + NW, y + rh);
      _doc.line(x + NW + CW, y, x + NW + CW, y + rh);
      _setFontNarrow('normal', 9, L.cText);
      if (r.nombre) _text(r.nombre.substring(0, 26), x + L.padL, _vbase(y, rh, 9));
      if (r.cedula) _text(r.cedula, x + NW + L.padL, _vbase(y, rh, 9));
      y += rh;
    }
    return y;
  }

  // ── Punto de Encuentro y Ducha — CF-02/CF-07 ─────────────────

  function _dibujarUbicacion(pe, dl, yStart) {
    const x = L.ml; let y = yStart; const w = L.tblW;
    const pairs = [
      ['Punto de encuentro cercano:', pe, L.ptLblH, L.ptValH],
      ['Ducha y lavaojos cercano:',  dl, L.ptLblH, L.dlValH],
    ];
    pairs.forEach(([lbl, val, lblH, valH]) => {
      // atLeast: la fila crece si el texto (AN10) es más alto que el mínimo
      const lblHE = Math.max(lblH, L.szPtEnc * 0.352778 + L.cellPadV);
      _rect(x, y, w, lblHE, L.cSecBg);
      _doc.setLineWidth(L.lwExt); _doc.setDrawColor(...L.cBorder);
      _doc.rect(x, y, w, lblHE, 'S');
      _setFontNarrow('bold', L.szPtEnc, L.cText);
      _text(lbl, x + L.padL, _vbase(y, lblHE, L.szPtEnc));
      y += lblHE;
      _doc.setLineWidth(L.lwInt); _doc.rect(x, y, w, valH, 'S');
      _setFontNarrow('normal', L.szPtEnc, L.cText);
      _text(val || '', x + L.padL, _vbase(y, valH, L.szPtEnc));
      y += valH;
    });
    return y;
  }

  // ── Señales para Detener la Tarea — CF-04/CF-07 ──────────────

  function _dibujarSenales(senalesParada, yStart) {
    const x = L.ml; let y = yStart; const w = L.tblW;
    const botY   = L.mt + L.contentH;
    const totalH = botY - y;
    _doc.setLineWidth(L.lwExt); _doc.setDrawColor(...L.cBorder);
    _doc.rect(x, y, w, totalH, 'S');

    const spHdrHE = Math.max(L.spHdrH, L.szSenHdr * 0.352778 + L.cellPadV);
    _rect(x, y, w, spHdrHE, L.cHdrBg);
    _setFontNarrow('bold', L.szSenHdr, L.cHdrFg);
    _text('SEÑALES PARA DETENER LA TAREA', x + w / 2, _vbase(y, spHdrHE, L.szSenHdr), { align: 'center' });
    y += spHdrHE;

    _setFontNarrow('normal', L.szSenInstr, L.cText);
    const instrW = w - L.padL * 2;
    const instrL = _doc.splitTextToSize(
      'Escoja dos o más situaciones que podrían ocurrir o que le hayan ocurrido.',
      instrW);
    const instrLh = L.szSenInstr * 0.352778 * 1.0;  // interlineado 1.0
    instrL.slice(0, 2).forEach((ln, i) =>
      _text(ln, x + L.padL, y + L.szSenInstr * 0.352778 * L.capFactor + 0.6 + i * instrLh,
        { maxWidth: instrW, align: 'justify' }));
    y += L.spInstrH;

    const catalogo = Config.get('senalesParada') || [];
    const selIds   = (senalesParada && senalesParada.seleccionadas) || [];
    const textos   = (senalesParada && senalesParada.textos) || {};
    const checks   = catalogo.filter(s => s.tipo === 'checkbox');
    const otros    = catalogo.filter(s => s.tipo === 'texto');

    // Orden EXACTO del Word AN (T3): 8 filas, distribución por filas left/right.
    // Izquierda: los primeros 8 checkbox. Derecha: los 5 checkbox restantes
    // seguidos de los 3 "Otros" al final de la columna derecha.
    const nFilas = 8;
    const colIzq = checks.slice(0, nFilas);
    const colDer = checks.slice(nFilas).concat(otros);

    // Recalcular el alto de fila para ocupar todo el alto disponible de la tabla
    const rowH = (totalH - spHdrHE - L.spInstrH) / nFilas;

    for (let i = 0; i < nFilas; i++) {
      [colIzq[i], colDer[i]].forEach((s, ci) => {
        if (!s) return;
        const sel = selIds.includes(s.id);
        const cx  = x + ci * (w / 2) + L.padL;
        _setFontNarrow('normal', L.szSenTxt, L.cText);
        // Alinear la casilla con la primera línea de texto en el rowH recalculado
        const yBaseline = _vbase(y, rowH, L.szSenTxt);
        _checkbox(cx, yBaseline, sel);
        const tx = cx + L.cbSize + 1;
        const tw = w / 2 - (L.cbSize + 1) - L.padL * 2;
        const lh = L.szSenTxt * 0.352778 * 1.15;
        if (s.tipo === 'texto') {
          // Campo "Otros": etiqueta + línea de relleno estática que llena el ancho de la celda
          const tv = textos[s.id] || '';
          _text("Otros: ", tx, yBaseline);
          const labelW = _doc.getTextWidth("Otros: ");
          const lineX = tx + labelW;
          const cellRight = x + (ci + 1) * (w / 2) - L.padR;
          _hline(lineX, yBaseline + 0.5, cellRight - lineX, [170, 170, 170]);
          if (tv) {
            _text(tv, lineX + 1, yBaseline);
          }
        } else {
          // Si el texto tiene dos líneas, la segunda queda por debajo del checkbox
          const lns = _doc.splitTextToSize(s.texto, tw).slice(0, 2);
          lns.forEach((ln, li) => _text(ln, tx, yBaseline + li * lh));
        }
      });
      y += rowH;
    }
  }

  // ── Catálogo peligros — CF-02/CF-03/CF-07 ────────────────────

  function _dibujarCatalogoPeligros(xCol, yTop) {
    const categorias = Config.getPeligrosPorCategoria();
    let y = yTop; const w = L.tblW;
    _doc.setLineWidth(L.lwExt); _doc.setDrawColor(...L.cBorder);
    _doc.rect(xCol, yTop, w, L.contentH, 'S');

    _setFontNarrow('normal', L.szPelTitulo, L.cText);
    const titL = _doc.splitTextToSize(
      'Seleccione los peligros identificados antes del desarrollo de la tarea',
      w - L.padL * 2).slice(0, 2);
    const titLh = L.szPelTitulo * 0.352778 * 1.05;
    const titY0 = y + L.pelHdrH / 2 - ((titL.length - 1) * titLh) / 2
                  + (L.szPelTitulo * 0.352778 * L.capFactor) / 2;
    titL.forEach((ln, i) => _text(ln, xCol + L.padL, titY0 + i * titLh));
    y += L.pelHdrH;

    // CF-03: sub-cols exactas del DOCX
    const SL = L.pelSubL;
    const maxW = SL - L.padL - 6.5;
    const itemLh = L.szPelDesc * 0.352778 * 1.0;

    // Preprocesar categorías y filas para calcular la altura necesaria sin escalar
    const preprocessedCat = [];
    let H_unscaled = 0;
    categorias.forEach(cat => {
      const p   = cat.peligros || [];
      const mid = Math.ceil(p.length / 2);
      const s1  = p.slice(0, mid), s2 = p.slice(mid);
      const rowHeights = [];
      const rowLines = [];
      for (let i = 0; i < Math.max(s1.length, s2.length); i++) {
        const lns = [s1[i], s2[i]].map(pp =>
          pp ? _doc.splitTextToSize(pp.descripcion, maxW).slice(0, 2) : []);
        const nMax = Math.max(1, lns[0].length, lns[1].length);
        const rowH = Math.max(L.pelItemH, nMax * itemLh + 0.6);
        rowHeights.push(rowH);
        rowLines.push(lns);
      }
      preprocessedCat.push({ cat, s1, s2, rowHeights, rowLines });
      H_unscaled += L.pelRowH;
      rowHeights.forEach(h => { H_unscaled += h; });
      H_unscaled += 0.4;
    });

    // Calcular factor de escala para dejar un padding mínimo al final (evitando que la última celda pegue al recuadro)
    const bottomPadding = 1.0; // padding mínimo de 1mm al final (ajustado a 1/3)
    const availableH = L.contentH - L.pelHdrH - bottomPadding;
    const scale = H_unscaled > availableH ? (availableH / H_unscaled) : 1.0;

    preprocessedCat.forEach(({ cat, s1, s2, rowHeights, rowLines }) => {
      const catH = L.pelRowH * scale;
      _rect(xCol, y, w, catH, L.cSecBg);
      _doc.setLineWidth(L.lwInt); _doc.setDrawColor(...L.cBorder);
      _doc.rect(xCol, y, w, catH, 'S');
      _setFontNarrow('bold', L.szPelCat, L.cText);
      _text(cat.categoria, xCol + w / 2, _vbase(y, catH, L.szPelCat), { align: 'center' });
      y += catH;

      for (let i = 0; i < rowHeights.length; i++) {
        const rowH = rowHeights[i] * scale;
        const lns = rowLines[i];
        [s1[i], s2[i]].forEach((pp, ci) => {
          if (!pp) return;
          const px = xCol + ci * SL + L.padL;
          const nl = lns[ci].length;
          const y0 = y + rowH / 2 - ((nl - 1) * itemLh * scale) / 2
                     + (L.szPelDesc * 0.352778 * L.capFactor) / 2;
          _setFontNarrow('bold',   L.szPelItem, L.cText);
          _text(`${pp.codigo}.`, px, y0);
          _setFontNarrow('normal', L.szPelDesc, L.cText);
          lns[ci].forEach((ln, li) => _text(ln, px + 6.5, y0 + li * itemLh * scale));
        });
        y += rowH;
      }
      y += 0.4 * scale;
    });
  }

  // ── Guía controles — CF-02/CF-05/CF-07 ───────────────────────

  function _dibujarGuiaControles(xCol, yTop) {
    const controles = Config.getControles()
      .slice().sort((a, b) => parseInt(a.codigo) - parseInt(b.codigo));
    let y = yTop; const w = 76.02; // Ancho real de la Tabla 5 en DOCX (10.00 + 0.34 + 63.27 + 2.42 mm)
    _doc.setLineWidth(L.lwExt); _doc.setDrawColor(...L.cBorder);
    _doc.rect(xCol, yTop, w, L.contentH, 'S');

    // CF-05: header altura exacta 3.4396mm
    _rect(xCol, y, w, L.ctlHdrH, L.cHdrBg);
    _doc.setLineWidth(L.lwInt); _doc.setDrawColor(...L.cBorder);
    _doc.rect(xCol, y, w, L.ctlHdrH, 'S');
    _setFontNarrow('bold', L.szCtlHdr, L.cHdrFg);
    _text('GUÍA MEDIDAS PREVENTIVAS Y DE CONTROL',
      xCol + w / 2, _vbase(y, L.ctlHdrH, L.szCtlHdr), { align: 'center' });
    y += L.ctlHdrH;

    // Sangría AN (numbering.xml): left=12.594mm, hanging=6.297mm, relativos
    // al margen de celda. El número se ubica en (left-hanging) y el texto en left.
    // Número Arial Narrow 8pt, texto 7.5pt, interlineado 1.15, sin espacios.
    const cellL  = xCol + L.padL;            // borde interno de celda
    const numX   = cellL + L.ctlHang;        // número en left-hanging = 6.297mm
    const descX  = cellL + L.ctlLeft;        // texto en left = 12.594mm
    const descW  = w - L.padL - L.ctlLeft - L.padL; // Ajustado dinámicamente al nuevo ancho

    // Párrafo vacío inicial (5.5pt)
    y += L.ctlEmptyPara;                     

    // Reservar espacio al final de la columna para un párrafo en blanco de fuente tamaño 5 (5 * 0.352778 * 1.15 = 2.03 mm)
    const blankParaH = 5 * 0.352778 * 1.15; 
    const availableH = L.contentH - L.ctlHdrH - L.ctlEmptyPara - blankParaH;
    let totalLines = 0;
    const preprocessed = [];
    controles.forEach(ctrl => {
      const lines = _doc.splitTextToSize(ctrl.descripcion, descW);
      const count = Math.max(1, lines.length);
      preprocessed.push({ ctrl, lines, count });
      totalLines += count;
    });

    const ctlLh = availableH / (totalLines || 1);

    preprocessed.forEach(({ ctrl, lines, count }) => {
      const baseY = y + L.szCtlDesc * 0.352778 * L.capFactor + 0.4;
      _setFontNarrow('normal', L.szCtlNum, L.cText);
      _text(`${ctrl.codigo}.`, numX, baseY);
      _setFontNarrow('normal', L.szCtlDesc, L.cText);
      lines.forEach((ln, li) => _text(ln, descX, baseY + li * ctlLh));
      y += count * ctlLh;
    });
  }

  // ── Footer — CF-02/CF-07 ──────────────────────────────────────

  function _dibujarFooter(pageNum) {
    const x = L.ml, y = L.footerY;
    const nombre = (State.get('identificacion') || {}).nombreArchivo || 'FM-HSE-022';
    _setFontNarrow('normal', L.szFooter, L.cFooter);
    // Eliminada la línea horizontal que se superponía con las tablas del contenido
    // Trazabilidad documental (mejora funcional aprobada, conservada): nombre + timestamp
    _text(`${nombre} | ${_genTimestamp}`, x, y + 2);
    // Texto AN del documento maestro (capitalización oficial)
    _text('Copia no Controlada', x + L.aw / 2, y + 2, { align: 'center' });
    // El número de página lo escribe _actualizarTotalPaginas (fuente única,
    // evita superposición). NC-H.
  }

  // ── Tabla Pág 2 — R-14/R-15/R-16 ────────────────────────────

  function _dibujarHeaderTabla(yTop) {
    const blqs = [
      [L.p2B1X, 'Pasos de la Tarea'],
      [L.p2B2X, 'Peligros Identificados'],
      [L.p2B3X, 'Medidas Preventivas y de Control'],
    ];
    blqs.forEach(([bx, lbl]) => {
      _rect(bx, yTop, L.p2BW, L.p2HdrH, L.cSecBg);
      _doc.setLineWidth(L.lwInt); _doc.setDrawColor(...L.cBorder);
      _doc.rect(bx, yTop, L.p2BW, L.p2HdrH, 'S');
      _doc.line(bx + L.p2ItmW, yTop, bx + L.p2ItmW, yTop + L.p2HdrH);
      _setFontNarrow('bold', L.szTblHdr, L.cText);
      _text('Ítem', bx + L.p2ItmW / 2, yTop + L.p2HdrH / 2 + 1.5, { align: 'center' });
      _text(lbl, bx + L.p2ItmW + L.p2ContW / 2, yTop + L.p2HdrH / 2 + 1.5, { align: 'center' });
    });
    return yTop + L.p2HdrH;
  }

  function _calcularAlturaFila() { return L.p2RowH; }

  function _dibujarFilaPaso(paso, yTop, contenidos) {
    [L.p2B1X, L.p2B2X, L.p2B3X].forEach((bx, bi) => {
      _doc.setLineWidth(L.lwInt); _doc.setDrawColor(...L.cBorder);
      _doc.rect(bx, yTop, L.p2BW, L.p2RowH, 'S');
      _doc.line(bx + L.p2ItmW, yTop, bx + L.p2ItmW, yTop + L.p2RowH);
      _setFontNarrow('bold',   L.szTblItem, L.cText);
      _text(String(paso.numero), bx + L.p2ItmW / 2, yTop + L.p2RowH / 2 + 1.5, { align: 'center' });
      _setFontNarrow('normal', L.szTblCont, L.cText);
      const lines = _doc.splitTextToSize(contenidos[bi], L.p2ContW - L.padL * 2);
      lines.slice(0, 3).forEach((ln, li) =>
        _text(ln, bx + L.p2ItmW + L.padL, yTop + 4.5 + li * 4.5));
    });
    return yTop + L.p2RowH;
  }

  // ── Orquestador Página 1 ──────────────────────────────────────

  function _generarPagina1(state, logoData) {
    _doc.setPage(1);
    const xC2 = L.p1C2X, xC3 = L.p1C3X;
    _dibujarEncabezado(logoData);
    const yInfo  = L.mt + L.hdrH + 2.0;
    const yResp  = _dibujarInfoGeneral(state.general || {}, yInfo);
    const yUbic  = _dibujarResponsables(state.responsables || [], yResp) + L.tblGap;
    const ySenal = _dibujarUbicacion(
      state.puntoEncuentro || '', state.duchaLavaojos || '', yUbic) + L.tblGap;
    _dibujarSenales(state.senalesParada || {}, ySenal);
    _dibujarCatalogoPeligros(xC2, L.mt);
    _dibujarGuiaControles(xC3, L.mt);
    _dibujarFooter(1);
  }

  // ── Orquestador Páginas 2+ ────────────────────────────────────

  function _generarPaginasPasos(pasos) {
    _doc.addPage(); const curPage = 2;
    let curY = L.mt;
    curY = _dibujarHeaderTabla(curY);
    const totalH = L.p2HdrH + L.p2Rows * L.p2RowH;
    [L.p2B1X, L.p2B2X, L.p2B3X].forEach(bx => {
      _doc.setLineWidth(L.lwExt); _doc.setDrawColor(...L.cBorder);
      _doc.rect(bx, L.mt, L.p2BW, totalH, 'S');
    });
    for (let i = 0; i < L.p2Rows; i++) {
      if (i < pasos.length) {
        const p = pasos[i];
        const contenidos = [
          p.descripcion || '',
          (p.peligros || []).join(', '),
          (p.controles || []).join(', '),
        ];
        curY = _dibujarFilaPaso(p, curY, contenidos);
      } else {
        [L.p2B1X, L.p2B2X, L.p2B3X].forEach(bx => {
          _doc.setLineWidth(L.lwInt); _doc.setDrawColor(...L.cBorder);
          _doc.rect(bx, curY, L.p2BW, L.p2RowH, 'S');
          _doc.line(bx + L.p2ItmW, curY, bx + L.p2ItmW, curY + L.p2RowH);
        });
        curY += L.p2RowH;
      }
    }
    _dibujarFooter(curPage);
    return curPage;
  }

  // ── Actualización de totales  // ── Actualización de totales en footer (second-pass) ─────
  // ── Actualización de totales en footer (second-pass) ─────
  // ── Actualización de totales en footer (second-pass) ─────
  // ── Actualización de totales en footer (second-pass) ─────

  function _actualizarTotalPaginas(totalPages) {
    for (let p = 1; p <= totalPages; p++) {
      _doc.setPage(p);
      const x = _x0() + L.aw - 20;
      const y = L.footerY - 1;
      _doc.setFillColor(...L.cWhite);
      _doc.rect(x, y, 22, 5, 'F');
      _setFontNarrow('normal', L.szFooterPag, L.cFooter);
      const pageNum = _doc.internal.getCurrentPageInfo().pageNumber;
      _text(`${pageNum}/${totalPages}`, _x0() + L.aw, L.footerY + 2, { align: 'right' });
    }
  }

  // ── Carga del logo ───────────────────────────────────────

  async function _cargarFuentes() {
    // Carga Arial Narrow (Regular + Bold) extraída del DOCX maestro
    // Fuente oficial del formato corporativo FM-HSE-022
    const fuentes = [
      { file: 'arial-narrow.b64.txt',      name: 'ArialNarrow', style: 'normal' },
      { file: 'arial-narrow-bold.b64.txt', name: 'ArialNarrow', style: 'bold'   },
    ];
    for (const { file, name, style } of fuentes) {
      try {
        const resp = await fetch(`./assets/${file}`);
        if (!resp.ok) continue;
        const b64 = (await resp.text()).trim();
        if (!b64 || b64.length < 100) continue;
        // Registrar en jsPDF
        const ttfName = file.replace('.b64.txt', '.ttf');
        _doc.addFileToVFS(ttfName, b64);
        _doc.addFont(ttfName, name, style);
      } catch(e) { /* fuente no disponible — usar Helvetica como fallback */ }
    }
  }

  async function _cargarLogo() {
    // Prioridad declarada (AJ-04):
    //   1. assets/logo.png  (imagen original — se convierte a base64 en tiempo de ejecución)
    //   2. assets/logo.b64.txt  (base64 pre-generado)
    //   3. null  (modo degradado — encabezado sin logo)

    // ── Prioridad 1: assets/logo.png ─────────────────────
    try {
      const respPng = await fetch('./assets/logo.png');
      if (respPng.ok) {
        const blob    = await respPng.blob();
        const mimeOk  = blob.type === 'image/png' || blob.type === 'image/jpeg'
                     || blob.type === 'image/jpg'  || blob.type === 'application/octet-stream';
        if (mimeOk || blob.size > 0) {
          // Convertir a data URI detectando el tipo real por los magic bytes
          const buf    = await blob.arrayBuffer();
          const bytes  = new Uint8Array(buf);
          const mime   = (bytes[0] === 0xFF && bytes[1] === 0xD8)
            ? 'image/jpeg'
            : 'image/png';
          const b64    = btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
          const dataURI = `data:${mime};base64,${b64}`;
          return { uri: dataURI, mime: mime === 'image/jpeg' ? 'JPEG' : 'PNG' };
        }
      }
    } catch { /* logo.png no disponible — continuar */ }

    // ── Prioridad 2: assets/logo.b64.txt ─────────────────
    try {
      const respB64 = await fetch('./assets/logo.b64.txt');
      if (respB64.ok) {
        const txt = (await respB64.text()).trim();
        if (txt.startsWith('data:image') && !txt.startsWith('REEMPLAZAR')) {
          const mime = txt.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
          return { uri: txt, mime };
        }
      }
    } catch { /* logo.b64.txt no disponible */ }

    // ── Prioridad 3: sin logo ─────────────────────────────
    return null;
  }

  // ── API pública: generar PDF + modal de vista previa ─────

  async function generarPDF() {
    // 1. Leer state completo (una sola vez)
    const state = State.get();
    if (!state) { Utils.toast('Error al leer el formulario.', 'danger'); return; }

    // 2. Verificar aprobación (guard — no debería llegar aquí sin aprobación)
    if (state.aprobacion?.estado !== 'aprobado') {
      Utils.toast('El formulario debe estar aprobado por el supervisor HSE.', 'warning');
      return;
    }

    // 3. Capturar timestamp de generación
    _genTimestamp = new Date().toLocaleString('es-CO', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    // 4. Cargar logo y fuentes en paralelo
    const [ logoData ] = await Promise.all([
      _cargarLogo(),
    ]);

    // 5. Crear documento jsPDF
    const { jsPDF } = window.jspdf;
    _doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'landscape' });

    // 5b. Cargar Arial Narrow (fuente oficial del DOCX maestro)
    await _cargarFuentes();
    // Verificar si Arial Narrow quedó registrada
    try {
      const fontList = _doc.getFontList();
      _arialNarrowLoaded = 'ArialNarrow' in fontList;
    } catch(e) { _arialNarrowLoaded = false; } // R-01: Letter Landscape

    // 6. Página 1
    _generarPagina1(state, logoData);

    // 7. Páginas 2+
    const lastPage = _generarPaginasPasos(state.pasos || [], logoData);

    // 8. Second-pass: actualizar total de páginas en footers
    const totalPages = _doc.internal.getNumberOfPages();
    _actualizarTotalPaginas(totalPages);

    // 9. Generar Blob y abrir vista previa (SF-19)
    const blob    = _doc.output('blob');
    const nombre  = (state.identificacion?.nombreArchivo || 'FM-HSE-022') + '.pdf';
    _blobURL = URL.createObjectURL(blob);

    _mostrarVistaPrevia(blob, nombre);
  }

  // ── Modal de vista previa (SF-19) ────────────────────────

  function _mostrarVistaPrevia(blob, nombre) {
    const overlay   = Utils.$el('modal-preview');
    const iframe    = Utils.$el('pdf-preview-frame');
    const fallback  = Utils.$el('pdf-preview-fallback');
    const fileLabel = Utils.$el('modal-preview-filename');

    if (!overlay) return;

    if (fileLabel) fileLabel.textContent = nombre;

    // Detectar móvil para mostrar fallback
    if (Utils.esMobil()) {
      iframe?.classList.add('hidden');
      fallback?.classList.remove('hidden');
      Utils.$el('btn-open-pdf-tab')?.addEventListener('click', () => {
        window.open(_blobURL, '_blank');
      }, { once: true });
    } else {
      if (iframe) iframe.src = _blobURL;
      iframe?.classList.remove('hidden');
      fallback?.classList.add('hidden');
    }

    overlay.classList.remove('hidden');

    // Botones del modal
    const btnClose   = Utils.$el('btn-preview-close');
    const btnCancel  = Utils.$el('btn-preview-cancel');
    const btnConfirm = Utils.$el('btn-preview-confirm');

    const cerrar = () => {
      overlay.classList.add('hidden');
      if (iframe) iframe.src = '';
      if (_blobURL) { URL.revokeObjectURL(_blobURL); _blobURL = null; }
    };

    const descargar = () => {
      const state = State.get();
      const n = (state?.identificacion?.nombreArchivo || 'FM-HSE-022') + '.pdf';
      _doc.save(n);
      cerrar();
      Utils.toast(`PDF generado: ${n}`, 'success', 4000);
    };

    btnClose?.addEventListener('click', cerrar, { once: true });
    btnCancel?.addEventListener('click', cerrar, { once: true });
    btnConfirm?.addEventListener('click', descargar, { once: true });

    // Cerrar al hacer clic en overlay
    overlay.addEventListener('click', e => {
      if (e.target === overlay) cerrar();
    }, { once: true });
  }

  return { generarPDF };
})();


/* ───────────────────────────────────────────────────────────────
   APP — Orquestador principal
──────────────────────────────────────────────────────────────── */
const App = (() => {

  let _autosaveTimer = null;

  // ── Autosave ───────────────────────────────────────────────

  function _iniciarAutosave() {
    const cfg      = Config.get('ui') || {};
    const intervalo = cfg.autosaveIntervaloMs || 5000;

    State.on('change', () => {
      clearTimeout(_autosaveTimer);
      _autosaveTimer = setTimeout(() => {
        State.guardarBorrador();
      }, intervalo);
    });
  }

  // ── Banner de borrador ─────────────────────────────────────

  function _gestionarBanner() {
    if (!State.tieneBorrador()) return;

    const borrador = State.leerBorrador();
    const banner   = Utils.$el('draft-banner');
    const texto    = Utils.$el('draft-banner-text');
    if (!banner || !borrador) return;

    // Mostrar info del borrador
    const modificado = borrador._meta?.modificadoEn
      ? Utils.formatearFechaHora(borrador._meta.modificadoEn)
      : 'fecha desconocida';
    const tarea = borrador.general?.tarea
      ? `"${borrador.general.tarea.substring(0, 40)}${borrador.general.tarea.length > 40 ? '…' : ''}"`
      : 'formulario sin título';

    texto.textContent = `Borrador guardado el ${modificado}: ${tarea}`;
    banner.classList.remove('hidden');

    Utils.$el('btn-restore-draft')?.addEventListener('click', () => {
      State.reemplazar(borrador);
      banner.classList.add('hidden');
      Utils.toast('Formulario restaurado correctamente.', 'success');
      App.renderTodo();
    });

    Utils.$el('btn-discard-draft')?.addEventListener('click', async () => {
      const ok = await Modal.confirmar(
        'Descartar borrador',
        '¿Eliminar el borrador guardado? Esta acción no se puede deshacer.',
        { labelOk: 'Descartar', peligroso: true }
      );
      if (ok) {
        State.descartarBorrador();
        banner.classList.add('hidden');
        Utils.toast('Borrador descartado.', 'info');
      }
    });
  }

  // ── Nuevo formulario ───────────────────────────────────────

  function _bindNuevoFormulario() {
    Utils.$el('btn-new-form')?.addEventListener('click', async () => {
      const ok = await Modal.confirmar(
        'Nuevo formulario',
        '¿Iniciar un formulario nuevo? Se perderán todos los datos actuales no guardados.',
        { labelOk: 'Nuevo formulario', peligroso: true }
      );
      if (!ok) return;
      State.resetear();
      State.descartarBorrador();
      App.renderTodo();
      Utils.$el('draft-banner')?.classList.add('hidden');
      Utils.toast('Formulario reiniciado.', 'info');
      // Hacer scroll al tope
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ── Exportación / Importación ──────────────────────────────

  function _bindBackup() {
    Utils.$el('btn-export-backup')?.addEventListener('click', () => {
      Backup.exportar();
    });

    Utils.$el('btn-import-backup')?.addEventListener('click', () => {
      Utils.$el('input-import-file')?.click();
    });

    Utils.$el('input-import-file')?.addEventListener('change', async e => {
      const archivo = e.target.files?.[0];
      if (archivo) {
        await Backup.importar(archivo);
        // Limpiar el input para permitir re-importar el mismo archivo
        e.target.value = '';
        // Re-render completo después de importar
        App.renderTodo();
      }
    });
  }

  // ── Render global ──────────────────────────────────────────

  function renderTodo() {
    UIGeneral.render();
    UIResponsables.render();
    UIUbicacion.render();
    UISenales.render();
    UITiposTrabajo.render();
    UIPasos.render();
    UIResumen.render();
    UIAprobacion.render();
    UIDocId.render();
  }

  // ── Mostrar formulario tras carga ──────────────────────────

  function _mostrarFormulario() {
    Utils.$el('loading-screen')?.classList.add('hidden');
    Utils.$el('form-hse')?.removeAttribute('hidden');
  }

  // ── Inicialización ─────────────────────────────────────────

  async function init() {
    try {
      // 1. Cargar configuración JSON
      await Config.cargarTodo();

      // 2. Inicializar modal de confirmación
      Modal._bindOnce();

      // 3. Verificar y gestionar borrador guardado
      _gestionarBanner();

      // 4. Renderizar todas las secciones activas
      renderTodo();

      // 5. Mostrar el formulario
      _mostrarFormulario();

      // 6. Iniciar autosave
      _iniciarAutosave();

      // 7. Bind de controles globales
      _bindNuevoFormulario();
      _bindBackup();
      _bindPDF();

      // 8. Observer post-aprobación y estado inicial del botón PDF
      _iniciarObserverPostAprobacion();
      actualizarBtnPDF();

      // 9. Inicializar comportamiento de acordeón exclusivo
      _iniciarAcordeonInteligente();

      // 10. Inicializar el tema claro/oscuro
      _bindThemeToggle();

      console.info('[App] FM-HSE-022 iniciada correctamente.');

    } catch (err) {
      console.error('[App] Error durante la inicialización:', err);
      _mostrarErrorCarga(err.message);
    }
  }

  function _mostrarErrorCarga(mensaje) {
    const screen = Utils.$el('loading-screen');
    if (!screen) return;
    screen.innerHTML = `
      <div style="text-align:center;padding:2rem;max-width:400px;">
        <svg style="width:48px;height:48px;color:#e74c3c;margin-bottom:1rem;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p style="color:#e8edf2;font-weight:600;margin-bottom:0.5rem;">Error al cargar la configuración</p>
        <p style="color:#8da3b8;font-size:0.875rem;margin-bottom:1.5rem;">${Utils.escaparHtml(mensaje)}</p>
        <p style="color:#5a7a96;font-size:0.8rem;">
          Asegúrese de servir la aplicación desde un servidor HTTP.<br>
          Ejemplo: <code style="color:#f5c518;">python -m http.server 8080</code>
        </p>
      </div>`;
  }

  // ── Bind del botón Generar PDF ───────────────────────────
  function _bindPDF() {
    const btnPDF     = Utils.$el('btn-generate-pdf');
    const btnPrint   = Utils.$el('btn-print-fallback');

    btnPDF?.addEventListener('click', () => {
      Print.generarPDF();
    });

    btnPrint?.addEventListener('click', () => {
      window.print();
    });
  }

  // ── Habilitación del botón PDF ────────────────────────────
  function actualizarBtnPDF() {
    const btn = Utils.$el('btn-generate-pdf');
    if (!btn) return;
    const habilitado = UIAprobacion.validar() && UIDocId.validar();
    btn.disabled = !habilitado;
    btn.setAttribute('aria-disabled', String(!habilitado));
  }

  // ── Observer de cambios post-aprobación ───────────────────
  // Si el formulario cambia después de una aprobación, se resetea.
  // Se registra una sola vez en init().
  function _iniciarObserverPostAprobacion() {
    State.on('update', ({ clave }) => {
      if (!clave) return;
      UIAprobacion.resetearSiAprobado(clave);
      actualizarBtnPDF();
    });
  }

  function _iniciarAcordeonInteligente() {
    const cards = document.querySelectorAll('.section-card');
    cards.forEach(card => {
      card.addEventListener('toggle', function() {
        if (this.open) {
          cards.forEach(otherCard => {
            if (otherCard !== this && otherCard.open) {
              otherCard.open = false;
            }
          });
        }
      });
    });
  }

  // ── Gestión del Tema Claro / Oscuro ────────────────────────
  function _bindThemeToggle() {
    const btn = Utils.$el('btn-toggle-theme');
    if (!btn) return;

    // Leer el tema inicial guardado (por defecto oscuro '#1a2332')
    const temaGuardado = localStorage.getItem('app-theme') || 'dark';
    if (temaGuardado === 'light') {
      document.body.classList.add('light-theme');
      _actualizarIconoTema('light');
      // Actualizar el meta tag theme-color
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) metaThemeColor.setAttribute('content', '#ffffff');
    } else {
      document.body.classList.remove('light-theme');
      _actualizarIconoTema('dark');
      // Actualizar el meta tag theme-color
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) metaThemeColor.setAttribute('content', '#1a2332');
    }

    btn.addEventListener('click', () => {
      const esClaro = document.body.classList.toggle('light-theme');
      const nuevoTema = esClaro ? 'light' : 'dark';
      localStorage.setItem('app-theme', nuevoTema);
      _actualizarIconoTema(nuevoTema);
      
      // Actualizar el meta tag theme-color de forma dinámica
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', esClaro ? '#ffffff' : '#1a2332');
      }

      Utils.toast(`Modo ${esClaro ? 'claro' : 'oscuro'} activado.`, 'info', 2000);
    });
  }

  function _actualizarIconoTema(tema) {
    const iconDark = document.querySelector('#btn-toggle-theme .icon-theme-dark');
    const iconLight = document.querySelector('#btn-toggle-theme .icon-theme-light');
    if (tema === 'light') {
      iconDark?.classList.add('hidden');
      iconLight?.classList.remove('hidden');
    } else {
      iconDark?.classList.remove('hidden');
      iconLight?.classList.add('hidden');
    }
  }

  return { init, renderTodo, actualizarBtnPDF };
})();


/* ───────────────────────────────────────────────────────────────
   PUNTO DE ENTRADA
──────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => App.init());
