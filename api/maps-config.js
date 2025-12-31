export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  // Return BOTH clientId and subscriptionKey
  res.status(200).json({
    clientId: process.env.AZURE_MAPS_CLIENT_ID,
    subscriptionKey: process.env.AZURE_MAPS_SUBSCRIPTION_KEY
  });
}
