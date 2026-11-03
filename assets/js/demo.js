const launch = document.getElementById('launch-demo');
const container = document.getElementById('demo-container');
launch?.addEventListener('click', () => {
  if (!container || container.querySelector('iframe')) return;
  const frame = document.createElement('iframe');
  frame.className = 'demo-frame';
  frame.title = 'The Cocktail Party Problem interactive demo';
  frame.src = container.dataset.embedUrl;
  frame.allow = 'microphone';
  container.append(frame);
  launch.disabled = true;
  frame.focus();
});
