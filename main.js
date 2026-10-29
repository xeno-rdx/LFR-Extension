"use strict";

const {
  Plugin,
  PluginSettingTab,
  Setting,
  Notice,
  Menu,
  MarkdownView,
  TFile,
  Platform,
  setIcon,
  arrayBufferToBase64,
  editorLivePreviewField,
  editorInfoField,
} = require("obsidian");
const { EditorView, ViewPlugin, Decoration, Direction } = require("@codemirror/view");
const { StateEffect, StateField } = require("@codemirror/state");

/* =====================================================================
 *  Constants
 * ===================================================================*/

const DEFAULT_SETTINGS = {
  autoDirection: true,
  detectionMode: "majority", // "majority" | "first"
  isolateRuns: true,
  beautifyRtl: true,
  statusBar: true,
  fonts: [], // { id, name, faces: { regular|bold|italic|boldItalic: { ext, file } } }
  activeFont: null,
  fontSize: 0, // px, 0 = theme default
  lineHeight: 0, // 0 = theme default
  folderRules: [], // { path, direction: "auto"|"rtl"|"ltr", font: "" | fontId }
};

const SLOTS = ["regular", "bold", "italic", "boldItalic"];
const SLOT_LABEL = { regular: "Regular", bold: "Bold", italic: "Italic", boldItalic: "Bold Italic" };
const SLOT_CSS = {
  regular: [400, "normal"],
  bold: [700, "normal"],
  italic: [400, "italic"],
  boldItalic: [700, "italic"],
};
const FONT_FORMATS = {
  ttf: ["font/ttf", "truetype"],
  otf: ["font/otf", "opentype"],
  woff: ["font/woff", "woff"],
  woff2: ["font/woff2", "woff2"],
};

const LETTER = /\p{L}/u;
const RTL_SCRIPT = /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}]/u;

const LINE_PREFIX =
  /^\s*(?:>\s*)*(?:(?:[-*+]|\d+[.)])\s+)?(?:\[[ xX\-\/><!?*]\]\s+)?(?:#{1,6}\s+)?/;
const URL_RE = /\b(?:https?|ftp|obsidian|file):\/\/\S+|\bwww\.\S+/gi;
const URL_TEXT = /^(?:(?:https?|ftp|obsidian|file):\/\/|www\.)/i;
const TAG_RE = /<\/?[a-zA-Z][^>]*>/g;

const FENCE_RE = /^\s*(?:>\s*)*(`{3,}|~{3,})/;
const OPEN_DIV = /^\s*<div\b[^>]*\bdir\s*=\s*["'](rtl|ltr)["'][^>]*>\s*$/i;
const ANY_OPEN_DIV = /^\s*<div\b/i;
const CLOSE_DIV = /^\s*<\/div>\s*$/i;
// a line whose whole content is one <span dir="..">…</span> (written by the "whole line" direction command)
const SPAN_ONLY = /^<span dir="(rtl|ltr)">((?:(?!<\/span>)[\s\S])*)<\/span>$/;
const HR_RE = /^\s*([-*_])(?:\s*\1){2,}\s*$/;

// A run of Latin text (words joined by single spaces / . _ - / : ' @ &), e.g. "Visual Studio Code", "C++"
const LATIN_RUN =
  /\p{Script=Latin}[\p{Script=Latin}\p{N}\p{M}]*(?:[ ._\-\/:'’@&][\p{Script=Latin}\p{N}\p{M}]+)*[+#]*/gu;
// A run of Arabic/Persian/Hebrew text (words joined by a single space / ZWNJ / Persian punctuation)
const RTL_LETTERS = "\\p{Script=Arabic}\\p{Script=Hebrew}";
const RTL_RUN = new RegExp(
  `[${RTL_LETTERS}][${RTL_LETTERS}\\p{M}\\p{N}\\u200c\\u200d]*(?:[ \\u200c،؛:.\\-][${RTL_LETTERS}\\p{N}\\p{M}\\u200c\\u200d]+)*`,
  "gu"
);

const READING_TARGETS =
  "p, li, ul, ol, table, h1, h2, h3, h4, h5, h6, blockquote, th, td, .callout, summary";

// Selectors that receive the custom font (prefixed per font by the plugin)
const TEXT_LIST = [
  ".markdown-source-view.mod-cm6 .cm-content",
  ".markdown-preview-view",
  ".markdown-rendered",
  ".inline-title",
];

// Selectors that must ALWAYS keep the monospace font (code, YAML, shell boxes...)
const CODE_LIST = [
  ".markdown-source-view .sb-mono",
  ".markdown-source-view .sb-mono *",
  ".markdown-source-view .cm-inline-code",
  ".markdown-source-view .HyperMD-codeblock",
  ".markdown-source-view .HyperMD-codeblock *",
  ".markdown-source-view .cm-hmd-codeblock",
  ".markdown-source-view .cm-hmd-frontmatter",
  ".markdown-preview-view code",
  ".markdown-preview-view pre",
  ".markdown-preview-view pre *",
  ".markdown-preview-view kbd",
  ".markdown-preview-view .frontmatter",
  ".markdown-preview-view .frontmatter *",
  ".markdown-rendered code",
  ".markdown-rendered pre",
  ".markdown-rendered pre *",
  ".markdown-rendered kbd",
];

/* =====================================================================
 *  Direction detection
 * ===================================================================*/

/**
 * Classify clean text (no code / URLs / tags).
 * mode "first": direction of the first strong letter.
 * mode "majority": direction of the majority of words (ties -> first strong letter).
 * Returns "rtl" | "ltr" | null
 */
function classifyText(s, mode) {
  let first = null;
  let rtl = 0;
  let ltr = 0;
  for (const tok of s.split(/\s+/)) {
    if (!tok) continue;
    let tokDir = null;
    for (const ch of tok) {
      if (!LETTER.test(ch)) continue;
      tokDir = RTL_SCRIPT.test(ch) ? "rtl" : "ltr";
      break;
    }
    if (!tokDir) continue;
    if (!first) {
      first = tokDir;
      if (mode === "first") return first;
    }
    if (tokDir === "rtl") rtl++;
    else ltr++;
  }
  if (!first) return null;
  if (rtl > ltr) return "rtl";
  if (ltr > rtl) return "ltr";
  return first;
}

/** Editor line detection. Returns "rtl" | "ltr" | "url" | null (null = neutral line) */
function detectDirection(rawText, mode) {
  let s = rawText.replace(LINE_PREFIX, "");
  const hadUrl = new RegExp(URL_RE.source, "i").test(s);
  s = s
    .replace(/`[^`]*`/g, " ")
    .replace(URL_RE, " ")
    .replace(TAG_RE, " ")
    .replace(/\]\([^)]*\)/g, "]");
  const d = classifyText(s, mode);
  if (d) return d;
  return hadUrl ? "url" : null;
}

/** "rtl" | "ltr" when the whole content of the line (after markdown markers) is one <span dir> */
function spanWrappedDir(text) {
  const body = text.slice(LINE_PREFIX.exec(text)[0].length).replace(/\s+$/, "");
  const m = SPAN_ONLY.exec(body);
  return m ? m[1] : null;
}

/* =====================================================================
 *  Line scanner: tells which lines are code-like (frontmatter, fences, math)
 * ===================================================================*/

class Scanner {
  constructor() {
    this.inFront = false;
    this.fence = null;
    this.inMath = false;
  }

  /** Returns true when the line is code-like and must stay LTR/monospace */
  step(n, text) {
    if (n === 1 && text.trim() === "---") {
      this.inFront = true;
      return true;
    }
    if (this.inFront) {
      const t = text.trim();
      if (t === "---" || t === "...") this.inFront = false;
      return true;
    }
    if (this.fence) {
      const m = FENCE_RE.exec(text);
      if (
        m &&
        m[1][0] === this.fence.c &&
        m[1].length >= this.fence.len &&
        text.replace(FENCE_RE, "").trim() === ""
      ) {
        this.fence = null;
      }
      return true;
    }
    const f = FENCE_RE.exec(text);
    if (f) {
      this.fence = { c: f[1][0], len: f[1].length };
      return true;
    }
    if (this.inMath) {
      if (text.includes("$$")) this.inMath = false;
      return true;
    }
    if (text.trim().startsWith("$$")) {
      const count = (text.match(/\$\$/g) || []).length;
      if (count % 2 === 1) this.inMath = true;
      return true;
    }
    return false;
  }
}

/* =====================================================================
 *  Persian typography tools
 * ===================================================================*/

const ZWNJ = "\u200c";
// Persian/Arabic letters (without digits): ء-غ, ف-ي, ٱ-ۓ, ۺ-ۿ
const FA_L = "\\u0621-\\u063A\\u0641-\\u064A\\u0671-\\u06D3\\u06FA-\\u06FF";

