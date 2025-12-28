console.log('Script loaded');

// Test API endpoint
fetch('/api/maps-config')
  .then(res => res.json())
  .then(data => {
    console.log('API Key response:', data);
    if (!data.apiKey) {
      alert('ERROR: No API key found! Check Vercel environment variables.');
      return;
    }
    
    // Load Azure Maps
    const script = document.createElement('script');
    script.src = 'https://atlas.microsoft.com/sdk/javascript/mapcontrol/2/atlas.min.js';
    script.onload = () => {
      console.log('Azure Maps loaded');
      
      // Initialize simple map
      const map = new atlas.Map('map', {
        center: [0, 0],
        zoom: 2,
        authOptions: {
          authType: 'subscriptionKey',
          subscriptionKey: data.apiKey
        }
      });
      
      console.log('Map initialized');
    };
    script.onerror = () => {
      alert('Failed to load Azure Maps script');
    };
    document.head.appendChild(script);
  })
  .catch(err => {
    console.error('Error:', err);
    alert('Failed to fetch API key: ' + err.message);
  });
