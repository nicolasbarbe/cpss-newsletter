import {
  buildBlock,
  decorateBlocks,
  decorateButtons,
  decorateIcons,
  decorateList,
  decorateSections,
  decorateTemplateAndTheme,
  init as initLibFranklin,
} from './lib-franklin.js';

let window = {};
let document = {};
const thridPartyScripts = [];
export const personalizationType = 'adobe-campaign-standard';

const mjmlTemplate = (mjmlHead, mjmlBody, bodyCssClasses = []) => `
  <mjml>
    <mj-head>
      ${mjmlHead}
    </mj-head>
    <mj-body width="800" css-class="${bodyCssClasses.join(' ')}">
      ${mjmlBody}
    </mj-body>
  </mjml>
  `;

async function loadScript(src) {
  if (!document.querySelector(`head > script[src="${src}"]`)) {
    thridPartyScripts[src] = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.crossOrigin = true;
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return thridPartyScripts[src];
  }
  return thridPartyScripts[src];
}

async function loadMjml(src = 'https://unpkg.com/mjml-browser@4.13.0/lib/index.js') {
  if (!window.mjml) {
    await loadScript(src);
  }
  return window.mjml;
}

async function loadLess(src = 'https://unpkg.com/less@4.1.3/dist/less.min.js') {
  if (!window.less) {
    await loadScript(src);
  }
  return window.less;
}