// Parts of the text that must never be touched
const PROTECTED =
  /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`|!?\[\[[^\]\n]*\]\]|\]\([^)\n]*\)|https?:\/\/[^\s)>\]]+|<\/?[a-zA-Z][^>\n]*>|\$\$[\s\S]*?\$\$|\$[^\s$][^$\n]*\$|%%[\s\S]*?%%)/g;

function transformProtected(text, fn) {
  return text
    .split(PROTECTED)
    .map((part, i) => (i % 2 === 1 ? part : fn(part)))
    .join("");
}

function fixHalfSpaces(s) {
  // می / نمی prefix: "می خواهم" -> "می‌خواهم"
  s = s.replace(new RegExp(`(^|[^${FA_L}])(ن?می)[ \\t]+(?=[${FA_L}]{2})`, "g"), `$1$2${ZWNJ}`);
  // plural / comparative suffixes: "کتاب ها" -> "کتاب‌ها", "بزرگ تر" -> "بزرگ‌تر"
  s = s.replace(
    new RegExp(`([${FA_L}])[ \\t]+(ها|های|هایی|ترین|تری|تر)(?![${FA_L}])`, "g"),
    `$1${ZWNJ}$2`
  );
  // yaa after a word: "خانه ی" -> "خانه‌ی"
  s = s.replace(new RegExp(`([${FA_L}])[ \\t]+ی(?![${FA_L}])`, "g"), `$1${ZWNJ}ی`);
  // tidy
  s = s.replace(/\u200c{2,}/g, ZWNJ).replace(/[ \t]\u200c|\u200c[ \t]/g, " ");
  return s;
}

function arabicToPersian(s) {
  return s.replace(/ي/g, "ی").replace(/ى/g, "ی").replace(/ك/g, "ک");
}

function fixPersianPunctuation(s) {
  const map = { ",": "،", ";": "؛", "?": "؟" };
  return s.replace(new RegExp(`([${FA_L}])([,;?])`, "g"), (_, a, p) => a + map[p]);
}

function persianCleanup(s) {
  return fixPersianPunctuation(fixHalfSpaces(arabicToPersian(s)));
}

/* =====================================================================
 *  Font file helpers
 * ===================================================================*/

function parseFontFile(fileName) {
  const base = fileName.replace(/\.[^.]+$/, "");
  const lower = base.toLowerCase();
  const italic = /italic|oblique/.test(lower);
  const bold = /bold|black|heavy/.test(lower);
  const slot = bold ? (italic ? "boldItalic" : "bold") : italic ? "italic" : "regular";
  let family = base
    .replace(/_/g, " ")
    .replace(/[- ]?(extra|semi|demi|ultra)?(bold|black|heavy|italic|oblique|regular|medium|light|thin|book|normal)/gi, "")
    .replace(/[- ]+$/g, "")
    .trim();
  if (!family) family = base.replace(/_/g, " ").trim() || "Font";
  return { family, slot };
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

/* =====================================================================
 *  CodeMirror 6 extension (Source mode + Live Preview)
 * ===================================================================*/

const refreshEffect = StateEffect.define();

const DECO = {
  rtl: Decoration.line({ class: "sb-rtl", attributes: { dir: "rtl" } }),
  ltr: Decoration.line({ class: "sb-ltr", attributes: { dir: "ltr" } }),
  rtlMono: Decoration.line({ class: "sb-rtl sb-mono", attributes: { dir: "rtl" } }),
  ltrMono: Decoration.line({ class: "sb-ltr sb-mono", attributes: { dir: "ltr" } }),
};

const MARK = {
  rtl: Decoration.mark({
    class: "sb-iso",
    attributes: { dir: "rtl" },
    bidiIsolate: Direction ? Direction.RTL : undefined,
  }),
  ltr: Decoration.mark({
    class: "sb-iso",
    attributes: { dir: "ltr" },
    bidiIsolate: Direction ? Direction.LTR : undefined,
  }),
};

const HIDE = Decoration.replace({});
const HIDE_BLOCK = Decoration.replace({ block: true });

function isLivePreview(state) {
  if (!editorLivePreviewField) return false;
  try {
    return !!state.field(editorLivePreviewField, false);
  } catch (_) {
    return false;
  }
}

function noteSettingsFor(state, plugin) {
  try {
    const info = editorInfoField ? state.field(editorInfoField, false) : null;
    return plugin.getNoteSettings(info && info.file ? info.file : null);
  } catch (_) {
    return { direction: "auto", fontId: undefined };
  }
}

/**
 * Walks the document from line 1 to lastLine and reports for each line:
 * cb(n, line, dir, mono, plain)
 *   dir   "rtl" | "ltr"
 *   mono  line is code-like (frontmatter, fenced code, math)
 *   plain line is normal text (not a code line and not a <div> wrapper tag)
 */
function walkLines(state, plugin, lastLine, cb) {
  const settings = plugin.settings;
  const doc = state.doc;
  const note = noteSettingsFor(state, plugin);
  const noteDir = note.direction === "rtl" || note.direction === "ltr" ? note.direction : null;

  const scanner = new Scanner();
  const divStack = []; // each entry: "rtl" | "ltr" | null
  let last = noteDir || "ltr";

  for (let n = 1; n <= lastLine && n <= doc.lines; n++) {
    const line = doc.line(n);
    const text = line.text;
    const mono = scanner.step(n, text);
    let dir = "ltr";
    let plain = false;

    if (!mono) {
      if (OPEN_DIV.test(text)) {
        divStack.push(OPEN_DIV.exec(text)[1].toLowerCase());
      } else if (ANY_OPEN_DIV.test(text)) {
        divStack.push(null);
      } else if (CLOSE_DIV.test(text)) {
        divStack.pop();
      } else {
        plain = true;
        const sw = spanWrappedDir(text);
        let forced = null;
        for (let i = divStack.length - 1; i >= 0; i--) {
          if (divStack[i]) { forced = divStack[i]; break; }
        }
        if (sw) {
          dir = sw;
          last = sw;
        } else if (forced) {
          dir = forced;
          last = forced;
        } else if (noteDir) {
          dir = noteDir;
          last = noteDir;
        } else {
          const d = detectDirection(text, settings.detectionMode);
          if (d === "rtl" || d === "ltr") { dir = d; last = d; }
          else if (d === "url") dir = "ltr";
          else dir = last; // neutral / blank line keeps the previous direction
        }
      }
    }
    cb(n, line, dir, mono, plain);
  }
}

/** Direction info for one line (used by the status bar button and commands) */
function lineDirectionAt(state, plugin, lineNo) {
  let result = { dir: "ltr", mono: false };
  walkLines(state, plugin, lineNo, (n, line, dir, mono) => {
    if (n === lineNo) result = { dir, mono };
  });
  return result;
}

/** Inline work for one normal text line: <span dir> handling + mixed-direction runs */
function addInline(line, text, dir, live, sel, settings, all, iso) {
  const mask = (m) => "\u0001".repeat(m.length);
  let masked = text;

  // 1) <span dir="rtl|ltr">…</span> written by the context menu
  if (text.includes("<span")) {
    const re = /<span dir="(rtl|ltr)">([\s\S]*?)<\/span>/g;
    let m;
    while ((m = re.exec(text))) {
      const openLen = m[0].indexOf(">") + 1;
      const spanFrom = line.from + m.index;
      const innerFrom = spanFrom + openLen;
      const innerTo = innerFrom + m[2].length;
      const spanTo = spanFrom + m[0].length;

      if (innerTo > innerFrom) {
        all.push(MARK[m[1]].range(innerFrom, innerTo));
        iso.push(MARK[m[1]].range(innerFrom, innerTo));
      }
      // Live Preview: hide the tags unless the cursor / selection is on this span
      if (live && !sel.some((r) => r.from < spanTo && r.to > spanFrom)) {
        all.push(HIDE.range(spanFrom, innerFrom));
        if (spanTo > innerTo) all.push(HIDE.range(innerTo, spanTo));
      }
    }
    masked = text.replace(/<span dir="(?:rtl|ltr)">[\s\S]*?<\/span>/g, mask);
  }

  // 2) isolate opposite-direction runs (English inside Persian lines and vice versa)
  if (settings.isolateRuns) {
    masked = masked
      .replace(/`[^`]*`/g, mask)
      .replace(URL_RE, mask)
      .replace(TAG_RE, mask)
      .replace(/\]\([^)]*\)/g, mask);

    const target = dir === "rtl" ? LATIN_RUN : RTL_RUN;
    const other = dir === "rtl" ? "ltr" : "rtl";
    target.lastIndex = 0;
    let m;
    while ((m = target.exec(masked))) {
      const a = line.from + m.index;
      const b = a + m[0].length;
      all.push(MARK[other].range(a, b));
      iso.push(MARK[other].range(a, b));
    }
  }
}

