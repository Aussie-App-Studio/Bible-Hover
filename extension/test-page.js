document.getElementById('addDynamicContent')?.addEventListener('click', () => {
  const container = document.getElementById('dynamicContainer');
  if (!container) return;
  const div = document.createElement('div');
  div.style.padding = '12px';
  div.style.background = '#f1f5f9';
  div.style.borderRadius = '8px';
  div.style.marginTop = '8px';
  div.innerHTML = '<strong>Dynamically Loaded:</strong> Remember Proverbs 3:5-6 and Matthew 28:18-20!';
  container.appendChild(div);
});
