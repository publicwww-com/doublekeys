/**
 * doublekeys — an on-screen keyboard for the DeepSeek Harness web composer.
 *
 * A plain browser bundle: no build step, no dependencies besides React from the
 * page module table. The factory registers the module and every side effect
 * lives inside `apply(ctx)`.
 *
 * How it works:
 * - Text goes into the composer through the conversation plugin's public
 *   `inputActions`: `captureInsertion()` plus `insertText()`. Backspace is the
 *   same call with an empty string over the previous character, the line-break
 *   key inserts "\n" and the composer renders it as a real line. Nothing is
 *   predicted, completed or case-corrected: the character that was tapped is
 *   the character that lands, and Shift is a sticky manual toggle.
 * - The keyboard lives in the `conversation.input.dock` slot, whose anchor is
 *   `display: contents`, so the surface becomes a flex item of the composer
 *   column and `order: 10` puts it right below the composer card. The toggle is
 *   a small button in `conversation.input.right`; the panel has no header.
 * - Four arrangements: one keyboard with pages, digits split to the edges,
 *   letters split to the edges, or both side by side. The switch happens at the
 *   configured split width, measured on the composer container itself.
 * - While the panel is open the composer gets `inputmode="none"` (plus
 *   autocomplete hints off) so a focus does not raise the system keyboard, and
 *   the plugin gives up focusing entirely if the device ignores that.
 * - Word selection in the composer (double click, double tap, long press) is
 *   implemented here because the composer is not a plain text field.
 */
