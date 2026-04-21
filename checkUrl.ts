import https from 'https';

https.get('https://docs.google.com/uc?export=download&id=1HmLz7ilIE4bq0dA-JTm80-3UR8zutTIm', (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers);
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Body start:', data.substring(0, 500));
  });
});
