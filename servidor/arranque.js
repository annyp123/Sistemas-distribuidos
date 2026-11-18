const aplicacion = require('./aplicacion');

const PUERTO = process.env.PORT || 3000;

aplicacion.listen(PUERTO, () => {
  console.log(`Picas y Fijas escuchando en el puerto ${PUERTO}`);
});