function computeDecorations(view, plugin) {
  const settings = plugin.settings;
  const none = { all: Decoration.none, isolates: Decoration.none };
  if (!settings.autoDirection) return none;

  const state = view.state;
  const doc = state.doc;
  const live = isLivePreview(state);
  const sel = state.selection.ranges;
  const { from, to } = view.viewport;
  const firstVisible = doc.lineAt(from).number;
  const lastVisible = doc.lineAt(to).number;
  const all = [];
  const iso = [];

  walkLines(state, plugin, lastVisible, (n, line, dir, mono, plain) => {
    if (n < firstVisible) return;
    all.push(DECO[dir + (mono ? "Mono" : "")].range(line.from));
    if (plain && line.text) addInline(line, line.text, dir, live, sel, settings, all, iso);
  });

  return { all: Decoration.set(all, true), isolates: Decoration.set(iso, true) };
}

/* ---- Block wrappers <div dir="…"> : hidden in Live Preview ---- */

function scanWrappers(doc) {
  const out = [];
  const scanner = new Scanner();
  const stack = [];
  for (let n = 1; n <= doc.lines; n++) {
    const text = doc.line(n).text;
    if (scanner.step(n, text)) continue;
    if (OPEN_DIV.test(text)) stack.push({ ours: true, open: n });
    else if (ANY_OPEN_DIV.test(text)) stack.push({ ours: false });
    else if (CLOSE_DIV.test(text)) {
      const w = stack.pop();
      if (w && w.ours) out.push({ open: w.open, close: n });
    }
  }
  return out;
}

function buildHides(state, wrappers, plugin) {
  if (!plugin.settings.autoDirection || !wrappers.length || !isLivePreview(state)) {
    return Decoration.none;
  }
  const doc = state.doc;
  const sel = state.selection.ranges;
  const touches = (a, b) => sel.some((r) => r.from <= b && r.to >= a);
  const ranges = [];

  for (const w of wrappers) {
    if (w.open > doc.lines || w.close > doc.lines) continue;
    const o = doc.line(w.open);
    const c = doc.line(w.close);

    // opening tag (+ the blank line we add after it)
    let openEnd = o;
    if (w.open + 1 < w.close) {
      const nx = doc.line(w.open + 1);
      if (!nx.text.trim()) openEnd = nx;
    }
    if (!touches(o.from, openEnd.to)) ranges.push(HIDE_BLOCK.range(o.from, openEnd.to));

    // closing tag (+ the blank line before it)
    let closeStart = c;
    if (w.close - 1 > openEnd.number) {
      const pv = doc.line(w.close - 1);
      if (!pv.text.trim()) closeStart = pv;
    }
    if (!touches(closeStart.from, c.to)) ranges.push(HIDE_BLOCK.range(closeStart.from, c.to));
  }
  return Decoration.set(ranges, true);
}

function makeHideField(plugin) {
  return StateField.define({
    create(state) {
      const wrappers = plugin.settings.autoDirection ? scanWrappers(state.doc) : [];
      return { wrappers, deco: buildHides(state, wrappers, plugin) };
    },
    update(val, tr) {
      let wrappers = val.wrappers;
      if (tr.docChanged || tr.effects.some((e) => e.is(refreshEffect))) {
        wrappers = plugin.settings.autoDirection ? scanWrappers(tr.state.doc) : [];
      }
      return { wrappers, deco: buildHides(tr.state, wrappers, plugin) };
    },
    provide: (f) => EditorView.decorations.from(f, (v) => v.deco),
  });
}

function makeEditorExtension(plugin) {
  const viewPlugin = ViewPlugin.fromClass(
    class {
      constructor(view) {
        const r = computeDecorations(view, plugin);
        this.decorations = r.all;
        this.isolates = r.isolates;
      }
      update(u) {
        const refreshed = u.transactions.some((tr) => tr.effects.some((e) => e.is(refreshEffect)));
        const modeChanged = isLivePreview(u.startState) !== isLivePreview(u.state);
        if (u.docChanged || u.viewportChanged || u.selectionSet || refreshed || modeChanged) {
          const r = computeDecorations(u.view, plugin);
          this.decorations = r.all;
          this.isolates = r.isolates;
        }
      }
    },
    {
      decorations: (v) => v.decorations,
      provide: (p) =>
        EditorView.bidiIsolatedRanges
          ? EditorView.bidiIsolatedRanges.of((view) => {
              const inst = view.plugin(p);
              return inst ? inst.isolates : Decoration.none;
            })
          : [],
    }
  );

  const statusListener = EditorView.updateListener.of((u) => {
    if (u.selectionSet || u.docChanged || u.focusChanged) plugin.queueStatus(u.view);
  });

  return [EditorView.perLineTextDirection.of(true), viewPlugin, makeHideField(plugin), statusListener];
}

/* =====================================================================
 *  Plugin
 * ===================================================================*/

