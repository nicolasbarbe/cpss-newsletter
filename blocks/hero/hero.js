export default function decorate(block) {
  const h1 = block.querySelector('h1');

  // mj-hero has an issue with outlook in mode='fluid-height' https://github.com/mjmlio/mjml/issues/1253
  // the recommendation is to use a section instead
  // the 2nd column is used to give the section a min-height

//   const logoUrl = new window.URL(`${window.hlx.codeBasePath}/icons/adobe-red.png`, window.location.href);

  return `
    
        <mj-section mj-class="mj-hero">
            <mj-column width="100%" align="left">
                <mj-text  mj-class="mj-hero-text">${h1.outerHTML}</mj-text>
            </mj-column>
        </mj-section>

    
    `;
}
