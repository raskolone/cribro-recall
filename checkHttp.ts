import http from 'http';
http.get('http://localhost:3000/lekcja1.mp3', (res) => {
  console.log('Status code:', res.statusCode);
  console.log('Headers:', res.headers);
});