window.__ModuleLoader__.load({
	id: 'doublekeys',
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		const React = require('react');
		const h = React.createElement;

		const NS = 'doublekeys';
		const STYLE_ID = 'doublekeys/keyboard.css';
		const STORAGE_OPEN = 'doublekeys.open';
		const STORAGE_LANG = 'doublekeys.lang';
		const STORAGE_LANGS = 'doublekeys.langs';
		const STORAGE_MODE = 'doublekeys.mode';
		const STORAGE_BREAK = 'doublekeys.breakWidth';
		const STORAGE_NO_FOCUS = 'doublekeys.noFocus';
		const COMPOSER_SELECTOR = '[data-composer-input]';
		/** A fall of the visual viewport taller than this share means the system keyboard opened. */
		const SYSTEM_KEYBOARD_SHRINK = 0.25;

		// ── Languages ──────────────────────────────────────────────────────────
		// Plain character layouts (no dead keys, no IME): the three letter rows of
		// the language plus optional rows of accented letters.
		const LANGUAGES = {
			en: {
				label: 'English',
				code: 'EN',
				rows: [
					['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
					['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
					['z', 'x', 'c', 'v', 'b', 'n', 'm'],
				],
				accents: {},
			},
			es: {
				label: 'Español',
				code: 'ES',
				rows: [
					['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
					['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ñ'],
					['z', 'x', 'c', 'v', 'b', 'n', 'm'],
				],
				accents: { a: ['á'], e: ['é'], i: ['í'], o: ['ó'], u: ['ú', 'ü'] },
			},
			fr: {
				label: 'Français',
				code: 'FR',
				rows: [
					['a', 'z', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
					['q', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm'],
					['w', 'x', 'c', 'v', 'b', 'n'],
				],
				accents: { e: ['é', 'è', 'ê', 'ë'], a: ['à', 'â'], c: ['ç'], i: ['î', 'ï'], o: ['ô'], u: ['ù', 'û'], y: ['ÿ'] },
			},
			de: {
				label: 'Deutsch',
				code: 'DE',
				rows: [
					['q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p', 'ü'],
					['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ö', 'ä'],
					['y', 'x', 'c', 'v', 'b', 'n', 'm'],
				],
				accents: { s: ['ß'] },
				upper: { ß: 'ß' },
			},
			it: {
				label: 'Italiano',
				code: 'IT',
				rows: [
					['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
					['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
					['z', 'x', 'c', 'v', 'b', 'n', 'm'],
				],
				accents: { a: ['à'], e: ['è', 'é'], i: ['ì'], o: ['ò'], u: ['ù'] },
			},
			pt: {
				label: 'Português',
				code: 'PT',
				rows: [
					['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
					['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
					['z', 'x', 'c', 'v', 'b', 'n', 'm'],
				],
				accents: { a: ['á', 'à', 'â', 'ã'], o: ['ó', 'ô', 'õ'], e: ['é', 'ê'], i: ['í'], u: ['ú'], c: ['ç'] },
			},
			pl: {
				label: 'Polski',
				code: 'PL',
				rows: [
					['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
					['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
					['z', 'x', 'c', 'v', 'b', 'n', 'm'],
				],
				accents: { a: ['ą'], c: ['ć'], e: ['ę'], l: ['ł'], n: ['ń'], o: ['ó'], s: ['ś'], z: ['ź', 'ż'] },
			},
			tr: {
				label: 'Türkçe',
				code: 'TR',
				rows: [
					['q', 'w', 'e', 'r', 't', 'y', 'u', 'ı', 'o', 'p', 'ğ', 'ü'],
					['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ş', 'i'],
					['z', 'x', 'c', 'v', 'b', 'n', 'm', 'ö', 'ç'],
				],
				accents: {},
				upper: { i: 'İ' },
			},
			nl: {
				label: 'Nederlands',
				code: 'NL',
				rows: [
					['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
					['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
					['z', 'x', 'c', 'v', 'b', 'n', 'm'],
				],
				accents: { a: ['á'], e: ['é', 'ë'], i: ['ï'], o: ['ó', 'ö'], u: ['ú', 'ü'] },
			},
			cs: {
				label: 'Čeština',
				code: 'CS',
				rows: [
					['q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p'],
					['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
					['y', 'x', 'c', 'v', 'b', 'n', 'm'],
				],
				accents: { e: ['é', 'ě'], a: ['á'], i: ['í'], o: ['ó'], u: ['ú', 'ů'], y: ['ý'], c: ['č'], s: ['š'], z: ['ž'], r: ['ř'], n: ['ň'], t: ['ť'], d: ['ď'] },
			},
			ro: {
				label: 'Română',
				code: 'RO',
				rows: [
					['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
					['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
					['z', 'x', 'c', 'v', 'b', 'n', 'm'],
				],
				accents: { a: ['ă', 'â'], i: ['î'], s: ['ș'], t: ['ț'] },
			},
			hu: {
				label: 'Magyar',
				code: 'HU',
				rows: [
					['q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p'],
					['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
					['y', 'x', 'c', 'v', 'b', 'n', 'm'],
				],
				accents: { a: ['á'], e: ['é'], i: ['í'], o: ['ó', 'ö', 'ő'], u: ['ú', 'ü', 'ű'] },
			},
			ru: {
				label: 'Русский',
				code: 'РУ',
				rows: [
					['й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х', 'ъ'],
					['ф', 'ы', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'э', 'ё'],
					['я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'б', 'ю'],
				],
				accents: {},
			},
			uk: {
				label: 'Українська',
				code: 'УК',
				rows: [
					['й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х', 'ї'],
					['ф', 'і', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'є'],
					['я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'б', 'ю'],
				],
				accents: { г: ['ґ'] },
			},
			sv: {
				label: 'Svenska',
				code: 'SV',
				rows: [
					['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'å'],
					['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ö', 'ä'],
					['z', 'x', 'c', 'v', 'b', 'n', 'm'],
				],
				accents: { e: ['é'], u: ['ü'] },
			},
		};

		/** Upper-case form of one character, honouring the language's own mapping (tr i → İ, de ß stays ß). */
		function upperOf(character, lang) {
			const language = LANGUAGES[lang];
			const mapped = language === undefined || language.upper === undefined ? undefined : language.upper[character];
			return mapped === undefined ? character.toUpperCase() : mapped;
		}

		const LANGUAGE_CODES = Object.keys(LANGUAGES);

		// ── Numeric block ──────────────────────────────────────────────────────
		// Four rows of twelve: the PC number row, that row with Shift, then the
		// remaining punctuation. Dot and comma are not here — they live on the
		// letters layout, in place.
		const NUMERIC = [
			['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
			['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+'],
			['/', ':', ';', '?', "'", '"', '[', ']', '{', '}', '<', '>'],
			['\\', '|', '~', '€', '«', '»', '—', '…', '№', '§', '₽', '°'],
		];

		const MODES = ['split-digits', 'split-letters', 'side-by-side', 'one'];
		const DEFAULT_MODE = 'split-digits';

		// ── Dictionaries ───────────────────────────────────────────────────────
		// `locale/*.json` carries the Plugin Manager metadata; these are the
		// browser-side strings (a client bundle cannot read package JSON files).
		const DICTS = {
			en: {
				toggle: 'On-screen keyboard',
				settings: 'Keyboard settings',
				'key.shift': 'Shift',
				'key.backspace': 'Backspace',
				'key.newline': 'New line',
				'key.space': 'Space',
				'key.letters': 'ABC',
				'key.digits': 'Digits and symbols',
				'key.lang': 'Layout: {current}. Switch to {next}',
				'key.lang.add': 'Layout: {current}. Open the keyboard settings to add more',
				'settings.title': 'Keyboard',
				'settings.languages': 'Languages',
				'settings.close': 'Close',
				'settings.break': 'Split width',
				'mode.split-digits': 'Split the digits',
				'mode.split-letters': 'Split the letters',
				'mode.side-by-side': 'Side by side',
				'mode.one': 'Always one',
			},
			ru: {
				toggle: 'Экранная клавиатура',
				settings: 'Настройки клавиатуры',
				'key.shift': 'Shift',
				'key.backspace': 'Удалить',
				'key.newline': 'Новая строка',
				'key.space': 'Пробел',
				'key.letters': 'АБВ',
				'key.digits': 'Цифры и символы',
				'key.lang': 'Раскладка: {current}. Переключить на {next}',
				'key.lang.add': 'Раскладка: {current}. Откройте настройки клавиатуры, чтобы добавить языки',
				'settings.title': 'Клавиатура',
				'settings.languages': 'Языки',
				'settings.close': 'Закрыть',
				'settings.break': 'Ширина разрыва',
				'mode.split-digits': 'Рвать цифры',
				'mode.split-letters': 'Рвать буквы',
				'mode.side-by-side': 'Рядом',
				'mode.one': 'Всегда одна',
			},
		};

		// ── Persisted UI state ─────────────────────────────────────────────────
		function readString(key, fallback) {
			try {
				const value = window.localStorage.getItem(key);
				return value === null ? fallback : value;
			} catch (_error) {
				return fallback;
			}
		}

		function writeString(key, value) {
			try {
				window.localStorage.setItem(key, value);
			} catch (_error) {
				/* private mode: the panel still works for this page */
			}
		}

		function readLanguages() {
			try {
				const raw = window.localStorage.getItem(STORAGE_LANGS);
				if (raw === null) return ['en'];
				const parsed = JSON.parse(raw);
				if (!Array.isArray(parsed)) return ['en'];
				const known = parsed.filter((code) => typeof code === 'string' && Object.hasOwn(LANGUAGES, code));
				return known.length === 0 ? ['en'] : [...new Set(known)];
			} catch (_error) {
				return ['en'];
			}
		}

		function readMode() {
			return MODES.includes(readString(STORAGE_MODE, DEFAULT_MODE)) ? readString(STORAGE_MODE, DEFAULT_MODE) : DEFAULT_MODE;
		}

		/** Width below which even the responsive arrangements show one keyboard. */
		const DEFAULT_BREAK_WIDTH = 600;
		const BREAK_WIDTH_MIN = 320;
		const BREAK_WIDTH_MAX = 1600;

		function readBreakWidth() {
			const raw = Number.parseInt(readString(STORAGE_BREAK, String(DEFAULT_BREAK_WIDTH)), 10);
			if (!Number.isFinite(raw)) return DEFAULT_BREAK_WIDTH;
			return Math.min(BREAK_WIDTH_MAX, Math.max(BREAK_WIDTH_MIN, raw));
		}

		function readFlag(key, fallback) {
			try {
				const value = window.localStorage.getItem(key);
				return value === null ? fallback : value === '1';
			} catch (_error) {
				return fallback;
			}
		}

		function writeFlag(key, value) {
			writeString(key, value ? '1' : '0');
		}

		function createStore() {
			const languages = readLanguages();
			const requested = readString(STORAGE_LANG, 'en');
			let snapshot = {
				open: readFlag(STORAGE_OPEN, false),
				lang: languages.includes(requested) ? requested : languages[0],
				langs: languages,
				mode: readMode(),
				breakWidth: readBreakWidth(),
				settings: false,
				shift: false,
				page: 'letters',
			};
			const listeners = new Set();
			const sameLangs = (a, b) => a.length === b.length && a.every((code, index) => code === b[index]);
			return {
				getSnapshot: () => snapshot,
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				update(patch) {
					const next = { ...snapshot, ...patch };
					if (
						next.open === snapshot.open &&
						next.lang === snapshot.lang &&
						next.mode === snapshot.mode &&
						next.breakWidth === snapshot.breakWidth &&
						next.settings === snapshot.settings &&
						next.shift === snapshot.shift &&
						next.page === snapshot.page &&
						sameLangs(next.langs, snapshot.langs)
					) {
						return;
					}
					snapshot = next;
					if (patch.open !== undefined) writeFlag(STORAGE_OPEN, next.open);
					if (patch.lang !== undefined) writeString(STORAGE_LANG, next.lang);
					if (patch.mode !== undefined) writeString(STORAGE_MODE, next.mode);
					if (patch.breakWidth !== undefined) writeString(STORAGE_BREAK, String(next.breakWidth));
					if (patch.langs !== undefined) writeString(STORAGE_LANGS, JSON.stringify(next.langs));
					for (const listener of [...listeners]) listener();
				},
			};
		}

		const store = createStore();
		let warnedAboutActions = false;

		function commitBreakWidth(raw) {
			const parsed = Number.parseInt(String(raw), 10);
			if (!Number.isFinite(parsed)) return;
			const breakWidth = Math.min(BREAK_WIDTH_MAX, Math.max(BREAK_WIDTH_MIN, parsed));
			store.update({ breakWidth });
		}

		function selectedLanguages() {
			const languages = store.getSnapshot().langs;
			return languages.length === 0 ? ['en'] : languages;
		}

		function nextLanguage(current) {
			const languages = selectedLanguages();
			if (languages.length < 2) return current;
			const index = languages.indexOf(current);
			return languages[(index + 1) % languages.length];
		}

		function toggleLanguage(code) {
			const state = store.getSnapshot();
			const included = state.langs.includes(code);
			if (included && state.langs.length === 1) return;
			const langs = included ? state.langs.filter((item) => item !== code) : LANGUAGE_CODES.filter((item) => item === code || state.langs.includes(item));
			const lang = langs.includes(state.lang) ? state.lang : langs[0];
			store.update({ langs, lang, shift: false });
		}

		// ── Composer focus (caret) ─────────────────────────────────────────────
		let focusBlocked = readFlag(STORAGE_NO_FOCUS, false);
		let focusWatch = 0;

		function composerRoot() {
			return document.querySelector(COMPOSER_SELECTOR);
		}

		/**
		 * Keep the composer focused so its caret is drawn. Lexical's own `focus()`
		 * only restores the stored selection, the DOM call focuses the element. When
		 * the device answers focus with the system keyboard (the visual viewport
		 * shrinks by a quarter within 400 ms) the attempt is recorded as failed and
		 * never repeated on this page.
		 */
		function ensureComposerFocus() {
			if (focusBlocked) return;
			const root = composerRoot();
			if (root === null || document.activeElement === root) return;
			const viewport = window.visualViewport;
			const heightBefore = viewport === undefined ? window.innerHeight : viewport.height;
			try {
				root.focus({ preventScroll: true });
				const editor = root.__lexicalEditor;
				if (editor !== undefined && typeof editor.focus === 'function') editor.focus();
			} catch (_error) {
				return;
			}
			if (focusWatch !== 0) window.clearTimeout(focusWatch);
			focusWatch = window.setTimeout(() => {
				focusWatch = 0;
				const now = window.visualViewport;
				const heightAfter = now === undefined ? window.innerHeight : now.height;
				if (heightBefore - heightAfter > heightBefore * SYSTEM_KEYBOARD_SHRINK) {
					focusBlocked = true;
					writeFlag(STORAGE_NO_FOCUS, true);
					try {
						root.blur();
					} catch (_error) {
						/* ignore */
					}
				}
			}, 400);
		}

		// ── Composer plumbing ──────────────────────────────────────────────────
		function insertText(inputActions, text) {
			if (inputActions === undefined || inputActions === null) return false;
			// Capture first: focusing restores the editor selection, and a word the user
			// picked must still be the range the text replaces.
			const span = inputActions.captureInsertion();
			ensureComposerFocus();
			if (inputActions.insertText(text, span)) return true;
			// A concurrent edit moved the revision between the two calls; one retry
			// with a freshly captured span is enough and stays exact.
			return inputActions.insertText(text, inputActions.captureInsertion());
		}

		/** Swap the character just typed for an accented variant (one edit, one undo step). */
		function replaceLastCharacter(inputActions, text) {
			if (inputActions === undefined || inputActions === null) return false;
			ensureComposerFocus();
			const span = inputActions.captureInsertion();
			const end = span.end;
			const start = span.start === end ? end - 1 : span.start;
			if (start < 0) return insertText(inputActions, text);
			return inputActions.insertText(text, { start, end, draftRev: span.draftRev });
		}

		function deleteBackward(inputActions) {
			if (inputActions === undefined || inputActions === null) return false;
			ensureComposerFocus();
			for (let attempt = 0; attempt < 2; attempt++) {
				const span = inputActions.captureInsertion();
				const end = span.end;
				const start = span.start === end ? end - 1 : span.start;
				if (start < 0) return false;
				if (inputActions.insertText('', { start, end, draftRev: span.draftRev })) return true;
			}
			return false;
		}

		// ── Word selection ─────────────────────────────────────────────────────
		const WORD_CHAR = /[\p{L}\p{N}_'’\-]/u;
		const TAP_MS = 500;
		const TAP_SLOP = 24;
		const LONG_PRESS_MS = 450;
		const MOVE_SLOP = 10;
		const CHIP_SELECTOR = '[data-composer-chip], [data-composer-command], [data-composer-quote], [contenteditable="false"]';

		/** The word range under one point of the composer, or null. */
		function wordRangeAt(x, y) {
			let range = null;
			if (typeof document.caretRangeFromPoint === 'function') {
				range = document.caretRangeFromPoint(x, y);
			} else if (typeof document.caretPositionFromPoint === 'function') {
				const position = document.caretPositionFromPoint(x, y);
				if (position !== null) {
					range = document.createRange();
					range.setStart(position.offsetNode, position.offset);
					range.collapse(true);
				}
			}
			if (range === null) return null;
			let node = range.startContainer;
			let offset = range.startOffset;
			if (node.nodeType !== 3) {
				const child = node.childNodes[Math.min(offset, node.childNodes.length - 1)];
				if (child === undefined || child.nodeType !== 3) return null;
				node = child;
				offset = Math.min(offset, node.data.length);
			}
			const text = node.data;
			let start = offset;
			let end = offset;
			while (start > 0 && WORD_CHAR.test(text[start - 1])) start--;
			while (end < text.length && WORD_CHAR.test(text[end])) end++;
			if (start === end) return null;
			const word = document.createRange();
			word.setStart(node, start);
			word.setEnd(node, end);
			return word;
		}

		function selectWordAt(x, y) {
			const range = wordRangeAt(x, y);
			if (range === null) return false;
			const selection = window.getSelection();
			if (selection === null) return false;
			selection.removeAllRanges();
			selection.addRange(range);
			return true;
		}

		/**
		 * Double tap and long press inside the composer select the word under the
		 * finger. Installed only while the the keyboard is open; a tap on a chip is
		 * left to the host.
		 */
		function installWordSelection() {
			let longTimer = 0;
			let pressPoint = null;
			let lastTap = null;
			let pendingWord = null;
			let lastGesture = null;

			const composerOf = (target) => (target instanceof Element ? target.closest(COMPOSER_SELECTOR) : null);

			const clearLong = () => {
				if (longTimer !== 0) {
					window.clearTimeout(longTimer);
					longTimer = 0;
				}
				pressPoint = null;
			};

			/** Re-apply the word range once more: on touch the composer's own click handling can land later. */
			const applyWord = (point, delay) => {
				window.setTimeout(() => {
					if (Date.now() - point.at > 1200) return;
					selectWordAt(point.x, point.y);
				}, delay);
			};

			const onPointerDown = (event) => {
				if (composerOf(event.target) === null) return;
				if (event.target instanceof Element && event.target.closest(CHIP_SELECTOR) !== null) return;
				const point = { x: event.clientX, y: event.clientY };
				const now = Date.now();
				clearLong();
				if (lastTap !== null && now - lastTap.time <= TAP_MS && Math.abs(point.x - lastTap.x) <= TAP_SLOP && Math.abs(point.y - lastTap.y) <= TAP_SLOP) {
					lastTap = null;
					pendingWord = { ...point, at: now };
					return;
				}
				lastTap = { time: now, x: point.x, y: point.y };
				pressPoint = point;
				longTimer = window.setTimeout(() => {
					longTimer = 0;
					if (pressPoint === null) return;
					lastTap = null;
					pendingWord = { ...pressPoint, at: Date.now() };
					lastGesture = pendingWord;
					applyWord(pendingWord, 0);
					pressPoint = null;
				}, LONG_PRESS_MS);
			};

			const onPointerMove = (event) => {
				if (pressPoint === null) return;
				if (Math.abs(event.clientX - pressPoint.x) > MOVE_SLOP || Math.abs(event.clientY - pressPoint.y) > MOVE_SLOP) clearLong();
			};

			const onDoubleClick = (event) => {
				if (composerOf(event.target) === null) return;
				if (event.target instanceof Element && event.target.closest(CHIP_SELECTOR) !== null) return;
				const point = { x: event.clientX, y: event.clientY, at: Date.now() };
				lastGesture = point;
				applyWord(point, 0);
			};

			const onPointerEnd = () => {
				clearLong();
				if (pendingWord === null) return;
				const point = pendingWord;
				pendingWord = null;
				lastGesture = point;
				applyWord(point, 0);
				applyWord(point, 90);
			};

			const onClick = (event) => {
				if (lastGesture === null) return;
				if (composerOf(event.target) === null) return;
				applyWord(lastGesture, 0);
			};

			document.addEventListener('pointerdown', onPointerDown, true);
			document.addEventListener('pointermove', onPointerMove, true);
			document.addEventListener('pointerup', onPointerEnd, true);
			document.addEventListener('pointercancel', onPointerEnd, true);
			document.addEventListener('click', onClick);
			document.addEventListener('dblclick', onDoubleClick, true);
			return () => {
				document.removeEventListener('pointerdown', onPointerDown, true);
				document.removeEventListener('pointermove', onPointerMove, true);
				document.removeEventListener('pointerup', onPointerEnd, true);
				document.removeEventListener('pointercancel', onPointerEnd, true);
				document.removeEventListener('click', onClick);
				document.removeEventListener('dblclick', onDoubleClick, true);
				clearLong();
			};
		}

		/**
		 * Put `inputmode="none"` (and no-autocorrect hints) on the composer's
		 * contenteditable root for as long as the panel is open. Previous attribute
		 * values are restored on close; a re-created composer element is picked up by
		 * the observer.
		 */
		function suppressSystemKeyboard() {
			const APPLIED = [
				['inputmode', 'none'],
				['autocorrect', 'off'],
				['autocapitalize', 'off'],
				['spellcheck', 'false'],
			];
			const saved = new Map();
			let frame = 0;

			const apply = () => {
				const nodes = document.querySelectorAll(COMPOSER_SELECTOR);
				for (const el of nodes) {
					if (saved.has(el)) continue;
					const previous = {};
					for (const [name, value] of APPLIED) {
						previous[name] = el.hasAttribute(name) ? el.getAttribute(name) : null;
						el.setAttribute(name, value);
					}
					el.setAttribute('data-dsk-suppressed', 'true');
					saved.set(el, previous);
				}
			};

			const schedule = () => {
				if (frame !== 0) return;
				frame = window.requestAnimationFrame(() => {
					frame = 0;
					apply();
				});
			};

			apply();
			const observer = new MutationObserver(schedule);
			observer.observe(document.body, { childList: true, subtree: true });

			return () => {
				observer.disconnect();
				if (frame !== 0) window.cancelAnimationFrame(frame);
				for (const [el, previous] of saved) {
					for (const [name, value] of Object.entries(previous)) {
						if (value === null) el.removeAttribute(name);
						else el.setAttribute(name, value);
					}
					el.removeAttribute('data-dsk-suppressed');
				}
				saved.clear();
			};
		}

		// ── Icons ──────────────────────────────────────────────────────────────
		function svg(size, children) {
			return h(
				'svg',
				{
					viewBox: '0 0 16 16',
					width: size,
					height: size,
					'aria-hidden': true,
					focusable: 'false',
					style: { display: 'block' },
				},
				children,
			);
		}

		function iconKeyboard(size) {
			return svg(size, [
				h('rect', { key: 'f', x: 1, y: 3.4, width: 14, height: 9.2, rx: 2, fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 }),
				h('g', { key: 'k', fill: 'currentColor' }, [
					h('rect', { key: 'a', x: 3, y: 5.4, width: 1.7, height: 1.5, rx: 0.4 }),
					h('rect', { key: 'b', x: 5.7, y: 5.4, width: 1.7, height: 1.5, rx: 0.4 }),
					h('rect', { key: 'c', x: 8.4, y: 5.4, width: 1.7, height: 1.5, rx: 0.4 }),
					h('rect', { key: 'd', x: 11.1, y: 5.4, width: 1.4, height: 1.5, rx: 0.4 }),
					h('rect', { key: 'e', x: 3, y: 8, width: 1.7, height: 1.5, rx: 0.4 }),
					h('rect', { key: 'g', x: 5.7, y: 8, width: 1.7, height: 1.5, rx: 0.4 }),
					h('rect', { key: 'i', x: 8.4, y: 8, width: 1.7, height: 1.5, rx: 0.4 }),
					h('rect', { key: 'j', x: 11.1, y: 8, width: 1.4, height: 1.5, rx: 0.4 }),
					h('rect', { key: 'l', x: 4, y: 10.5, width: 8, height: 1.3, rx: 0.5 }),
				]),
			]);
		}

		/** A cog: teeth ring plus the axle, drawn in a 24-unit box so the outline stays clean at 16 px. */
		function iconGear(size) {
			return h(
				'svg',
				{
					viewBox: '0 0 24 24',
					width: size,
					height: size,
					'aria-hidden': true,
					focusable: 'false',
					style: { display: 'block' },
				},
				h('path', {
					key: 'g',
					d: 'M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7V20a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2Z',
					fill: 'none',
					stroke: 'currentColor',
					strokeWidth: 1.8,
					strokeLinejoin: 'round',
				}),
				h('circle', { key: 'c', cx: 12, cy: 12, r: 3, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 }),
			);
		}

		function iconGlobe(size) {
			return svg(size, [
				h('circle', { key: 'c', cx: 8, cy: 8, r: 6.1, fill: 'none', stroke: 'currentColor', strokeWidth: 1.2 }),
				h('path', { key: 'm', d: 'M8 1.9c1.9 1.7 2.9 3.8 2.9 6.1S9.9 12.4 8 14.1C6.1 12.4 5.1 10.3 5.1 8S6.1 3.6 8 1.9Z', fill: 'none', stroke: 'currentColor', strokeWidth: 1.2 }),
				h('path', { key: 'e', d: 'M2 8h12', fill: 'none', stroke: 'currentColor', strokeWidth: 1.2 }),
			]);
		}

		function iconShift(size) {
			return svg(size, h('path', { d: 'M8 2.4 2.7 8h3v5.6h4.6V8h3L8 2.4Z', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinejoin: 'round' }));
		}

		function iconBackspace(size) {
			return svg(size, [
				h('path', { key: 'p', d: 'M5.7 3.2H14A1.4 1.4 0 0 1 15.4 4.6v6.8A1.4 1.4 0 0 1 14 12.8H5.7L1.4 8l4.3-4.8Z', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinejoin: 'round' }),
				h('path', { key: 'x', d: 'M8.4 6.3 11.8 9.7M11.8 6.3 8.4 9.7', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }),
			]);
		}

		/** Return/line-break arrow: down, then left. */
		function iconNewline(size) {
			return svg(size, [
				h('path', { key: 'l', d: 'M12.5 2.9v6.2a2 2 0 0 1-2 2H4.6', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }),
				h('path', { key: 'a', d: 'M7.5 8 4.2 11.1l3.3 3.1', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }),
			]);
		}

		// ── Press handling ─────────────────────────────────────────────────────
		/** Holding a repeating key: first repeat after this delay, then this often. */
		const REPEAT_DELAY_MS = 420;
		const REPEAT_INTERVAL_MS = 70;

		/**
		 * Pointer handlers for one key. `repeat` makes a held key fire again and
		 * again (Backspace), stopping on release, cancel or a drag off the key.
		 */
		function pressHandlers(onPress, options = {}) {
			const repeat = options.repeat === true;
			let delay = 0;
			let interval = 0;
			const stop = () => {
				if (delay !== 0) {
					window.clearTimeout(delay);
					delay = 0;
				}
				if (interval !== 0) {
					window.clearInterval(interval);
					interval = 0;
				}
				document.removeEventListener('pointerup', stop, true);
				document.removeEventListener('pointercancel', stop, true);
			};

			const start = () => {
				if (!repeat || delay !== 0 || interval !== 0) return;
				document.addEventListener('pointerup', stop, true);
				document.addEventListener('pointercancel', stop, true);
				delay = window.setTimeout(() => {
					delay = 0;
					interval = window.setInterval(onPress, REPEAT_INTERVAL_MS);
				}, REPEAT_DELAY_MS);
			};

			return {
				onPointerDown(event) {
					if (event.pointerType === 'mouse' && event.button !== 0) return;
					// Keep focus where it is: no system keyboard, no caret jump.
					event.preventDefault();
					onPress();
					start();
				},
				onPointerUp: stop,
				onPointerCancel: stop,
				onPointerLeave: stop,
				onKeyDown(event) {
					if (event.key !== 'Enter' && event.key !== ' ') return;
					event.preventDefault();
					onPress();
				},
				onContextMenu(event) {
					event.preventDefault();
				},
			};
		}

		function renderKey(key, state, t, inputActions, spaceGrow) {
			const attrs = { 'data-dsk-key': key };
			let label = key;
			let icon = null;
			let modifier = false;
			let withLabel = false;
			let wide = false;
			let pressed;
			let spaceStyle;
			let stacked = false;
			let repeating = false;
			let aria = key;
			let onPress;

			switch (key) {
				case '__shift':
					icon = iconShift(17);
					modifier = true;
					pressed = state.shift;
					aria = t('key.shift');
					attrs['data-dsk-action'] = 'shift';
					onPress = () => store.update({ shift: !store.getSnapshot().shift });
					break;
				case '__backspace':
					icon = iconBackspace(18);
					modifier = true;
					aria = t('key.backspace');
					attrs['data-dsk-action'] = 'backspace';
					attrs['data-dsk-repeat'] = 'true';
					repeating = true;
					onPress = () => deleteBackward(inputActions);
					break;
				case '__newline':
					icon = iconNewline(17);
					modifier = true;
					aria = t('key.newline');
					attrs['data-dsk-action'] = 'newline';
					onPress = () => insertText(inputActions, '\n');
					break;
				case '__settings':
					icon = iconGear(16);
					modifier = true;
					pressed = state.settings;
					aria = t('settings');
					attrs['data-dsk-action'] = 'settings';
					attrs['data-dsk-settings-toggle'] = state.settings ? 'on' : 'off';
					onPress = () => store.update({ settings: !store.getSnapshot().settings });
					break;
				case '__space':
				case '__space_narrow':
				case '__space_alt':
					label = '';
					wide = true;
					aria = t('key.space');
					attrs['data-dsk-action'] = 'space';
					attrs['data-dsk-narrow-space'] = key === '__space_narrow' ? 'true' : key === '__space_alt' ? 'alt' : undefined;
					attrs['data-dsk-space-grow'] = spaceGrow === undefined ? undefined : String(spaceGrow);
					spaceStyle = spaceGrow === undefined ? undefined : { flexGrow: String(spaceGrow) };
					onPress = () => insertText(inputActions, ' ');
					break;
				case '__lang': {
					const current = LANGUAGES[state.lang] === undefined ? 'EN' : LANGUAGES[state.lang].code;
					const several = state.langs.length > 1;
					const next = several ? (LANGUAGES[nextLanguage(state.lang)] === undefined ? current : LANGUAGES[nextLanguage(state.lang)].code) : current;
					icon = iconGlobe(13);
					label = current;
					withLabel = true;
					stacked = true;
					modifier = true;
					aria = several ? t('key.lang', { current, next }) : t('key.lang.add', { current });
					attrs['data-dsk-action'] = 'lang';
					attrs['data-dsk-lang'] = state.lang;
					onPress = () =>
						several
							? store.update({ lang: nextLanguage(store.getSnapshot().lang), shift: false })
							: store.update({ settings: true });
					break;
				}
				case '__digits':
					label = '123';
					modifier = true;
					aria = t('key.digits');
					attrs['data-dsk-action'] = 'digits';
					onPress = () => store.update({ page: 'digits', shift: false });
					break;
				case '__letters':
					label = t('key.letters');
					modifier = true;
					aria = t('key.letters');
					attrs['data-dsk-action'] = 'letters';
					onPress = () => store.update({ page: 'letters', shift: false });
					break;
				default: {
					label = state.shift && key.length === 1 ? upperOf(key, state.lang) : key;
					aria = key;
					attrs['data-dsk-key'] = key;
					onPress = () => insertText(inputActions, label);
					// Holding a letter repeats it; accent variants are the globe's long press.
					repeating = true;
				}
			}

			return h(
				'button',
				{
					key: `${key}-${label}`,
					type: 'button',
					className: 'dsk-key',
					tabIndex: -1,
					'aria-label': aria,
					'aria-pressed': pressed === undefined ? undefined : pressed,
					title: modifier || key === '__space' ? aria : undefined,
					'data-modifier': modifier ? 'true' : undefined,
					'data-wide': wide ? 'true' : undefined,
					'data-dsk-stacked': stacked ? 'true' : undefined,
					style: spaceStyle,
					...attrs,
					...pressHandlers(onPress, { repeat: repeating }),
				},
				icon === null
					? h('span', { className: 'dsk-label' }, label)
					: withLabel
						? stacked
							? [h('span', { key: 'label', className: 'dsk-label' }, label), icon]
							: [icon, h('span', { key: 'label', className: 'dsk-label' }, label)]
						: icon,
			);
		}

		// ── Layouts ────────────────────────────────────────────────────────────
		/**
		 * How many national characters fit as keys: roomier rows on a wide keyboard, fewer
		 * keys on a phone (the rest stay on long press). Never an extra row.
		 */
		function nationalCapacity(available) {
			if (available >= 600) return { rows: [13, 13, 13], bottom: 3 };
			if (available >= 460) return { rows: [12, 12, 12], bottom: 2 };
			return { rows: [11, 11, 12], bottom: 1 };
		}

		/**
		 * The accent list of one language, flattened in the order it should take keys:
		 * the leading characters become keys in the spare slots of the three letter
		 * rows (so no extra row appears), the rest stay on long press only.
		 */
		function nationalCharacters(lang) {
			const language = LANGUAGES[lang];
			if (language === undefined || language.accents === undefined) return [];
			return Object.values(language.accents).flat();
		}

		function lettersRows(state, languageCount, withDigits, available) {
			const language = LANGUAGES[state.lang] === undefined ? LANGUAGES.en : LANGUAGES[state.lang];
			const rows = [language.rows[0].slice(), language.rows[1].slice(), ['__shift', ...language.rows[2], '__backspace']];
			const capacity = nationalCapacity(available);
			const pending = nationalCharacters(state.lang).slice();
			for (let index = 0; index < rows.length && pending.length > 0; index++) {
				while (pending.length > 0 && rows[index].length < capacity.rows[index]) {
					const character = pending.shift();
					// Row three carries the Shift key first and Backspace last.
					if (index === 2) rows[index].splice(rows[index].length - 1, 0, character);
					else rows[index].push(character);
				}
			}
			// Whatever did not fit beside the letters goes into the bottom row beside the
			// comma, taking width from the space bar rather than adding a row.
			const bottomExtras = [];
			while (pending.length > 0 && bottomExtras.length < capacity.bottom) bottomExtras.push(pending.shift());
			const bottom = [];
			if (withDigits) bottom.push('__digits');
			bottom.push('__lang', '__settings', ',', ...bottomExtras);
			bottom.push(bottomExtras.length > 0 ? '__space_narrow' : '__space', '.', '__newline');
			rows.push(bottom);
			return rows;
		}

		function numericRows() {
			return NUMERIC.map((row) => row.slice());
		}

		/** The single-keyboard numeric page: the PC row, its Shift row, punctuation, then ABC + the last row. */
		function numericPageRows() {
			return [NUMERIC[0].slice(), NUMERIC[1].slice(), NUMERIC[2].slice(), ['__letters', ...NUMERIC[3]]];
		}

		/** Half of each row, for the split arrangements. */
		function halveRows(rows) {
			const left = [];
			const right = [];
			for (const row of rows) {
				const half = Math.ceil(row.length / 2);
				left.push(row.slice(0, half));
				right.push(row.slice(half));
			}
			return { left, right };
		}

		/** Letters split to the edges: shift stays left, backspace stays right, the bottom row splits by hand. */
		function splitLettersRows(state, languageCount, available) {
			const rows = lettersRows(state, languageCount, false, available);
			const bottom = rows[rows.length - 1];
			const body = rows.slice(0, -1);
			const left = [];
			const right = [];
			for (const row of body) {
				const head = [];
				const tail = [];
				const chars = [];
				let index = 0;
				while (index < row.length && row[index].startsWith('__')) {
					head.push(row[index]);
					index++;
				}
				let last = row.length - 1;
				while (last >= index && row[last].startsWith('__')) {
					tail.unshift(row[last]);
					last--;
				}
				for (let cursor = index; cursor <= last; cursor++) chars.push(row[cursor]);
				const half = Math.ceil(chars.length / 2);
				left.push([...head, ...chars.slice(0, half)]);
				right.push([...chars.slice(half), ...tail]);
			}
			const leftBottom = [];
			const rightBottom = [];
			for (const key of bottom) {
				if (key === '.' || key === '__newline') {
					rightBottom.push(key);
					continue;
				}
				leftBottom.push(key);
				// The split keeps a space bar on both halves.
				if (key === '__space' || key === '__space_narrow') rightBottom.unshift('__space_alt');
			}
			left.push(leftBottom);
			right.push(rightBottom);
			return { left, right };
		}

		function maxColumns(rows) {
			return rows.reduce((max, row) => Math.max(max, row.length), 1);
		}

		// ── Width measurement ──────────────────────────────────────────────────
		function useAvailableWidth(ref, active) {
			const [width, setWidth] = React.useState(() => window.innerWidth);
			React.useLayoutEffect(() => {
				if (!active) return undefined;
				const surface = ref.current;
				if (surface === null) return undefined;
				let host = surface.parentElement;
				while (host !== null && getComputedStyle(host).display === 'contents') host = host.parentElement;
				if (host === null) return undefined;
				const measure = () => setWidth(host.clientWidth);
				measure();
				if (typeof ResizeObserver !== 'function') return undefined;
				const observer = new ResizeObserver(measure);
				observer.observe(host);
				return () => observer.disconnect();
			}, [ref, active]);
			return width;
		}

		/**
		 * Which arrangement the current mode and width produce. The automatic mode
		 * needs WIDE_MIN_WIDTH for the side-by-side pair; an arrangement the user
		 * picked explicitly is always honoured, even when the keys end up narrow.
		 */
		function resolveArrangement(mode, available, breakWidth) {
			if (mode === 'one') return 'pages';
			if (available < breakWidth) return 'pages';
			if (mode === 'split-digits') return 'split-digits';
			if (mode === 'split-letters') return 'split-letters';
			return 'two-blocks';
		}

		function renderRows(rows, state, t, inputActions) {
			const letterRows = rows.slice(0, -1);
			const letterColumns = Math.max(1, ...letterRows.map((row) => row.length));
			return rows.map((row, index) => {
				// The space bar gives up width so no control key becomes narrower than a letter.
				const spaceGrow = index === rows.length - 1 ? Math.max(1, Math.min(3.4, letterColumns - (row.length - 1))) : undefined;
				return h(
					'div',
					{ key: `row-${index}`, className: 'dsk-row' },
					row.map((key) => renderKey(key, state, t, inputActions, spaceGrow)),
				);
			});
		}

		function renderBlock(block) {
			const letterRows = block.rows.slice(0, -1);
			const letterColumns = Math.max(1, ...letterRows.map((row) => row.length));
			return h(
				'div',
				{
					key: block.key,
					className: 'dsk-block',
					'data-dsk-block': block.key,
					style: { flexGrow: block.columns },
				},
				block.rows.map((row, index) => {
					const spaceGrow = index === block.rows.length - 1 ? Math.max(1, Math.min(3.4, letterColumns - (row.length - 1))) : undefined;
					return h(
						'div',
						{ key: `${block.key}-${index}`, className: 'dsk-row' },
						row.map((key) => renderKey(key, block.state, block.t, block.inputActions, spaceGrow)),
					);
				}),
			);
		}

		// ── Settings ───────────────────────────────────────────────────────────
		function SettingsPanel({ state, t }) {
			const modeChip = (mode) =>
				h(
					'button',
					{
						key: mode,
						type: 'button',
						className: 'dsk-chip',
						'aria-pressed': state.mode === mode,
						'data-dsk-mode-option': mode,
						...pressHandlers(() => store.update({ mode })),
					},
					t(`mode.${mode}`),
				);
			const languageChips = LANGUAGE_CODES.map((code) =>
				h(
					'button',
					{
						key: code,
						type: 'button',
						className: 'dsk-chip',
						'aria-pressed': state.langs.includes(code),
						'data-dsk-language': code,
						...pressHandlers(() => toggleLanguage(code)),
					},
					LANGUAGES[code].label,
				),
			);
			return h(
				'div',
				{
					className: 'dsk-settings',
					'data-dsk-settings': 'open',
					style: { width: 'min(100%, 640px)' },
				},
				h(
					'div',
					{ className: 'dsk-settings-head' },
					h('span', { className: 'dsk-settings-title' }, t('settings.title')),
					h(
						'button',
						{
							type: 'button',
							className: 'dsk-chip dsk-chip-close',
							'aria-label': t('settings.close'),
							title: t('settings.close'),
							'data-dsk-action': 'settings-close',
							...pressHandlers(() => store.update({ settings: false })),
						},
						'✕',
					),
				),
				h(
					'div',
					{ className: 'dsk-settings-row dsk-settings-row-wrap', 'data-dsk-mode-row': 'true' },
					modeChip('one'),
					h('input', {
						type: 'number',
						className: 'dsk-input',
						inputMode: 'numeric',
						min: BREAK_WIDTH_MIN,
						max: BREAK_WIDTH_MAX,
						step: 20,
						defaultValue: String(state.breakWidth),
						'aria-label': t('settings.break'),
						'data-dsk-break-width': 'true',
						onBlur: (event) => commitBreakWidth(event.target.value),
						onKeyDown: (event) => {
							if (event.key !== 'Enter') return;
							event.preventDefault();
							commitBreakWidth(event.currentTarget.value);
						},
					}),
					h('span', { className: 'dsk-settings-unit' }, 'px:'),
					modeChip('split-digits'),
					modeChip('split-letters'),
					modeChip('side-by-side'),
				),
				h(
					'div',
					{ className: 'dsk-settings-section' },
					h('div', { className: 'dsk-settings-label' }, t('settings.languages')),
					h('div', { className: 'dsk-chips' }, languageChips),
				),
			);
		}

		// ── Surface ────────────────────────────────────────────────────────────
		/**
		 * The keyboard surface: the settings panel on top (when asked for) and the
		 * keyboard itself. Both live in one dock item, so opening the keyboard pushes
		 * the composer card up.
		 */
		function KeyboardSurface(props) {
			const state = React.useSyncExternalStore(store.subscribe, store.getSnapshot);
			const t = typeof props.t === 'function' ? props.t : (key) => key;
			const inputActions = props.inputActions;
			const ref = React.useRef(null);
			const active = state.open || state.settings;
			const available = useAvailableWidth(ref, active);
			const arrangement = resolveArrangement(state.mode, available, state.breakWidth);

			if (inputActions === undefined && !warnedAboutActions && state.open) {
				warnedAboutActions = true;
				console.warn('[doublekeys] composer inputActions are missing; keys cannot type');
			}

			React.useEffect(() => {
				if (!state.open) return undefined;
				const restoreKeyboard = suppressSystemKeyboard();
				const restoreWords = installWordSelection();
				return () => {
					restoreWords();
					restoreKeyboard();
				};
			}, [state.open]);

			if (!active) return null;

			const wide = arrangement !== 'pages';
			const blocks = [];
			if (arrangement === 'two-blocks') {
				blocks.push({ key: 'symbols', rows: numericRows(), columns: maxColumns(NUMERIC) });
				const letters = lettersRows(state, state.langs.length, false, available);
				blocks.push({ key: 'letters', rows: letters, columns: maxColumns(letters) });
			} else if (arrangement === 'split-letters') {
				const split = splitLettersRows(state, state.langs.length, available);
				blocks.push({ key: 'letters-left', rows: split.left, columns: maxColumns(split.left) });
				blocks.push({ key: 'symbols', rows: numericRows(), columns: maxColumns(NUMERIC) });
				blocks.push({ key: 'letters-right', rows: split.right, columns: maxColumns(split.right) });
			} else if (arrangement === 'split-digits') {
				const split = halveRows(NUMERIC);
				const letters = lettersRows(state, state.langs.length, false, available);
				blocks.push({ key: 'symbols-left', rows: split.left, columns: maxColumns(split.left) });
				blocks.push({ key: 'letters', rows: letters, columns: maxColumns(letters) });
				blocks.push({ key: 'symbols-right', rows: split.right, columns: maxColumns(split.right) });
			}

			const keyboard =
				arrangement === 'pages'
					? state.page === 'digits'
						? h('div', { className: 'dsk-panel', 'data-dsk-panel': 'open', 'data-dsk-mode': 'pages', 'data-dsk-page': 'digits', 'data-dsk-lang': state.lang, 'data-dsk-shift': state.shift ? 'on' : 'off' }, renderRows(numericPageRows(), state, t, inputActions))
						: h('div', { className: 'dsk-panel', 'data-dsk-panel': 'open', 'data-dsk-mode': 'pages', 'data-dsk-page': 'letters', 'data-dsk-lang': state.lang, 'data-dsk-shift': state.shift ? 'on' : 'off' }, renderRows(lettersRows(state, state.langs.length, true, available), state, t, inputActions))
					: h(
						'div',
						{ className: 'dsk-panel dsk-panel--blocks', 'data-dsk-panel': 'open', 'data-dsk-mode': arrangement, 'data-dsk-lang': state.lang, 'data-dsk-shift': state.shift ? 'on' : 'off' },
						blocks.map((block) =>
							renderBlock({ ...block, state, t, inputActions }),
						),
					);

			return h(
				'div',
				{
					ref,
					className: 'dsk-surface',
					'data-dsk-surface': 'open',
					'data-dsk-mode': arrangement,
					'data-dsk-lang': state.lang,
					'data-dsk-shift': state.shift ? 'on' : 'off',
					'data-dsk-wide': wide ? 'true' : 'false',
					role: 'group',
					'aria-label': t('toggle'),
				},
				state.settings ? h(SettingsPanel, { state, t }) : null,
				state.open ? keyboard : null,
			);
		}

		/** The keyboard show/hide button in the composer tools row. */
		function KeyboardToggle(props) {
			const state = React.useSyncExternalStore(store.subscribe, store.getSnapshot);
			const t = typeof props.t === 'function' ? props.t : (key) => key;
			return h(
				'button',
				{
					type: 'button',
					className: 'dsk-toggle',
					'aria-pressed': state.open,
					'aria-label': t('toggle'),
					title: t('toggle'),
					'data-dsk-toggle': state.open ? 'on' : 'off',
					'data-dsk-action': 'toggle',
					...pressHandlers(() => store.update({ open: !store.getSnapshot().open })),
				},
				iconKeyboard(16),
			);
		}

		// ── Styles (theme tokens only) ─────────────────────────────────────────
		const CSS = `
.dsk-surface{position:relative;box-sizing:border-box;order:10;align-self:center;display:flex;flex-direction:column;align-items:center;gap:6px;
  width:min(calc(var(--dsh-composer-card-max-width,640px) + 2 * var(--dsh-composer-side-clearance,0px)),100%);
  max-width:720px;margin:0 auto;padding:0 6px calc(6px + env(safe-area-inset-bottom,0px));flex:none}
.dsk-surface[data-dsk-wide="true"]{width:min(100%,1120px);max-width:1120px}
.dsk-panel{box-sizing:border-box;display:flex;flex-direction:column;gap:4px;width:100%}
.dsk-panel--blocks{flex-direction:row;align-items:flex-start;gap:12px}
.dsk-block{display:flex;flex-direction:column;gap:4px;flex-basis:0;min-width:0}
.dsk-toggle{flex:none;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:0;border-radius:999px;background:0 0;color:var(--dsw-alias-label-tertiary);cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
@media (hover:hover){.dsk-toggle:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}}
.dsk-toggle:active{background:var(--dsw-alias-interactive-bg-active)}
.dsk-toggle[data-dsk-toggle="on"],.dsk-toggle[data-dsk-settings-toggle="on"]{color:var(--dsw-alias-state-business-primary)}
.dsk-settings{box-sizing:border-box;display:flex;flex-direction:column;gap:8px;max-height:46vh;overflow-y:auto;padding:10px 12px;border-radius:var(--dsw-radius-lg);background:var(--dsw-specific-menu);box-shadow:var(--dsw-elevation-panel);border:.5px solid var(--dsw-alias-border-l1)}
.dsk-settings-head{display:flex;align-items:center;gap:8px}
.dsk-settings-title{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;line-height:18px}
.dsk-settings-head .dsk-chip-close{margin-left:auto}
.dsk-settings-section{display:flex;flex-direction:column;gap:5px}
.dsk-settings-label{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:14px;letter-spacing:.06em;text-transform:uppercase}
.dsk-settings-row{display:flex;align-items:center;gap:8px}
.dsk-settings-row-wrap{flex-wrap:wrap;gap:6px}
.dsk-input{width:68px;height:24px;padding:0 8px;border:0;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-base);box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;text-align:right;outline:none}
.dsk-input:focus{box-shadow:inset 0 0 0 2px var(--dsw-alias-state-business-primary)}
.dsk-settings-unit{color:var(--dsw-alias-label-tertiary);font-size:11px}
.dsk-chips{display:flex;flex-wrap:wrap;gap:5px}
.dsk-chip{appearance:none;border:0;border-radius:999px;padding:4px 9px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:16px;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
@media (hover:hover){.dsk-chip:hover{background:var(--dsw-alias-interactive-bg-hover)}}
.dsk-chip[aria-pressed="true"]{background:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-primary-foreground)}
.dsk-chip-close{padding:2px 8px}
.dsk-row{display:flex;gap:4px;width:100%}
.dsk-key{box-sizing:border-box;flex:1 1 0;min-width:0;height:clamp(38px,6.6vh,54px);display:flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:7px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary);font:inherit;font-size:clamp(13px,4.1vw,20px);line-height:1;gap:5px;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation;transition:background-color .07s ease}
@media (hover:hover){.dsk-key:hover{background:var(--dsw-alias-interactive-bg-hover)}}
.dsk-key:active{background:var(--dsw-alias-interactive-bg-active)}
.dsk-key[data-modifier="true"]{color:var(--dsw-alias-label-secondary);font-size:clamp(11px,3.3vw,15px)}
.dsk-key[data-wide="true"]{flex-grow:3.4}
.dsk-key[data-dsk-narrow-space="true"]{flex-grow:2.2}
.dsk-key[data-dsk-narrow-space="alt"]{flex-grow:2.6}
.dsk-key[data-dsk-stacked="true"]{flex-direction:column;gap:1px}
.dsk-key[data-dsk-stacked="true"] .dsk-label{font-size:9px;line-height:10px;letter-spacing:.04em}
.dsk-key[aria-pressed="true"]{background:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-primary-foreground)}
.dsk-key[data-dsk-action="space"]::after{content:"";width:34%;height:2px;border-radius:1px;background:currentColor;opacity:.4}
.dsk-label{display:block;white-space:nowrap}
`;

		function installStyles(ctx) {
			ctx.effect(() => {
				if (document.querySelector(`style[data-plugin-css=${JSON.stringify(STYLE_ID)}]`) !== null) return () => {};
				const tag = document.createElement('style');
				tag.dataset.plugin = 'doublekeys';
				tag.dataset.pluginCss = STYLE_ID;
				tag.textContent = CSS;
				document.head.appendChild(tag);
				return () => {
					tag.remove();
				};
			}, 'doublekeys: styles');
		}

		function apply(ctx) {
			installStyles(ctx);
			ctx.effect(() => ctx.locale.register(NS, { en: DICTS.en, ru: DICTS.ru }), 'doublekeys: locale');
			ctx.slots.inject('conversation.input.dock', () =>
				ctx.slots.register(
					{
						name: 'conversation.input.dock',
						id: 'doublekeys-panel',
						order: 10,
						locale: NS,
					},
					KeyboardSurface,
				),
			);
			ctx.slots.inject('conversation.input.right', () =>
				ctx.slots.register({ name: 'conversation.input.right', id: 'doublekeys-toggle', order: 5, locale: NS }, KeyboardToggle),
			);
		}

		exports.apply = apply;
		exports.inject = ['slots', 'locale'];
		return module.exports;
	},
});
