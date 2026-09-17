// Compartido entre BurbujaMensaje y la lista de Chats — antes estaba duplicado
// en los dos archivos y un cambio de formato en uno podía olvidarse en el otro.
export const formateadorHora = new Intl.DateTimeFormat('es-MX', { hour: 'numeric', minute: '2-digit' });
