function trend(t) {
  let res = '<span ';
  if (t === 'up') {
    res += 'class="trend-up">\u25b2';
  } else if (t === 'down') {
    res += 'class="trend-down">\u25bc';
  } else if (t === 'stable') {
    res += 'class="trend-stable">';
  }
  res += '</span>';
  return res;
}

export default function decorate(block) {
  let mjml = `
    <mj-section mj-class="mj-indicators">
      <mj-column>
        <mj-table>
`;
  const rows = [...block.children];

  // indicator name
  mjml += '<tr class="indicator-name">';
  rows.forEach((row) => {
    const cells = [...row.children];
    mjml += `<td>${cells[0].innerHTML}</td>`;
  });
  mjml += '</tr>';

  // indicator value
  mjml += '<tr class="indicator-value">';
  rows.forEach((row) => {
    const cells = [...row.children];
    mjml += `<td>${trend(cells[3].innerHTML)}${cells[1].innerHTML}<sub>${cells[2].innerHTML}</sub></td>`;
  });
  mjml += '</tr>';

  mjml += `
        </mj-table>
      </mj-column>
    </mj-section>
    <mj-divider mj-class="mj-section-divider" border-width="1px" border-color="rgb(210,210,210)" width="30%" />


`;
  return mjml;
}
