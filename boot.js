'use strict';
// запуск приложения: все остальные скрипты уже загружены
buildBurtonScene();
showTab('pantry');
setInterval(renderBanner, 60000);   // раз в минуту проверяем напоминания
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
