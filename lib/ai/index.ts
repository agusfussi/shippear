// API pública de la capa de IA. Las rutas de app/api/* importan solo desde acá.
export { analizarFotos, FichaInvalidaError, type ResultadoAnalisis } from "./analizar"
export { responderChat, type MensajeHistorial, type RespuestaChat } from "./chat"
export { catalogoDemo, type ProductoLV } from "./catalogo"
export { MODELO, MODELO_RESPALDO } from "./gemini"
export { PROMPT_VERSION } from "./prompt"
export { EntradaInvalidaError, type AudioEntrada, type FotoEntrada, type TipoFoto } from "./tipos"