module.exports = class LFRExtensionPlugin extends Plugin {
  async onload() {
    await this.loadSettings();

    this.faceCache = new Map(); // path -> base64
    this.faceCssCache = new Map(); // fontId -> @font-face css
    this.previews = new Map(); // fontId -> FontFace (menu preview)

    this.fontStyleEl = document.createElement("style");
    this.fontStyleEl.id = "lfr-extension-style";
    document.head.appendChild(this.fontStyleEl);

    this.register(() => {
      this.fontStyleEl.remove();
      document.body.classList.remove("sb-beautify");
      this.previews.forEach((ff) => document.fonts.delete(ff));
      this.app.workspace.getLeavesOfType("markdown").forEach((l) => {
        if (l.view && l.view.containerEl) l.view.containerEl.removeAttribute("data-sb-font");
      });
    });

    // 1) Smart direction in the editor
    this.registerEditorExtension(makeEditorExtension(this));

    // 2) Smart direction in Reading view / PDF export
    this.registerMarkdownPostProcessor((el, ctx) => this.processReading(el, ctx.sourcePath, ctx));
    this.setupWidgetObserver();

    // 3) Right-click menu: Format -> RTL / LTR, and Persian tools
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor) => this.onEditorMenu(menu, editor))
    );

    // 4) "More options" (three dots) menu -> Font
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file, source) => {
        if (source === "more-options") this.addFontMenu(menu);
      })
    );

    this.registerCommands();
    this.addSettingTab(new SettingTab(this.app, this));

    // 5) Status bar button
    if (Platform.isDesktop && typeof this.addStatusBarItem === "function") {
      this.statusEl = this.addStatusBarItem();
      this.statusEl.addClass("sb-status");
      this.statusEl.style.display = "none";
      this.statusEl.addEventListener("click", (evt) => this.openDirectionMenu(evt));
    }

    // keep views / fonts / title direction in sync
    const ws = this.app.workspace;
    this.registerEvent(ws.on("layout-change", () => this.scheduleRefresh()));
    this.registerEvent(ws.on("active-leaf-change", () => { this.scheduleRefresh(); this.updateStatus(); }));
    this.registerEvent(ws.on("file-open", () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on("rename", () => this.scheduleRefresh()));
    this.registerEvent(
      this.app.metadataCache.on("changed", () => {
        this.refreshEditors();
        this.scheduleRefresh();
      })
    );

    ws.onLayoutReady(() => {
      this.refreshAppearance();
      this.updateStatus();
    });
  }

  /* ---------------- settings ---------------- */

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if (!Array.isArray(this.settings.fonts)) this.settings.fonts = [];
    if (!Array.isArray(this.settings.folderRules)) this.settings.folderRules = [];

    // migrate fonts saved by v1.0 / v1.1 (single file per font)
    for (const f of this.settings.fonts) {
      if (!f.faces) {
        f.faces = f.ext ? { regular: { ext: f.ext, file: `${f.id}.${f.ext}` } } : {};
        delete f.ext;
      }
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  refreshEditors() {
    this.app.workspace.iterateAllLeaves((leaf) => {
      const cm = leaf.view && leaf.view.editor && leaf.view.editor.cm;
      if (cm) cm.dispatch({ effects: refreshEffect.of(null) });
    });
  }

  /* ---------------- per-note / per-folder settings ---------------- */

  /**
   * Priority: note frontmatter > folder rule > global.
   * Frontmatter keys:  direction: rtl | ltr | auto     font: <font name> | none
   * Returns { direction: "auto"|"rtl"|"ltr", fontId: undefined (inherit) | null (no custom font) | id }
   */
  getNoteSettings(file) {
    const res = { direction: "auto", fontId: undefined };
    if (!file) return res;

    // folder rules: the longest matching path wins
    let best = null;
    for (const r of this.settings.folderRules) {
      const p = (r.path || "").trim().replace(/^\/+|\/+$/g, "");
      if (!p) continue;
      if (file.path.startsWith(p + "/") && (!best || p.length > best.p.length)) best = { p, r };
    }
    if (best) {
      if (best.r.direction === "rtl" || best.r.direction === "ltr") res.direction = best.r.direction;
      if (best.r.font && this.settings.fonts.some((f) => f.id === best.r.font)) res.fontId = best.r.font;
    }

    const cache = this.app.metadataCache.getFileCache(file);
    const fm = cache && cache.frontmatter;
    if (fm) {
      const d = String(fm.direction !== undefined ? fm.direction : fm.dir !== undefined ? fm.dir : "")
        .trim()
        .toLowerCase();
      if (d === "rtl" || d === "ltr") res.direction = d;
      else if (d === "auto") res.direction = "auto";

      if (fm.font !== undefined && fm.font !== null) {
        const name = String(fm.font).trim().toLowerCase();
        if (["", "none", "default", "theme"].includes(name)) res.fontId = null;
        else {
          const f = this.settings.fonts.find((x) => x.name.toLowerCase() === name || x.id === name);
          if (f) res.fontId = f.id;
        }
      }
    }
    return res;
  }

  effectiveFontId(file) {
    const n = this.getNoteSettings(file);
    const id = n.fontId !== undefined ? n.fontId : this.settings.activeFont;
    return id && this.settings.fonts.some((f) => f.id === id) ? id : null;
  }

  /* ---------------- Reading view ---------------- */

  processReading(el, sourcePath, ctx) {
    if (!this.settings.autoDirection) return;
    if (el.closest && el.closest(".cm-metadata-container, .metadata-container")) return;

    const file = sourcePath ? this.app.vault.getAbstractFileByPath(sourcePath) : null;
    const note = this.getNoteSettings(file instanceof TFile ? file : null);
    let forced = note.direction === "rtl" || note.direction === "ltr" ? note.direction : null;
    // older notes: a <div dir> wrapper cut into separate blocks by Reading view
    const sectionForced = this.sectionDirection(el, ctx);
    if (sectionForced) forced = sectionForced;

    el.querySelectorAll("pre").forEach((p) => p.setAttribute("dir", "ltr"));
    el.querySelectorAll("a").forEach((a) => {
      if (URL_TEXT.test((a.textContent || "").trim())) a.classList.add("sb-url");
    });

    const targets = Array.from(el.querySelectorAll(READING_TARGETS));
    if (el.matches && el.matches(READING_TARGETS)) targets.unshift(el);

    for (const t of targets) {
      if (t.hasAttribute("dir") && !t.hasAttribute("data-sb-auto")) continue; // explicit user direction
      if (this.hasExplicitDirAncestor(t)) continue;
      const d = this.wrappedDir(t) || forced || this.elementDirection(t);
      if (d) {
        t.setAttribute("dir", d);
        t.setAttribute("data-sb-auto", "1");
      }
    }

    if (this.settings.isolateRuns) this.isolateReadingRuns(el);
  }

  /** If a block's whole content is <span dir> element(s) of one direction, returns that direction */
  wrappedDir(t) {
    let dir = null;
    const visit = (node) => {
      for (const c of Array.from(node.childNodes)) {
        if (c.nodeType === 3) {
          if ((c.textContent || "").trim()) return false;
          continue;
        }
        if (c.nodeType !== 1) continue;
        const tag = c.tagName;
        if (tag === "BR" || tag === "UL" || tag === "OL" || tag === "INPUT") continue;
        if (tag === "P") {
          if (!visit(c)) return false;
          continue;
        }
        if (tag === "SPAN" && c.hasAttribute("dir") && !c.classList.contains("sb-run")) {
          const d = c.getAttribute("dir");
          if (d !== "rtl" && d !== "ltr") return false;
          if (dir && dir !== d) return false;
          dir = d;
          continue;
        }
        return false;
      }
      return true;
    };
    return visit(t) ? dir : null;
  }

  /** Direction forced by a <div dir> wrapper around this Reading-view section (older notes) */
  sectionDirection(el, ctx) {
    if (!ctx || typeof ctx.getSectionInfo !== "function") return null;
    try {
      const info = ctx.getSectionInfo(el);
      if (!info || typeof info.text !== "string") return null;
      return this.forcedLinesFor(info.text)[info.lineStart] || null;
    } catch (_) {
      return null;
    }
  }

  forcedLinesFor(text) {
    if (this._fcText === text) return this._fcLines;
    const lines = text.split(/\r?\n/);
    const out = new Array(lines.length).fill(null);
    const scanner = new Scanner();
    const stack = [];
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i];
      if (scanner.step(i + 1, t)) continue;
      if (OPEN_DIV.test(t)) stack.push(OPEN_DIV.exec(t)[1].toLowerCase());
      else if (ANY_OPEN_DIV.test(t)) stack.push(null);
      else if (CLOSE_DIV.test(t)) stack.pop();
      else {
        for (let k = stack.length - 1; k >= 0; k--) {
          if (stack[k]) { out[i] = stack[k]; break; }
        }
      }
    }
    this._fcText = text;
    this._fcLines = out;
    return out;
  }

  hasExplicitDirAncestor(node) {
    let p = node.parentElement;
    while (p && p !== document.body) {
      if (p.hasAttribute("dir") && !p.hasAttribute("data-sb-auto")) return true;
      if (p.classList.contains("markdown-preview-view") || p.classList.contains("markdown-rendered")) break;
      p = p.parentElement;
    }
    return false;
  }

  textWalker(el) {
    return el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.closest("code, pre, .math, mjx-container, .frontmatter, script, style")) {
          return NodeFilter.FILTER_REJECT;
        }
        if (p.closest("a") && URL_TEXT.test((node.textContent || "").trim())) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
  }

  elementDirection(el) {
    const walker = this.textWalker(el);
    let text = "";
    let node;
    while ((node = walker.nextNode())) {
      const p = node.parentElement;
      const nested = p.closest("ul, ol");
      if (nested && nested !== el && el.contains(nested) && el.tagName !== "TABLE") continue; // skip nested lists
      text += (node.textContent || "") + " ";
    }
    return classifyText(text, this.settings.detectionMode);
  }

  /** Wrap English runs inside RTL text (and Persian runs inside LTR text) in isolated spans */
  isolateReadingRuns(el) {
    const doc = el.ownerDocument;
    const walker = this.textWalker(el);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) {
      if (!node.parentElement.closest(".sb-run")) nodes.push(node);
    }

    for (const n of nodes) {
      const holder = n.parentElement.closest("[dir]");
      const base = holder ? holder.getAttribute("dir") : null;
      if (base !== "rtl" && base !== "ltr") continue;

      const target = base === "rtl" ? LATIN_RUN : RTL_RUN;
      const other = base === "rtl" ? "ltr" : "rtl";
      const text = n.textContent || "";
      target.lastIndex = 0;

      const frag = doc.createDocumentFragment();
      let lastIdx = 0;
      let found = false;
      let m;
      while ((m = target.exec(text))) {
        found = true;
        if (m.index > lastIdx) frag.append(text.slice(lastIdx, m.index));
        const span = doc.createElement("span");
        span.className = "sb-run";
        span.setAttribute("dir", other);
        span.textContent = m[0];
        frag.append(span);
        lastIdx = m.index + m[0].length;
      }
      if (!found) continue;
      if (lastIdx < text.length) frag.append(text.slice(lastIdx));
      n.replaceWith(frag);
    }
  }

  /** Live Preview renders tables / callouts as widgets that the post-processor never sees */
  setupWidgetObserver() {
    const sel = ".cm-embed-block, .cm-table-widget, .cm-callout";
    const pending = new Set();
    let scheduled = false;

    const flush = () => {
      scheduled = false;
      for (const el of pending) {
        if (el.isConnected) this.processReading(el, this.sourcePathFor(el));
      }
      pending.clear();
    };

    const obs = new MutationObserver((records) => {
      for (const r of records) {
        for (const n of r.addedNodes) {
          if (n.nodeType !== 1) continue;
          if (n.matches(sel)) pending.add(n);
          else if (n.firstElementChild) n.querySelectorAll(sel).forEach((x) => pending.add(x));
        }
      }
      if (pending.size && !scheduled) {
        scheduled = true;
        requestAnimationFrame(flush);
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    this.register(() => obs.disconnect());
  }

  sourcePathFor(el) {
    const holder = el.closest(".workspace-leaf-content");
    if (!holder) return null;
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      if (leaf.view.containerEl === holder && leaf.view.file) return leaf.view.file.path;
    }
    return null;
  }

  /* ---------------- Appearance: fonts, size, line height, title direction ---------------- */

  scheduleRefresh() {
    clearTimeout(this._refreshTimer);
    this._refreshTimer = setTimeout(() => this.refreshAppearance(), 80);
  }

  fontsDir() {
    const dir = this.manifest.dir || `${this.app.vault.configDir}/plugins/${this.manifest.id}`;
    return `${dir}/fonts`;
  }

  async faceBase64(face) {
    const path = `${this.fontsDir()}/${face.file}`;
    if (this.faceCache.has(path)) return this.faceCache.get(path);
    const buf = await this.app.vault.adapter.readBinary(path);
    const b64 = arrayBufferToBase64(buf);
    this.faceCache.set(path, b64);
    return b64;
  }

  /** @font-face rules for every face of a font. Data URIs also work in the PDF-export render. */
  async fontFaceCss(f) {
    if (this.faceCssCache.has(f.id)) return this.faceCssCache.get(f.id);
    let css = "";
    for (const slot of SLOTS) {
      const face = f.faces && f.faces[slot];
      if (!face) continue;
      try {
        const b64 = await this.faceBase64(face);
        const [mime, fmt] = FONT_FORMATS[face.ext] || FONT_FORMATS.ttf;
        const [weight, style] = SLOT_CSS[slot];
        css +=
          `@font-face{font-family:"SBFont-${f.id}";src:url("data:${mime};base64,${b64}") format("${fmt}");` +
          `font-weight:${weight};font-style:${style};font-display:block;}\n`;
      } catch (err) {
        console.error("[LFR Extension] cannot load font face", f.name, slot, err);
      }
    }
    this.faceCssCache.set(f.id, css);
    return css;
  }

  async buildCss(used, activeId) {
    let css = "";
    for (const id of used) {
      const f = this.settings.fonts.find((x) => x.id === id);
      if (!f) continue;
      css += await this.fontFaceCss(f);
      const fam = `"SBFont-${id}",var(--font-text)`;
      const pre = `[data-sb-font="${id}"] `;
      css += TEXT_LIST.map((s) => pre + s).join(",") + `{font-family:${fam}!important;}\n`;
      css += CODE_LIST.map((s) => pre + s).join(",") + `{font-family:var(--font-monospace)!important;}\n`;
    }

    // PDF export renders outside the workspace, so use the font of the note being exported (the active note)
    if (activeId) {
      css += `.print,.print .markdown-rendered,.print .markdown-preview-view{font-family:"SBFont-${activeId}",var(--font-text)!important;}\n`;
      css +=
        ".print code,.print pre,.print pre *,.print kbd,.print .frontmatter,.print .frontmatter *" +
        "{font-family:var(--font-monospace)!important;}\n";
    }

    const vars = [];
    if (this.settings.fontSize > 0) vars.push(`--font-text-size:${this.settings.fontSize}px;`);
    if (this.settings.lineHeight > 0) vars.push(`--line-height-normal:${this.settings.lineHeight};`);
    if (vars.length) {
      css += `.markdown-source-view.mod-cm6,.markdown-preview-view,.markdown-rendered,.print .markdown-rendered{${vars.join("")}}\n`;
    }
    return css;
  }

  async refreshAppearance() {
    if (this._refreshing) {
      this._again = true;
      return;
    }
    this._refreshing = true;
    try {
      do {
        this._again = false;
        document.body.classList.toggle("sb-beautify", !!this.settings.beautifyRtl);

        const used = new Set();
        for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
          const view = leaf.view;
          if (!(view instanceof MarkdownView) || !view.containerEl) continue;
          const id = this.effectiveFontId(view.file);
          if (id) {
            view.containerEl.setAttribute("data-sb-font", id);
            used.add(id);
          } else {
            view.containerEl.removeAttribute("data-sb-font");
          }
          this.applyTitleDirection(view);
        }
        const activeId = this.effectiveFontId(this.app.workspace.getActiveFile());
        if (activeId) used.add(activeId);

        this.fontStyleEl.textContent = await this.buildCss(used, activeId);
      } while (this._again);
    } catch (err) {
      console.error("[LFR Extension]", err);
    } finally {
      this._refreshing = false;
    }
  }

  applyTitleDirection(view) {
    const t = view.containerEl.querySelector(".inline-title");
    if (!t) return;
    if (!this.settings.autoDirection) {
      t.removeAttribute("dir");
      return;
    }
    const note = this.getNoteSettings(view.file);
    const d =
      note.direction === "rtl" || note.direction === "ltr"
        ? note.direction
        : classifyText(t.textContent || "", this.settings.detectionMode);
    if (d) t.setAttribute("dir", d);
  }

  /* ---------------- Fonts: menu ---------------- */

  addFontMenu(menu) {
    const fonts = this.settings.fonts;

    const fill = (m) => {
      m.addItem((i) => i.setTitle("Add Font").setIcon("plus").onClick(() => this.pickFont({})));
      if (fonts.length) {
        m.addSeparator();
        for (const f of fonts) {
          m.addItem((i) => {
            i.setTitle(f.name).onClick(async () => {
              // clicking the active font again returns to the theme font
              this.settings.activeFont = this.settings.activeFont === f.id ? null : f.id;
              await this.saveSettings();
              await this.refreshAppearance();
            });
            if (typeof i.setChecked === "function") i.setChecked(this.settings.activeFont === f.id);
            // show the font name in the font itself
            if (i.dom) i.dom.style.fontFamily = `"SBPreview-${f.id}", var(--font-interface)`;
            this.ensurePreview(f);
          });
        }
      }
    };

    menu.addItem((item) => {
      item.setTitle("Font").setIcon("type");
      if (typeof item.setSubmenu === "function") {
        fill(item.setSubmenu());
      } else {
        // very old / mobile fallback: flat entry
        item.setTitle("Font: Add Font").setIcon("plus").onClick(() => this.pickFont({}));
      }
    });
  }

  /** Loads the regular face of a font into the document so menu items can use it as a preview */
  async ensurePreview(f) {
    if (this.previews.has(f.id)) return;
    const face = (f.faces && (f.faces.regular || f.faces.bold || f.faces.italic || f.faces.boldItalic)) || null;
    if (!face) return;
    try {
      const buf = await this.app.vault.adapter.readBinary(`${this.fontsDir()}/${face.file}`);
      const ff = new FontFace(`SBPreview-${f.id}`, buf);
      await ff.load();
      document.fonts.add(ff);
      this.previews.set(f.id, ff);
    } catch (err) {
      console.error("[LFR Extension] preview failed", f.name, err);
    }
  }

  dropPreview(id) {
    const ff = this.previews.get(id);
    if (ff) document.fonts.delete(ff);
    this.previews.delete(id);
  }

  /* ---------------- Fonts: import / delete ---------------- */

  /** opts: {} -> pick one or more files (Regular/Bold/Italic detected from the file names)
   *        { fontId, slot } -> pick one file for a specific style of an existing font */
  pickFont(opts) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".ttf,.otf,.woff,.woff2";
    input.multiple = !opts.slot;
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      if (!files.length) return;
      try {
        await this.importFonts(files, opts);
      } catch (err) {
        console.error("[LFR Extension]", err);
        new Notice("Could not add font: " + (err && err.message ? err.message : err));
      }
    };
    input.click();
  }

  async importFonts(files, opts) {
    const adapter = this.app.vault.adapter;
    const dir = this.fontsDir();
    if (!(await adapter.exists(dir))) await adapter.mkdir(dir);

    const touched = new Set();
    for (const file of files) {
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      if (!FONT_FORMATS[ext]) throw new Error(`${file.name}: unsupported type (use ttf, otf, woff or woff2).`);
      if (file.size > 25 * 1024 * 1024) throw new Error(`${file.name}: larger than 25 MB.`);

      const buf = await file.arrayBuffer();
      try {
        await new FontFace("SBFontTest", buf.slice(0)).load(); // make sure it is a valid font
      } catch (_) {
        throw new Error(`${file.name} is not a valid font file.`);
      }

      let family;
      let slot;
      if (opts.fontId && opts.slot) {
        const target = this.settings.fonts.find((x) => x.id === opts.fontId);
        if (!target) continue;
        family = target.name;
        slot = opts.slot;
      } else {
        ({ family, slot } = parseFontFile(file.name));
      }

      let font = this.settings.fonts.find((x) => x.name.toLowerCase() === family.toLowerCase());
      if (!font) {
        font = { id: newId(), name: family, faces: {} };
        this.settings.fonts.push(font);
      }

      const fileName = `${font.id}-${slot}.${ext}`;
      const old = font.faces[slot];
      if (old && old.file !== fileName) {
        try { await adapter.remove(`${dir}/${old.file}`); } catch (_) { /* ignore */ }
      }
      await adapter.writeBinary(`${dir}/${fileName}`, buf);
      this.faceCache.delete(`${dir}/${fileName}`);
      if (old) this.faceCache.delete(`${dir}/${old.file}`);
      font.faces[slot] = { ext, file: fileName };
      this.faceCssCache.delete(font.id);
      this.dropPreview(font.id);
      touched.add(font.name);
    }

    await this.saveSettings();
    await this.refreshAppearance();
    const names = Array.from(touched).join(", ");
    new Notice(`Font added: ${names}. Pick it from ⋯ → Font.`);
  }

  async deleteFont(id) {
    const f = this.settings.fonts.find((x) => x.id === id);
    if (!f) return;
    const dir = this.fontsDir();
    for (const slot of SLOTS) {
      const face = f.faces && f.faces[slot];
      if (!face) continue;
      try { await this.app.vault.adapter.remove(`${dir}/${face.file}`); } catch (_) { /* ignore */ }
      this.faceCache.delete(`${dir}/${face.file}`);
    }
    this.faceCssCache.delete(id);
    this.dropPreview(id);
    this.settings.fonts = this.settings.fonts.filter((x) => x.id !== id);
    if (this.settings.activeFont === id) this.settings.activeFont = null;
    for (const r of this.settings.folderRules) if (r.font === id) r.font = "";
    await this.saveSettings();
    await this.refreshAppearance();
  }

  /* ---------------- Commands ---------------- */

  registerCommands() {
    this.addCommand({
      id: "selection-rtl",
      name: "Set selection direction: RTL",
      editorCallback: (editor) => this.setDirection(editor, "rtl"),
    });
    this.addCommand({
      id: "selection-ltr",
      name: "Set selection direction: LTR",
      editorCallback: (editor) => this.setDirection(editor, "ltr"),
    });

    this.addCommand({
      id: "paragraph-rtl",
      name: "Set current paragraph direction: RTL",
      editorCallback: (editor) => this.setParagraphDirection(editor, "rtl"),
    });
    this.addCommand({
      id: "paragraph-ltr",
      name: "Set current paragraph direction: LTR",
      editorCallback: (editor) => this.setParagraphDirection(editor, "ltr"),
    });
    this.addCommand({
      id: "paragraph-auto",
      name: "Set current paragraph direction: Auto (remove manual direction)",
      editorCallback: (editor) => this.setParagraphDirection(editor, "auto"),
    });
    this.addCommand({
      id: "paragraph-toggle",
      name: "Toggle current paragraph direction (RTL / LTR)",
      editorCallback: (editor) => this.toggleParagraphDirection(editor),
    });

    for (const d of ["rtl", "ltr", "auto"]) {
      this.addCommand({
        id: `note-${d}`,
        name: `Set note direction: ${d === "auto" ? "Auto" : d.toUpperCase()}`,
        editorCallback: (editor, view) => this.setNoteDirection(view.file, d),
      });
    }

    this.addCommand({
      id: "persian-cleanup",
      name: "Persian: clean up text (all fixes)",
      editorCallback: (editor) => this.runPersianTool(editor, persianCleanup, "Persian cleanup"),
    });
    this.addCommand({
      id: "persian-half-spaces",
      name: "Persian: fix half-spaces (نیم‌فاصله)",
      editorCallback: (editor) => this.runPersianTool(editor, fixHalfSpaces, "Half-spaces"),
    });
    this.addCommand({
      id: "persian-arabic-letters",
      name: "Persian: convert Arabic letters (ي ك → ی ک)",
      editorCallback: (editor) => this.runPersianTool(editor, arabicToPersian, "Arabic letters"),
    });
    this.addCommand({
      id: "persian-punctuation",
      name: "Persian: fix punctuation (, ? ; → ، ؟ ؛)",
      editorCallback: (editor) => this.runPersianTool(editor, fixPersianPunctuation, "Punctuation"),
    });
  }

  /* ---------------- Persian tools ---------------- */

  /** Applies fn to the selection, or to the whole note (without frontmatter) when nothing is selected */
  runPersianTool(editor, fn, label) {
    const hasSel = editor.somethingSelected();
    const original = hasSel ? editor.getSelection() : editor.getValue();

    let result;
    if (hasSel) {
      result = transformProtected(original, fn);
    } else {
      const fm = /^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(original);
      const head = fm ? fm[0] : "";
      result = head + transformProtected(original.slice(head.length), fn);
    }

    if (result === original) {
      new Notice(`${label}: nothing to change.`);
      return;
    }
    if (hasSel) {
      editor.replaceSelection(result);
    } else {
      const cursor = editor.getCursor();
      const last = editor.lastLine();
      editor.replaceRange(result, { line: 0, ch: 0 }, { line: last, ch: editor.getLine(last).length });
      try { editor.setCursor(cursor); } catch (_) { /* ignore */ }
    }
    new Notice(`${label}: done${hasSel ? " (selection)" : " (whole note)"}.`);
  }

  addPersianMenu(menu, editor) {
    menu.addItem((item) => {
      item.setTitle("Persian tools").setIcon("languages");
      if (typeof item.setSubmenu !== "function") return;
      const sub = item.setSubmenu();
      const add = (title, icon, fn, label) =>
        sub.addItem((i) => i.setTitle(title).setIcon(icon).onClick(() => this.runPersianTool(editor, fn, label)));
      add("Clean up (all)", "wand-sparkles", persianCleanup, "Persian cleanup");
      sub.addSeparator();
      add("Fix half-spaces", "space", fixHalfSpaces, "Half-spaces");
      add("Arabic → Persian letters", "replace", arabicToPersian, "Arabic letters");
      add("Fix punctuation ( ، ؟ ؛ )", "quote", fixPersianPunctuation, "Punctuation");
    });
  }

  /* ---------------- Context menu: Format -> RTL / LTR ---------------- */

  onEditorMenu(menu, editor) {
    if (editor.somethingSelected()) {
      const addItems = (m) => {
        m.addItem((i) =>
          i.setTitle("RTL").setIcon("align-right").onClick(() => this.setDirection(editor, "rtl"))
        );
        m.addItem((i) =>
          i.setTitle("LTR").setIcon("align-left").onClick(() => this.setDirection(editor, "ltr"))
        );
      };

      const formatSub = this.findFormatSubmenu(menu);
      if (formatSub) {
        addItems(formatSub);
      } else {
        // Fallback: if Obsidian's native "Format" submenu can't be reached
        menu.addItem((item) => {
          item.setTitle("Text direction").setIcon("arrow-left-right");
          if (typeof item.setSubmenu === "function") addItems(item.setSubmenu());
        });
      }
    }
    this.addPersianMenu(menu, editor);
  }

  findFormatSubmenu(menu) {
    const items = menu.items || [];
    for (const it of items) {
      const sub = it.submenu;
      if (!sub) continue;
      const title = ((it.dom && it.dom.textContent) || "").trim();
      if (/^format$/i.test(title)) return sub;
      const hasBold = (sub.items || []).some(
        (x) => x.dom && x.dom.querySelector('[class*="lucide-bold"]')
      );
      if (hasBold) return sub;
    }
    return null;
  }

  /* ---------------- Direction: selection ---------------- */

  setDirection(editor, dir) {
    const from = editor.getCursor("from");
    const to = editor.getCursor("to");
    const sel = editor.getRange(from, to);
    if (!sel.trim()) {
      // nothing selected: act on the current paragraph
      this.setParagraphDirection(editor, dir);
      return;
    }

    const multi = from.line !== to.line;
    const lineText = editor.getLine(from.line);
    const whole = !multi && sel.trim() === lineText.trim();

    if (multi || whole) {
      let endLine = to.line;
      if (multi && to.ch === 0) endLine--; // selection ended at the start of the next line
      this.setBlockDirection(editor, from.line, endLine, dir);
    } else {
      this.setInlineDirection(editor, from, to, lineText, dir);
    }
  }

  /** Finds an existing <div dir> wrapper around lines a..b */
  findWrap(editor, a, b) {
    const line = (n) => editor.getLine(n);
    const lastLine = editor.lastLine();
    let s = a;
    let e = b;
    while (s < e && !line(s).trim()) s++;
    while (e > s && !line(e).trim()) e--;

    if (e > s && OPEN_DIV.test(line(s)) && CLOSE_DIV.test(line(e))) {
      return { open: s, close: e, s, e };
    }
    let p = s - 1;
    while (p >= 0 && !line(p).trim()) p--;
    let n = e + 1;
    while (n <= lastLine && !line(n).trim()) n++;
    if (p >= 0 && n <= lastLine && OPEN_DIV.test(line(p)) && CLOSE_DIV.test(line(n))) {
      return { open: p, close: n, s, e };
    }
    return { open: -1, close: -1, s, e };
  }

  unwrapBlock(editor, wrap) {
    const line = (n) => editor.getLine(n);
    const inner = [];
    for (let i = wrap.open + 1; i < wrap.close; i++) inner.push(line(i));
    while (inner.length && !inner[0].trim()) inner.shift();
    while (inner.length && !inner[inner.length - 1].trim()) inner.pop();
    editor.replaceRange(
      inner.join("\n"),
      { line: wrap.open, ch: 0 },
      { line: wrap.close, ch: line(wrap.close).length }
    );
  }

  setBlockDirection(editor, a, b, dir) {
    const line = (n) => editor.getLine(n);
    const w = this.findWrap(editor, a, b);

    if (w.open >= 0) {
      const current = OPEN_DIV.exec(line(w.open))[1].toLowerCase();
      if (current === dir) {
        this.unwrapBlock(editor, w); // same direction again -> remove the wrapper
      } else {
        editor.replaceRange(
          `<div dir="${dir}">`,
          { line: w.open, ch: 0 },
          { line: w.open, ch: line(w.open).length }
        );
      }
      return;
    }

    // Whole lines: wrap the content of each line in <span dir>. Unlike a <div> around several
    // blocks, this also works in Reading view and PDF export (each block is rendered separately there).
    this.wrapLines(editor, w.s, w.e, dir);
  }

  /** Lines in a..b that can carry a direction span (not code, tables, rules, tags or empty) */
  eligibleLines(editor, a, b) {
    const scanner = new Scanner();
    const out = [];
    for (let i = 0; i <= b; i++) {
      const text = editor.getLine(i);
      const mono = scanner.step(i + 1, text);
      if (i < a || mono) continue;
      const t = text.trim();
      if (!t || t.startsWith("|") || t.startsWith("%%") || HR_RE.test(text) || /^<\/?div\b/i.test(t)) continue;
      if (!text.slice(LINE_PREFIX.exec(text)[0].length).trim()) continue;
      out.push(i);
    }
    return out;
  }

  /** Rewrites the content (after the markdown markers) of the given lines */
  rewriteLines(editor, a, b, idx, fn) {
    const lines = [];
    for (let i = a; i <= b; i++) lines.push(editor.getLine(i));
    const lastLen = lines[lines.length - 1].length;
    for (const i of idx) {
      const text = lines[i - a];
      const prefix = LINE_PREFIX.exec(text)[0];
      const rest = text.slice(prefix.length);
      const trail = /\s*$/.exec(rest)[0];
      const core = rest.slice(0, rest.length - trail.length);
      const m = SPAN_ONLY.exec(core);
      lines[i - a] = prefix + fn(m ? m[2] : core) + trail;
    }
    editor.replaceRange(lines.join("\n"), { line: a, ch: 0 }, { line: b, ch: lastLen });
    editor.setCursor({ line: b, ch: lines[lines.length - 1].length }); // keeps the hidden tags hidden
  }

  wrapLines(editor, a, b, dir) {
    const idx = this.eligibleLines(editor, a, b);
    if (!idx.length) {
      new Notice("Nothing to change: code, tables, rules and empty lines are skipped.");
      return;
    }
    // choosing the same direction again removes it
    const allSame = idx.every((i) => spanWrappedDir(editor.getLine(i)) === dir);
    this.rewriteLines(editor, a, b, idx, (inner) => (allSame ? inner : `<span dir="${dir}">${inner}</span>`));
  }

  /** Removes per-line direction spans; returns false when there was nothing to remove */
  clearLines(editor, a, b) {
    const idx = this.eligibleLines(editor, a, b).filter((i) => spanWrappedDir(editor.getLine(i)));
    if (!idx.length) return false;
    this.rewriteLines(editor, a, b, idx, (inner) => inner);
    return true;
  }

  setInlineDirection(editor, from, to, lineText, dir) {
    const before = lineText.slice(0, from.ch);
    const after = lineText.slice(to.ch);
    const inner = editor.getRange(from, to);

    const put = (text, start, end) => {
      editor.replaceRange(text, start, end);
      editor.setCursor({ line: start.line, ch: start.ch + text.length });
    };

    // Selection sits inside an existing <span dir="..">…</span>
    const mb = /<span dir="(rtl|ltr)">$/.exec(before);
    if (mb && after.startsWith("</span>")) {
      put(
        mb[1] === dir ? inner : `<span dir="${dir}">${inner}</span>`,
        { line: from.line, ch: from.ch - mb[0].length },
        { line: from.line, ch: to.ch + "</span>".length }
      );
      return;
    }

    // Selection includes the span tags
    const ms = /^<span dir="(rtl|ltr)">([\s\S]*)<\/span>$/.exec(inner);
    if (ms) {
      put(ms[1] === dir ? ms[2] : `<span dir="${dir}">${ms[2]}</span>`, from, to);
      return;
    }

    put(`<span dir="${dir}">${inner}</span>`, from, to);
  }

  /* ---------------- Direction: current paragraph / note ---------------- */

  paragraphBounds(editor, lineNo) {
    if (!editor.getLine(lineNo).trim()) return null;
    let a = lineNo;
    let b = lineNo;
    while (a > 0 && editor.getLine(a - 1).trim()) a--;
    while (b < editor.lastLine() && editor.getLine(b + 1).trim()) b++;
    return { a, b };
  }

  isCodeLine(editor, lineNo) {
    const scanner = new Scanner();
    let mono = false;
    for (let i = 0; i <= lineNo; i++) mono = scanner.step(i + 1, editor.getLine(i));
    return mono;
  }

  setParagraphDirection(editor, dir) {
    const cur = editor.getCursor("from");
    const bounds = this.paragraphBounds(editor, cur.line);
    if (!bounds) {
      new Notice("Place the cursor inside a paragraph.");
      return;
    }
    if (this.isCodeLine(editor, cur.line)) {
      new Notice("Code and YAML are always LTR.");
      return;
    }
    if (dir === "auto") {
      const w = this.findWrap(editor, bounds.a, bounds.b);
      if (w.open >= 0) this.unwrapBlock(editor, w);
      else if (!this.clearLines(editor, bounds.a, bounds.b)) new Notice("This paragraph has no manual direction.");
      return;
    }
    this.setBlockDirection(editor, bounds.a, bounds.b, dir);
  }

  toggleParagraphDirection(editor) {
    const cm = editor.cm;
    const cur = editor.getCursor("from");
    let current = "ltr";
    if (cm) current = lineDirectionAt(cm.state, this, cur.line + 1).dir;
    this.setParagraphDirection(editor, current === "rtl" ? "ltr" : "rtl");
  }

  async setNoteDirection(file, dir) {
    if (!file) return;
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      if (dir === "auto") {
        delete fm.direction;
        delete fm.dir;
      } else {
        fm.direction = dir;
        delete fm.dir;
      }
    });
    new Notice(`Note direction: ${dir === "auto" ? "Auto" : dir.toUpperCase()}`);
  }

  /* ---------------- Status bar ---------------- */

  queueStatus(view) {
    if (!this.statusEl || this._statusRaf) return;
    this._statusRaf = requestAnimationFrame(() => {
      this._statusRaf = null;
      this.updateStatus(view);
    });
  }

  updateStatus(view) {
    if (!this.statusEl) return;
    const mv = this.app.workspace.getActiveViewOfType(MarkdownView);
    const cm = mv && mv.editor ? mv.editor.cm : null;
    if (
      !this.settings.statusBar ||
      !mv ||
      !cm ||
      mv.getMode() !== "source" ||
      (view && cm !== view)
    ) {
      this.statusEl.style.display = "none";
      return;
    }

    const lineNo = cm.state.doc.lineAt(cm.state.selection.main.head).number;
    const { dir, mono } = lineDirectionAt(cm.state, this, lineNo);
    const key = dir + (mono ? "m" : "");
    if (this._statusKey === key && this.statusEl.style.display !== "none") return;
    this._statusKey = key;

    this.statusEl.style.display = "";
    this.statusEl.empty();
    const icon = this.statusEl.createSpan({ cls: "sb-status-icon" });
    setIcon(icon, dir === "rtl" ? "align-right" : "align-left");
    this.statusEl.createSpan({ text: dir.toUpperCase() + (mono ? " · code" : "") });
    this.statusEl.setAttribute("aria-label", "Paragraph direction - click to change");
  }

  openDirectionMenu(evt) {
    const mv = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!mv || !mv.editor) return;
    const editor = mv.editor;
    const menu = new Menu();

    menu.addItem((i) =>
      i.setTitle("Paragraph: RTL").setIcon("align-right").onClick(() => this.setParagraphDirection(editor, "rtl"))
    );
    menu.addItem((i) =>
      i.setTitle("Paragraph: LTR").setIcon("align-left").onClick(() => this.setParagraphDirection(editor, "ltr"))
    );
    menu.addItem((i) =>
      i.setTitle("Paragraph: Auto").setIcon("rotate-ccw").onClick(() => this.setParagraphDirection(editor, "auto"))
    );
    menu.addSeparator();
    menu.addItem((i) =>
      i.setTitle("This note: RTL").setIcon("file-text").onClick(() => this.setNoteDirection(mv.file, "rtl"))
    );
    menu.addItem((i) =>
      i.setTitle("This note: LTR").setIcon("file-text").onClick(() => this.setNoteDirection(mv.file, "ltr"))
    );
    menu.addItem((i) =>
      i.setTitle("This note: Auto").setIcon("file-text").onClick(() => this.setNoteDirection(mv.file, "auto"))
    );
    menu.showAtMouseEvent(evt);
  }
};

