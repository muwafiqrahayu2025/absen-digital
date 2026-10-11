import { Jimp } from 'jimp';

async function main() {
  const logo = await Jimp.read('public/icon-aplikasi/icon-maskable.png');
  logo.autocrop(); 
  
  logo.scaleToFit({ w: 340, h: 340 });

  const bg = new Jimp({ width: 512, height: 512, color: 0xffffffff });
  bg.circle(); 

  const x = (512 - logo.bitmap.width) / 2;
  const y = (512 - logo.bitmap.height) / 2;
  bg.composite(logo, x, y);

  await bg.write('public/icon-aplikasi/logo-circle-desktop.png');
  console.log('Circle created successfully!');
}
main().catch(console.error);