async function loadBlock(block) {
  const status = block.getAttribute('data-block-status');
  const blockName = block.getAttribute('data-block-name');
  let decorator;
  if (status !== 'loading') {
    block.setAttribute('data-block-status', 'loading');
    try {
      const blockModule = await import(`../blocks/${blockName}/${blockName}.js`);
      if (!blockModule.default) {
        throw new Error('default export not found');
      }
      decorator = async (b) => {
        try {
          return await blockModule.default(b, window);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.log(`failed to load module for ${blockName}`, error);
          return null;
        }
      };
      if (blockModule.styles) {
        decorator.styles = blockModule.styles
          .map((stylesheet) => `/blocks/${blockName}/${stylesheet}`);
      }
      if (blockModule.inlineStyles) {
        decorator.inlineStyles = blockModule.inlineStyles
          .map((stylesheet) => `/blocks/${blockName}/${stylesheet}`);
      }
      if (!blockModule.styles && !blockModule.inlineStyles) {
        decorator.inlineStyles = [`/blocks/${blockName}/${blockName}.css`];
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log(`failed to load block ${blockName}`, error);
      decorator = async () => Promise.reject();
    }
    block.setAttribute('data-block-status', 'loaded');
  } else {
    console.log(`tried to load block twice ${blockName}`);
    decorator = async () => Promise.resolve();
  }

  return decorator;
}

async function parseStyle(css) {
  const less = await loadLess();
  const ast = await less.parse(css);
  const attributes = {};
  const isTemplate = (stmt) => document.body.matches(stmt);

  for (let i = 0; i < ast.rules.length; i += 1) {
    const rule = ast.rules[i];
    if (rule.type === 'Comment') {
      // remove comments in general
      ast.rules.splice(i, 1);
      i -= 1;
    } else if (rule.isRuleset) {
      // get the mj-* selectors
      const defs = rule.selectors
        .map((selector) => {
          const isMjTag = (element) => element && element.value.indexOf('mj-') === 0;
          const isMjClass = (element) => element && element.value.indexOf('.mj-') === 0;
          const toDef = (first, second) => {
            if (isMjClass(first)) {
              if (second || first.value.substring(1).indexOf('.') > 0) {
                console.log('chaining mj-class selectors is not supported');
                return null;
              }
              return { mjEl: 'mj-all', mjClass: first.value.substring(1) };
            }
            if (isMjTag(first)) {
              if (second && second.value && second.value.charAt(0) === '.') {
                if (first.value !== 'mj-all') {
                  // mj-class is not element specific
                  console.log('className not supported for mj elements other than mj-all');
                  return null;
                }
                return { mjEl: first.value, mjClass: second.value.substring(1) };
              }
              return { mjEl: first.value };
            }
            return null;
          };
          const first = selector.elements[0];
          const second = selector.elements[1];
          const def = toDef(first, second);
          if (def) {
            return def;
          }
          if ((isMjTag(second) || isMjClass(second)) && isTemplate(first.value)) {
            return toDef(second, selector.elements[2]);
          }
          return null;
        })
        .filter((def) => !!def);

      if (defs.length) {
        // remove the rule from the ruleset
        ast.rules.splice(i, 1);
        i -= 1;
        const declarations = rule.rules
          .map((declaration) => {
            const [{ value: name }] = declaration.name;
            let value = declaration.value.toCSS();
            if (value.charAt(0) === '\'' && value.charAt(value.length - 1) === '\'') {
              value = value.substring(1, value.length - 1);
            }
            return [name, value];
          })
          .filter((decl) => !!decl)
          .reduce((map, [name, value]) => ({ ...map, [name]: value }), {});
        if (Object.keys(declarations).length) {
          defs.forEach(({ mjEl, mjClass = '*' }) => {
            if (!attributes[mjEl]) attributes[mjEl] = {};
            if (!attributes[mjEl][mjClass]) attributes[mjEl][mjClass] = {};
            attributes[mjEl][mjClass] = { ...attributes[mjEl][mjClass], ...declarations };
          });
        }
      }
    }
  }

  const { css: genCss } = new less.ParseTree(ast, []).toCSS({});

  return [attributes, genCss];
}

async function loadStyles({ styles, inlineStyles }) {
  const loadStyle = async (stylesheet, inline) => {
    const resp = await window.fetch(`${window.hlx.codeBasePath}${stylesheet}`);
    if (resp.ok) {
      let mjml = '';
      const text = (await resp.text()).trim();
      if (text) {
        const [attributes, parsedStyles] = await parseStyle(text);

        if (Object.keys(attributes).length) {
          mjml += '<mj-attributes>\n';
          Object.keys(attributes).forEach((mjEl) => {
            Object.keys(attributes[mjEl]).forEach((mjClass) => {
              if (mjClass === '*') {
                mjml += `<${mjEl} `;
              } else {
                mjml += `<mj-class name="${mjClass}" `;
              }
              mjml += Object.entries(attributes[mjEl][mjClass])
                .map(([name, value]) => `${name}="${value}"`)
                .join(' ');
              mjml += '/>\n';
            });
          });
          mjml += '</mj-attributes>\n';
        }
        if (parsedStyles) {
          mjml += `
              <mj-style${inline ? ' inline="inline"' : ''}>
                ${parsedStyles}
              </mj-style>
            `;
        }
      }
      return mjml;
    }
    console.log(`failed to load stylesheet: ${stylesheet}`);
    return '';
  };
  const styles$ = styles
    ? styles.map(async (stylesheet) => loadStyle(stylesheet, false))
    : [];
  const inlineStyles$ = inlineStyles
    ? inlineStyles.map(async (stylesheet) => loadStyle(stylesheet, true))
    : [];

  return Promise.all(styles$.concat(inlineStyles$))
    .then((resolvedStylesheets) => resolvedStylesheets.join(''));
}

function reduceMjml(mjml) {
  return mjml.reduce(
    ([body, head], [sectionBody, sectioHead]) => [
      body + (sectionBody || ''),
      head + (sectioHead || ''),
    ],
    ['', ''],
  );
}

export function decorateDefaultContent(wrapper, { textClass = '', buttonClass = '', imageClass = '' } = {}) {
  return [...wrapper.children]
    .reduce((mjml, par) => {
      const img = par.querySelector('img');
      if (img) {
        return `${mjml}<mj-image mj-class="${imageClass}" src="${img.src}" />`;
      }
      if (par.matches('.button-container')) {
        const link = par.querySelector(':scope > a');
        return `${mjml}
                <mj-button mj-class="${buttonClass}" href="${link.href}">
                  ${link.innerText}
                </mj-button>
            `;
      }
      if (mjml.endsWith('</mj-text>')) {
        return `${mjml.substring(0, mjml.length - 10)}${par.outerHTML}</mj-text>`;
      }
      return `${mjml}<mj-text mj-class="${textClass}">${par.outerHTML}</mj-text>`;
    }, '');
}

export async function toMjml(main) {
  const mjml2html$ = loadMjml();
  let counter = 0;

  const main$ = Promise.all([...main.querySelectorAll(':scope > .section')]
    .map(async (section) => {
      const mjc = [...section.classList].map((c) => `mj-${c}`).join(' ');
      counter += 1;
      const [sectionBody, sectionHead] = reduceMjml(await Promise.all([...section.children]
        .map(async (wrapper) => {
          if (wrapper.matches('.default-content-wrapper')) {
            return Promise.resolve([`
            <mj-section mj-class="${counter === 1 ? 'mj-first' : ''} mj-content-section ${mjc}">
              <mj-column mj-class="mj-content-column">
                ${decorateDefaultContent(wrapper,
              { textClass: 'mj-content-text', imageClass: 'mj-content-image', buttonClass: 'mj-content-button' }
            )}
              </mj-column>
            </mj-section>
            <mj-divider mj-class="mj-section-divider" border-width="1px" border-color="rgb(210,210,210)" width="30%" />
          `]);
          }

          const block = wrapper.querySelector('.block');
          if (block) {
            const decorator = await loadBlock(block);
            const decorated$ = decorator(block);
            const styles$ = loadStyles(decorator);
            return Promise.all([decorated$, styles$])
              .catch((err) => {
                console.error(err);
                return [];
              });
          }
          return Promise.resolve([]);
        })));

      return [
        `<mj-wrapper mj-class="mj-content-wrapper ${section.previousElementSibling == null ? 'mj-first' : ''} ${ section.nextElementSibling == null || (section.nextElementSibling && section.nextElementSibling.nextElementSibling == null) ? 'mj-last' : ''}">${sectionBody}</mj-wrapper>`,
        sectionHead
      ];
    }));
  const styles$ = loadStyles({
    styles: ['/styles/email-styles.css'],
    inlineStyles: ['/styles/email-inline-styles.css'],
  });

  const mjmlStyles = await styles$;
  const [body, head] = reduceMjml(await main$);

  const mjml = mjmlTemplate(mjmlStyles + head, body, [...document.body.classList]);
  console.debug(mjml);

  const mjml2html = await mjml2html$;
  const { html } = mjml2html(mjml, { minify: true });

  return html;
}

function buildHeroBlock(main) {
  const picture = main.querySelector('picture');
  if (picture
    && picture.parentElement === main.firstElementChild
    && picture.parentElement.firstElementChild === picture) {
    // picture is the first element on the page
    const elems = [...picture.parentElement.children];
    picture.parentElement.append(buildBlock('hero', { elems }));
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    buildHeroBlock(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}


/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  decorateTemplateAndTheme();
  decorateButtons(main);
  decorateList(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
}

export function init(w) {
  initLibFranklin(w);
  w.personalizationType = personalizationType;
  window = w;
  document = w.document;
}