/* =====================================================================
 *  Settings tab
 * ===================================================================*/

class SettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    const plugin = this.plugin;
    const s = plugin.settings;
    containerEl.empty();

    /* ---- Direction ---- */
    new Setting(containerEl).setName("Text direction").setHeading();

    new Setting(containerEl)
      .setName("Smart text direction")
      .setDesc(
        "Detects RTL/LTR for each paragraph. Code blocks, YAML and URLs are always LTR. " +
          "Turn off Obsidian's built-in \"Right-to-left\" option to avoid conflicts. " +
          "Reading view updates after re-opening the note."
      )
      .addToggle((t) =>
        t.setValue(s.autoDirection).onChange(async (v) => {
          s.autoDirection = v;
          await plugin.saveSettings();
          plugin.refreshEditors();
          plugin.scheduleRefresh();
        })
      );

    new Setting(containerEl)
      .setName("Direction detection")
      .setDesc(
        "Majority of words: the paragraph follows the language most of its words are written in " +
          "(best for sentences that start with an English word). First strong letter: the paragraph follows its first letter."
      )
      .addDropdown((d) =>
        d
          .addOption("majority", "Majority of words (recommended)")
          .addOption("first", "First strong letter")
          .setValue(s.detectionMode)
          .onChange(async (v) => {
            s.detectionMode = v;
            await plugin.saveSettings();
            plugin.refreshEditors();
            plugin.scheduleRefresh();
          })
      );

    new Setting(containerEl)
      .setName("Isolate mixed-direction text")
      .setDesc(
        "Keeps English phrases inside Persian sentences (and Persian inside English) in the right order, " +
          "including punctuation and parentheses next to them."
      )
      .addToggle((t) =>
        t.setValue(s.isolateRuns).onChange(async (v) => {
          s.isolateRuns = v;
          await plugin.saveSettings();
          plugin.refreshEditors();
        })
      );

    new Setting(containerEl)
      .setName("Beautify RTL markdown")
      .setDesc("Mirrors list indents, blockquote bars, callouts, tables and checkboxes in right-to-left text.")
      .addToggle((t) =>
        t.setValue(s.beautifyRtl).onChange(async (v) => {
          s.beautifyRtl = v;
          await plugin.saveSettings();
          plugin.scheduleRefresh();
        })
      );

    new Setting(containerEl)
      .setName("Status bar direction button")
      .setDesc("Shows the direction of the current paragraph; click to change it (desktop only).")
      .addToggle((t) =>
        t.setValue(s.statusBar).onChange(async (v) => {
          s.statusBar = v;
          await plugin.saveSettings();
          plugin.updateStatus();
        })
      );

    /* ---- Appearance ---- */
    new Setting(containerEl).setName("Appearance").setHeading();

    new Setting(containerEl)
      .setName("Font size (px)")
      .setDesc("Leave empty to use the theme's size. Applies to the editor, Reading view and PDF export.")
      .addText((t) =>
        t
          .setPlaceholder("theme default")
          .setValue(s.fontSize > 0 ? String(s.fontSize) : "")
          .onChange(async (v) => {
            const n = parseFloat(v);
            s.fontSize = n >= 8 && n <= 64 ? n : 0;
            await plugin.saveSettings();
            plugin.scheduleRefresh();
          })
      );

    new Setting(containerEl)
      .setName("Line height")
      .setDesc("For example 1.8. Leave empty to use the theme's value.")
      .addText((t) =>
        t
          .setPlaceholder("theme default")
          .setValue(s.lineHeight > 0 ? String(s.lineHeight) : "")
          .onChange(async (v) => {
            const n = parseFloat(v);
            s.lineHeight = n >= 1 && n <= 4 ? n : 0;
            await plugin.saveSettings();
            plugin.scheduleRefresh();
          })
      );

    /* ---- Fonts ---- */
    new Setting(containerEl).setName("Fonts").setHeading();

    new Setting(containerEl)
      .setName("Add font")
      .setDesc(
        "ttf, otf, woff or woff2. Select several files at once (for example Vazirmatn-Regular, -Bold and -Italic) " +
          "and they are grouped into one font automatically by their file names."
      )
      .addButton((b) => b.setButtonText("Add Font").onClick(() => plugin.pickFont({})))
      .addButton((b) =>
        b.setButtonText("Use theme font").onClick(async () => {
          s.activeFont = null;
          await plugin.saveSettings();
          await plugin.refreshAppearance();
          this.display();
        })
      );

    for (const f of s.fonts) {
      plugin.ensurePreview(f);
      const active = s.activeFont === f.id;
      const row = new Setting(containerEl)
        .setName(f.name)
        .setDesc(active ? "Active" : "")
        .addButton((b) =>
          b.setButtonText(active ? "Active" : "Use").setDisabled(active).onClick(async () => {
            s.activeFont = f.id;
            await plugin.saveSettings();
            await plugin.refreshAppearance();
            this.display();
          })
        )
        .addButton((b) =>
          b.setButtonText("Delete").setWarning().onClick(async () => {
            await plugin.deleteFont(f.id);
            this.display();
          })
        );
      row.nameEl.style.fontFamily = `"SBPreview-${f.id}", var(--font-interface)`;

      const styles = new Setting(containerEl).setDesc("Font styles (a missing Bold/Italic is synthesized by the browser)");
      styles.settingEl.addClass("sb-font-styles");
      for (const slot of SLOTS) {
        const has = !!(f.faces && f.faces[slot]);
        styles.addButton((b) =>
          b
            .setButtonText(`${SLOT_LABEL[slot]}${has ? " ✓" : ""}`)
            .onClick(() => plugin.pickFont({ fontId: f.id, slot }))
        );
      }
    }

    /* ---- Folder rules ---- */
    new Setting(containerEl).setName("Folder rules").setHeading();
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text:
        "Give a folder its own direction and font. A note can override these with frontmatter: " +
        "direction: rtl | ltr | auto   and   font: <font name> | none.",
    });

    s.folderRules.forEach((rule, idx) => {
      new Setting(containerEl)
        .addText((t) =>
          t
            .setPlaceholder("Folder path, e.g. Persian/Notes")
            .setValue(rule.path || "")
            .onChange(async (v) => {
              rule.path = v;
              await plugin.saveSettings();
              plugin.refreshEditors();
              plugin.scheduleRefresh();
            })
        )
        .addDropdown((d) =>
          d
            .addOption("auto", "Direction: auto")
            .addOption("rtl", "Direction: RTL")
            .addOption("ltr", "Direction: LTR")
            .setValue(rule.direction || "auto")
            .onChange(async (v) => {
              rule.direction = v;
              await plugin.saveSettings();
              plugin.refreshEditors();
            })
        )
        .addDropdown((d) => {
          d.addOption("", "Font: inherit");
          for (const f of s.fonts) d.addOption(f.id, `Font: ${f.name}`);
          d.setValue(rule.font || "").onChange(async (v) => {
            rule.font = v;
            await plugin.saveSettings();
            plugin.scheduleRefresh();
          });
        })
        .addExtraButton((b) =>
          b.setIcon("trash").setTooltip("Remove rule").onClick(async () => {
            s.folderRules.splice(idx, 1);
            await plugin.saveSettings();
            plugin.refreshEditors();
            plugin.scheduleRefresh();
            this.display();
          })
        );
    });

    new Setting(containerEl).addButton((b) =>
      b.setButtonText("Add folder rule").onClick(async () => {
        s.folderRules.push({ path: "", direction: "auto", font: "" });
        await plugin.saveSettings();
        this.display();
      })
    );
  }
}
