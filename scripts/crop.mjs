import { Jimp } from 'jimp';
async function main() {
  const image = await Jimp.read('public/logo.png');
  image.autocrop();
  image.scaleToFit({ w: 512, h: 512 });
  await image.write('public/icon-aplikasi/logo-transparent-desktop.png');
  console.log('Crop OK');
}
main().catch(console.error);
