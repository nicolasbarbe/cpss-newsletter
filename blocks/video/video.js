function createVideo(img) {
  const imgHeight = img.height;
  const imgWidth = img.width;

  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');

  c.height = imgHeight;
  c.width = imgWidth;

  const centerX = c.width / 2;
  const centerY = c.height / 2;

  // add a transparent gray layer
  ctx.globalAlpha = 0.4;
  const grd = ctx.createRadialGradient(centerX, centerY, 500, centerX, centerY, 900);
  grd.addColorStop(0, 'white');
  grd.addColorStop(1, 'grey');

  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalAlpha = 1.0;

  // draw the arrow
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 15;

  const radius = 100;
  ctx.fillStyle = 'transparent';
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#555';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(centerX - 35, centerY - 60);
  ctx.lineTo(centerX - 35, centerY + 60);
  ctx.lineTo(centerX + 60, centerY);
  ctx.fill();
  ctx.closePath();

  ctx.fill();

  return c.toDataURL('image/png');
}

export default function decorate(block) {
  const img = block.querySelector('img');
  const a = block.querySelector('a');

  const data = createVideo(img);

  return `
  
      <mj-raw mj-class="mj-video">
        <a href="${a.href}" target="_blank" rel="noopener noreferrer">    
          <div class="video-container">   
            <img src="${img.src}" class='video-preview'/>
            <img src="${data}" class='video-controls'/>
          </div>
        </a>
      </mj-raw> 
      
  `;

}

